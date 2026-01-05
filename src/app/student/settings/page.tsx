import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { StudentSettingsForms } from '@/components/student-settings-forms'

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
  
  // Get tutor info - first get the tutor's user_id
  const { data: tutorMember } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', context?.workspaceId)
    .eq('role', 'tutor')
    .maybeSingle()
  
  // Get tutor email using admin client (to access auth.users)
  let tutorEmail: string | null = null
  if (tutorMember?.user_id) {
    const adminSupabase = await createAdminClient()
    const { data: tutorUser } = await adminSupabase.auth.admin.getUserById(tutorMember.user_id)
    tutorEmail = tutorUser?.user?.email || null
  }

  const success = params?.success
  const error = params?.error
  
  // Get user metadata for full name
  const metadata = user?.user_metadata || {}
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your profile and integrations
        </p>
      </div>
      
      {success === 'google_connected' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Google Calendar connected successfully!
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Failed to connect Google Calendar. Please try again.
        </div>
      )}

      <StudentSettingsForms
        workspace={workspace}
        googleConnection={googleConnection}
        user={{ 
          email: user?.email || '',
          fullName: metadata.full_name || null
        }}
        role={context?.role || 'student'}
        tutorEmail={tutorEmail}
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
    </div>
  )
}
