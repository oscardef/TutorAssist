import { createAdminClient } from '@/lib/supabase/server'
import { computeSlots, normaliseWindows, type BookingSettings } from '@/lib/scheduling'
import { getBusyIntervals, syncSessionToCalendar, deleteCalendarEvent } from '@/lib/google/calendar'
import { getUserById, getUsersByIds } from '@/lib/users'
import { sendEmail } from '@/lib/email'
import { sessionEmail } from '@/lib/email-templates'
import { formatLongDay, formatTime } from '@/lib/dates'

/**
 * Self-service booking on top of booking_settings (migration 0009). All
 * reads here use the service role after the API route has checked who is
 * asking, because a student needs a tutor's busy times without seeing their
 * sessions.
 */

export interface BookingRow {
  workspace_id: string
  tutor_user_id: string
  enabled: boolean
  timezone: string
  slot_minutes: number
  buffer_minutes: number
  min_notice_hours: number
  max_days_ahead: number
  cancel_notice_hours: number
  windows: unknown
}

export const DEFAULT_BOOKING: Omit<BookingRow, 'workspace_id' | 'tutor_user_id'> = {
  enabled: false, timezone: 'Europe/Zurich', slot_minutes: 60, buffer_minutes: 15, min_notice_hours: 24, max_days_ahead: 28, cancel_notice_hours: 24, windows: [],
}

export function toSettings(row: BookingRow): BookingSettings {
  return { timezone: row.timezone, slotMinutes: row.slot_minutes, bufferMinutes: row.buffer_minutes, minNoticeHours: row.min_notice_hours, maxDaysAhead: row.max_days_ahead }
}

/** Tutors in the workspace who take bookings, with names. */
export async function bookableTutors(workspaceId: string) {
  const admin = await createAdminClient()
  const { data } = await admin.from('booking_settings').select('*').eq('workspace_id', workspaceId).eq('enabled', true)
  const rows = (data || []) as BookingRow[]
  const users = await getUsersByIds(rows.map(r => r.tutor_user_id))
  return rows.map(r => ({ row: r, name: users.get(r.tutor_user_id)?.name || users.get(r.tutor_user_id)?.email || 'Tutor' }))
}

export async function freeSlots(row: BookingRow, nowMs: number): Promise<number[]> {
  const admin = await createAdminClient()
  const from = new Date(nowMs - 86_400_000)
  const to = new Date(nowMs + (row.max_days_ahead + 2) * 86_400_000)
  const { data: sessions } = await admin
    .from('sessions')
    .select('scheduled_at, duration_minutes')
    .eq('tutor_id', row.tutor_user_id)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())
  const busy = (sessions || []).map(s => {
    const start = new Date(s.scheduled_at).getTime()
    return { start, end: start + (s.duration_minutes || 60) * 60_000 }
  })
  busy.push(...await getBusyIntervals(row.tutor_user_id, from, to))
  return computeSlots(normaliseWindows(row.windows), busy, toSettings(row), nowMs)
}

function formatWhen(iso: string, timeZone: string) {
  return `${formatLongDay(iso, { tz: timeZone })} at ${formatTime(iso, { tz: timeZone })} (${timeZone.replace(/_/g, ' ')})`
}

async function notify(kind: 'booked' | 'cancelled', tutorId: string, studentId: string, iso: string, timeZone: string) {
  const [tutor, student] = await Promise.all([getUserById(tutorId), getUserById(studentId)])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const when = formatWhen(iso, timeZone)
  const jobs: Promise<unknown>[] = []
  if (tutor?.email) jobs.push(sendEmail({ to: tutor.email, subject: `Session ${kind}: ${when}`, html: sessionEmail({ name: tutor.name || '', kind, when, withName: student?.name || student?.email || 'your student', url: `${appUrl}/tutor/sessions` }) }))
  if (student?.email) jobs.push(sendEmail({ to: student.email, subject: `Session ${kind}: ${when}`, html: sessionEmail({ name: student.name || '', kind, when, withName: tutor?.name || 'your tutor', url: `${appUrl}/student/dashboard` }) }))
  await Promise.allSettled(jobs)
}

export class BookingError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

/** Book `startIso` with the tutor for the student, if it is still free. */
export async function bookSlot(row: BookingRow, studentUserId: string, startIso: string) {
  const start = new Date(startIso).getTime()
  if (!Number.isFinite(start)) throw new BookingError('Invalid time')
  const slots = await freeSlots(row, Date.now())
  if (!slots.includes(start)) throw new BookingError('That time is no longer free. Pick another one.', 409)

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('student_profiles').select('id').eq('workspace_id', row.workspace_id).eq('user_id', studentUserId).maybeSingle()
  const { data: session, error } = await admin
    .from('sessions')
    .insert({
      workspace_id: row.workspace_id,
      tutor_id: row.tutor_user_id,
      student_id: studentUserId,
      student_profile_id: profile?.id ?? null,
      scheduled_at: new Date(start).toISOString(),
      duration_minutes: row.slot_minutes,
      status: 'scheduled',
      booked_by: studentUserId,
    })
    .select('id, scheduled_at, duration_minutes')
    .single()
  if (error) {
    // The unique index catches two students taking the same slot at once
    if (error.code === '23505') throw new BookingError('Someone just booked that time. Pick another one.', 409)
    throw new BookingError(error.message, 500)
  }
  try { await syncSessionToCalendar(session.id) } catch { /* Google not connected: the session still stands */ }
  await notify('booked', row.tutor_user_id, studentUserId, session.scheduled_at, row.timezone)
  return session
}

/** Cancel a session. Students must respect the tutor's notice period. */
export async function cancelSession(sessionId: string, byUserId: string, isTutor: boolean) {
  const admin = await createAdminClient()
  const { data: s } = await admin.from('sessions').select('id, workspace_id, tutor_id, student_id, scheduled_at, status, google_event_id').eq('id', sessionId).maybeSingle()
  if (!s) throw new BookingError('Session not found', 404)
  if (!isTutor && s.student_id !== byUserId) throw new BookingError('Session not found', 404)
  if (!['scheduled', 'confirmed'].includes(s.status)) throw new BookingError('This session is not upcoming')
  const { data: settings } = await admin.from('booking_settings').select('cancel_notice_hours, timezone').eq('workspace_id', s.workspace_id).eq('tutor_user_id', s.tutor_id).maybeSingle()
  const noticeHours = settings?.cancel_notice_hours ?? DEFAULT_BOOKING.cancel_notice_hours
  if (!isTutor && new Date(s.scheduled_at).getTime() - Date.now() < noticeHours * 3_600_000) {
    throw new BookingError(`Sessions can be cancelled up to ${noticeHours} hours before they start. Message your tutor instead.`, 409)
  }
  const { error } = await admin.from('sessions').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: byUserId }).eq('id', sessionId)
  if (error) throw new BookingError(error.message, 500)
  if (s.google_event_id && s.tutor_id) { try { await deleteCalendarEvent(s.tutor_id, s.google_event_id) } catch { /* event already gone or Google not connected */ } }
  if (s.student_id && s.tutor_id) await notify('cancelled', s.tutor_id, s.student_id, s.scheduled_at, settings?.timezone ?? DEFAULT_BOOKING.timezone)
}
