import { NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/auth'
import { cancelSession, BookingError } from '@/lib/booking'

/** Cancel an upcoming session: its student (within the notice period) or a tutor of the workspace. */
export async function POST(request: Request) {
  const context = await requireUserContext()
  const { sessionId } = await request.json().catch(() => ({})) as { sessionId?: string }
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  const isTutor = context.role === 'tutor' || context.role === 'platform_owner'
  try {
    if (isTutor) {
      // Tutors may only cancel sessions in their own workspace
      const { createServerClient } = await import('@/lib/supabase/server')
      const supabase = await createServerClient()
      const { data } = await supabase.from('sessions').select('id').eq('id', sessionId).eq('workspace_id', context.workspaceId).maybeSingle()
      if (!data) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    await cancelSession(sessionId, context.userId, isTutor)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}
