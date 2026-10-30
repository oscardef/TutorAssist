import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { authorizeRoom } from '@/lib/session-board'
import { getUserById } from '@/lib/users'
import { createAdminClient } from '@/lib/supabase/server'
import SessionRoom from './SessionRoom'

export const dynamic = 'force-dynamic'

export default async function SessionRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect(`/login?next=/session/${id}`)
  const access = await authorizeRoom(id, (await headers()).get('cookie'))
  if (!access) notFound()
  const student = access.session.student_id ? await getUserById(access.session.student_id) : null
  // Needed to assign follow-up practice; older sessions may not store it
  let studentProfileId = access.session.student_profile_id
  if (!studentProfileId && access.isTutor && access.session.student_id) {
    const admin = await createAdminClient()
    const { data } = await admin.from('student_profiles').select('id').eq('workspace_id', access.session.workspace_id).eq('user_id', access.session.student_id).maybeSingle()
    studentProfileId = data?.id ?? null
  }

  return (
    <SessionRoom
      sessionId={id}
      isTutor={access.isTutor}
      myName={access.name}
      title={access.isTutor ? `Session with ${student?.name || student?.email || 'your student'}` : 'Your session'}
      meetLink={access.session.meet_link}
      scheduledAt={access.session.scheduled_at}
      durationMinutes={access.session.duration_minutes}
      initialNotes={access.session.session_notes || ''}
      startedAt={access.session.actual_start}
      backHref={access.isTutor ? '/tutor/sessions' : '/student/dashboard'}
      studentProfileId={studentProfileId}
    />
  )
}
