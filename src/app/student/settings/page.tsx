import { requireUser, getUserContext } from '@/lib/auth'
import { CalendarFeedCard } from '@/components/calendar-feed-card'
import { AccountDataCard } from '@/components/account-data-card'
import { createServerClient } from '@/lib/supabase/server'
import { getUserById } from '@/lib/users'
import { StudentSettingsForms } from '@/components/student-settings-forms'
import { isSoloWorkspace } from '@/lib/student-plan'
import { CourseCard } from './CourseCard'

export default async function StudentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const user = await requireUser()
  const context = await getUserContext()
  const supabase = await createServerClient()
  const params = await searchParams
  
  // Get workspace info
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', context?.workspaceId)
    .maybeSingle()
  
  // Get student profile with program and grade level
  const { data: studentProfile } = await supabase
    .from('student_profiles')
    .select(`
      name,
      assigned_tutor_id,
      study_program:study_programs(code, name),
      grade_level:grade_levels(code, name)
    `)
    .eq('user_id', user?.id)
    .eq('workspace_id', context?.workspaceId)
    .maybeSingle()
  
  // Check Google connection
  const { data: googleConnection } = await supabase
    .from('oauth_connections')
    .select('provider_user_id, created_at')
    .eq('user_id', user?.id)
    .eq('provider', 'google')
    .maybeSingle()
  
  // The assigned tutor, from the user directory (students can't read other
  // members through RLS)
  let tutorEmail: string | null = null
  if (studentProfile?.assigned_tutor_id) {
    const tutorUser = await getUserById(studentProfile.assigned_tutor_id)
    tutorEmail = tutorUser ? (tutorUser.name ? `${tutorUser.name} (${tutorUser.email})` : tutorUser.email) : null
  }

  const solo = context ? await isSoloWorkspace(context.workspaceId) : false
  const prog = Array.isArray(studentProfile?.study_program) ? studentProfile?.study_program[0] : studentProfile?.study_program
  const grade = Array.isArray(studentProfile?.grade_level) ? studentProfile?.grade_level[0] : studentProfile?.grade_level

  const success = params?.success
  const error = params?.error
  
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">{solo ? 'Your profile, course and account.' : 'Your profile, calendar and account.'}</p>
      </div>
      
      {success === 'google_connected' && (
        <div className="alert-success" role="status">Google calendar connected.</div>
      )}
      
      {error && (
        <div className="alert-error" role="alert">Google calendar didn&apos;t connect. Try again.</div>
      )}

      {solo && <CourseCard program={(prog as { code: string } | null)?.code ?? null} grade={(grade as { code: string } | null)?.code ?? null} />}

      <StudentSettingsForms
        workspace={workspace}
        googleConnection={googleConnection}
        user={{ 
          email: user?.email || '',
          fullName: user.name || null
        }}
        role={context?.role || 'student'}
        tutorEmail={tutorEmail}
        solo={solo}
        studentProfile={studentProfile ? {
          name: studentProfile.name,
          study_program: (() => {
            const prog = studentProfile.study_program
            if (Array.isArray(prog)) return prog[0] as { code: string; name: string } | null
            return prog as { code: string; name: string } | null
          })(),
          grade_level: (() => {
            const grade = studentProfile.grade_level
            if (Array.isArray(grade)) return grade[0] as { code: string; name: string } | null
            return grade as { code: string; name: string } | null
          })()
        } : null}
      />
      <div className="mt-6">
        {!solo && <CalendarFeedCard />}
        <div className={solo ? '' : 'mt-6'}><AccountDataCard email={user.email} isTutor={false} /></div>
      </div>
    </div>
  )
}
