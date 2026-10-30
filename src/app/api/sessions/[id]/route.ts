import { NextResponse } from 'next/server'
import { authorizeRoom } from '@/lib/session-board'
import { createServerClient } from '@/lib/supabase/server'

/** Tutor updates from the session room: notes, start and end. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await authorizeRoom(id, request.headers.get('cookie'))
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!access.isTutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { notes?: string; action?: 'start' | 'end' }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.notes === 'string') updates.session_notes = body.notes.slice(0, 20000)
  if (body.action === 'start' && !access.session.actual_start) updates.actual_start = new Date().toISOString()
  if (body.action === 'end') { updates.actual_end = new Date().toISOString(); updates.status = 'completed' }
  const supabase = await createServerClient()
  const { data, error } = await supabase.from('sessions').update(updates).eq('id', id).select('id, status, actual_start, actual_end, session_notes').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}
