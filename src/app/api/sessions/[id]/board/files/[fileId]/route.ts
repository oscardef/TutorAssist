import { NextResponse } from 'next/server'
import { authorizeRoom, getBoard } from '@/lib/session-board'
import { getFile } from '@/lib/storage'

/** An image on the board, for participants of the session only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params
  const access = await authorizeRoom(id, request.headers.get('cookie'))
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const board = await getBoard(id, access.session.workspace_id)
  const file = board.files.get(fileId)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await getFile(file.key)
  return new NextResponse(new Uint8Array(body), {
    headers: { 'Content-Type': file.mimeType, 'Cache-Control': 'private, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff' },
  })
}
