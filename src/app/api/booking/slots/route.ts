import { NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { bookableTutors, freeSlots } from '@/lib/booking'

/**
 * Free slots with a tutor in the caller's workspace. Defaults to the
 * student's assigned tutor, then to the only tutor taking bookings.
 */
export async function GET(request: Request) {
  const context = await requireUserContext()
  const tutors = await bookableTutors(context.workspaceId)
  if (tutors.length === 0) return NextResponse.json({ tutors: [], tutorId: null, slots: [] })

  let tutorId = new URL(request.url).searchParams.get('tutorId')
  if (!tutorId) {
    const supabase = await createServerClient()
    const { data: profile } = await supabase.from('student_profiles').select('assigned_tutor_id').eq('workspace_id', context.workspaceId).eq('user_id', context.userId).maybeSingle()
    tutorId = tutors.find(t => t.row.tutor_user_id === profile?.assigned_tutor_id)?.row.tutor_user_id ?? tutors[0].row.tutor_user_id
  }
  const tutor = tutors.find(t => t.row.tutor_user_id === tutorId)
  if (!tutor) return NextResponse.json({ error: 'Tutor not taking bookings' }, { status: 404 })

  const slots = await freeSlots(tutor.row, Date.now())
  return NextResponse.json({
    tutors: tutors.map(t => ({ id: t.row.tutor_user_id, name: t.name })),
    tutorId,
    timezone: tutor.row.timezone,
    slotMinutes: tutor.row.slot_minutes,
    cancelNoticeHours: tutor.row.cancel_notice_hours,
    slots: slots.map(s => new Date(s).toISOString()),
  })
}
