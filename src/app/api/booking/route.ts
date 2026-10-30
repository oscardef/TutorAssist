import { NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/auth'
import { bookableTutors, bookSlot, BookingError } from '@/lib/booking'

/** A student books a free slot with a tutor in their workspace. */
export async function POST(request: Request) {
  const context = await requireUserContext()
  if (context.role !== 'student') return NextResponse.json({ error: 'Only students book sessions here' }, { status: 403 })
  const { tutorId, start } = await request.json().catch(() => ({})) as { tutorId?: string; start?: string }
  if (!tutorId || !start) return NextResponse.json({ error: 'tutorId and start are required' }, { status: 400 })
  const tutor = (await bookableTutors(context.workspaceId)).find(t => t.row.tutor_user_id === tutorId)
  if (!tutor) return NextResponse.json({ error: 'Tutor not taking bookings' }, { status: 404 })
  try {
    const session = await bookSlot(tutor.row, context.userId, start)
    return NextResponse.json({ session })
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}
