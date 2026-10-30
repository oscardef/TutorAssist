import { NextResponse } from 'next/server'
import { authorizeRoom, getBoard, mergeElements, sceneElements, setShownQuestion, reviewedQuestionIds, type BoardElement } from '@/lib/session-board'
import { publish, listenerCount } from '@/lib/live-bus'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Current board, or (tutor, ?q=) a search of the workspace's questions to show. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await authorizeRoom(id, request.headers.get('cookie'))
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const q = new URL(request.url).searchParams.get('q')
  if (q !== null) {
    if (!access.isTutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const supabase = await createServerClient()
    let query = supabase
      .from('questions')
      .select('id, prompt_text, prompt_latex, difficulty, topics(name)')
      .eq('workspace_id', access.session.workspace_id)
      .eq('library', 'workspace')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20)
    if (q.trim()) query = query.ilike('prompt_text', `%${q.trim()}%`)
    const { data } = await query
    return NextResponse.json({ questions: data || [] })
  }

  const board = await getBoard(id, access.session.workspace_id)
  return NextResponse.json({
    elements: sceneElements(board).filter(e => !e.isDeleted),
    files: [...board.files.values()].map(f => ({ id: f.id, mimeType: f.mimeType })),
    question: board.question,
    reviewed: access.isTutor ? await reviewedQuestionIds(id) : [],
    me: { name: access.name, isTutor: access.isTutor },
    online: listenerCount(`board:${id}`),
  })
}

/** Board updates: changed elements, the question on show, or a pointer position. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await authorizeRoom(id, request.headers.get('cookie'))
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => null) as { type?: string; clientId?: string; elements?: BoardElement[]; questionId?: string | null; pointer?: unknown; button?: string } | null
  if (!body?.type || typeof body.clientId !== 'string') return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const room = `board:${id}`

  if (body.type === 'pointer') {
    publish(room, { type: 'pointer', from: body.clientId, name: access.name, isTutor: access.isTutor, pointer: body.pointer, button: body.button })
    return NextResponse.json({ ok: true })
  }

  const board = await getBoard(id, access.session.workspace_id)
  if (body.type === 'elements' && Array.isArray(body.elements)) {
    if (body.elements.length > 2000) return NextResponse.json({ error: 'Too many elements' }, { status: 413 })
    const changed = mergeElements(board, body.elements)
    if (changed.length) publish(room, { type: 'elements', from: body.clientId, elements: changed })
    return NextResponse.json({ ok: true, accepted: changed.length })
  }
  if (body.type === 'question') {
    if (!access.isTutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const question = await setShownQuestion(board, body.questionId ?? null)
    publish(room, { type: 'question', from: body.clientId, question })
    return NextResponse.json({ ok: true, question, reviewed: await reviewedQuestionIds(id) })
  }
  return NextResponse.json({ error: 'Unknown update' }, { status: 400 })
}
