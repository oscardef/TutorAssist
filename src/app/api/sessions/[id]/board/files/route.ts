import { NextResponse } from 'next/server'
import { authorizeRoom, getBoard, addBoardFile, BOARD_IMAGE_TYPES, BOARD_IMAGE_MAX_BYTES } from '@/lib/session-board'
import { uploadFile } from '@/lib/storage'
import { publish } from '@/lib/live-bus'

/** Store an image pasted onto the board (sent once, by whoever added it). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await authorizeRoom(id, request.headers.get('cookie'))
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => null) as { clientId?: string; id?: string; mimeType?: string; dataURL?: string } | null
  if (!body?.id || !/^[A-Za-z0-9_-]{8,80}$/.test(body.id) || typeof body.dataURL !== 'string') return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const m = body.dataURL.match(/^data:([a-z/+-]+);base64,(.+)$/)
  const mimeType = m?.[1] ?? ''
  if (!m || !BOARD_IMAGE_TYPES.includes(mimeType)) return NextResponse.json({ error: 'Only PNG, JPEG, GIF or WebP images' }, { status: 415 })
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > BOARD_IMAGE_MAX_BYTES) return NextResponse.json({ error: 'Image too large (8 MB max)' }, { status: 413 })

  const board = await getBoard(id, access.session.workspace_id)
  if (!board.files.has(body.id)) {
    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg')
    const { key } = await uploadFile(access.session.workspace_id, 'boards', bytes, `board.${ext}`, mimeType)
    addBoardFile(board, { id: body.id, key, mimeType })
    publish(`board:${id}`, { type: 'file', from: body.clientId, id: body.id, mimeType })
  }
  return NextResponse.json({ ok: true })
}
