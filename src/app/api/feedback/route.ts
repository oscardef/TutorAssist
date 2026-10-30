import { NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { ERROR_TAGS } from '@/lib/feedback'

/** Tutor notes on attempts (table tutor_feedback; RLS hides private notes from students). */
export async function GET(request: Request) {
  await requireUserContext()
  const ids = (new URL(request.url).searchParams.get('attemptIds') || '').split(',').filter(Boolean).slice(0, 100)
  if (ids.length === 0) return NextResponse.json({ feedback: [] })
  const supabase = await createServerClient()
  const { data, error } = await supabase.from('tutor_feedback').select('id, attempt_id, comment, error_tags, is_private, created_at').in('attempt_id', ids).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}

export async function POST(request: Request) {
  const context = await requireUserContext()
  if (context.role !== 'tutor' && !context.isPlatformOwner) return NextResponse.json({ error: 'Only tutors leave feedback' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { attemptId?: string; comment?: string; errorTags?: string[]; isPrivate?: boolean }
  const comment = (body.comment || '').trim().slice(0, 4000)
  const tags = (body.errorTags || []).filter(t => ERROR_TAGS.includes(t)).slice(0, 6)
  if (!body.attemptId || (!comment && tags.length === 0)) return NextResponse.json({ error: 'Write a note or pick a tag' }, { status: 400 })
  const supabase = await createServerClient()
  const { data: attempt } = await supabase.from('attempts').select('id, student_user_id').eq('id', body.attemptId).eq('workspace_id', context.workspaceId).maybeSingle()
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  const { data, error } = await supabase
    .from('tutor_feedback')
    .insert({ workspace_id: context.workspaceId, tutor_user_id: context.userId, student_user_id: attempt.student_user_id, attempt_id: attempt.id, comment, error_tags: tags, is_private: !!body.isPrivate })
    .select('id, attempt_id, comment, error_tags, is_private, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}

export async function DELETE(request: Request) {
  const context = await requireUserContext()
  if (context.role !== 'tutor' && !context.isPlatformOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const supabase = await createServerClient()
  const { error } = await supabase.from('tutor_feedback').delete().eq('id', id).eq('workspace_id', context.workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
