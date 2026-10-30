import { createAdminClient } from '@/lib/supabase/server'
import { getUsersByIds } from '@/lib/users'

export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/**
 * ICS feed of a user's sessions (as tutor or student), from 30 days back.
 * The unguessable token in the URL is the only credential, as with Google's
 * secret calendar addresses; it can be replaced from settings.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = await createAdminClient()
  const { data: feed } = await admin.from('calendar_feeds').select('user_id').eq('token', token).maybeSingle()
  if (!feed) return new Response('Not found', { status: 404 })

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: sessions } = await admin
    .from('sessions')
    .select('id, tutor_id, student_id, scheduled_at, duration_minutes, status, meet_link, updated_at')
    .or(`tutor_id.eq.${feed.user_id},student_id.eq.${feed.user_id}`)
    .gte('scheduled_at', since)
    .order('scheduled_at')
    .limit(500)
  const people = await getUsersByIds([...new Set((sessions || []).flatMap(s => [s.tutor_id, s.student_id]).filter(Boolean) as string[])])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mathium//Sessions//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Mathium sessions']
  for (const s of sessions || []) {
    const start = new Date(s.scheduled_at)
    const end = new Date(start.getTime() + (s.duration_minutes || 60) * 60_000)
    const other = people.get(s.tutor_id === feed.user_id ? s.student_id : s.tutor_id)
    const room = `${appUrl}/session/${s.id}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@mathium.app`,
      `DTSTAMP:${stamp(new Date(s.updated_at || Date.now()))}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`Maths session${other?.name ? ` with ${other.name}` : ''}`)}`,
      `DESCRIPTION:${esc(`Session room: ${room}${s.meet_link ? `\nVideo call: ${s.meet_link}` : ''}`)}`,
      `URL:${room}`,
      `STATUS:${s.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
  })
}
