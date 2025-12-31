import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
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
  
  // Check Google connection
  const { data: googleConnection } = await supabase
    .from('oauth_connections')
    .select('provider_user_id, created_at')
    .eq('user_id', user?.id)
    .eq('provider', 'google')
    .maybeSingle()
  
  // Get tutor info
  const { data: tutorMember } = await supabase
    .from('workspace_members')
    .select('users(email)')
    .eq('workspace_id', context?.workspaceId)
    .eq('role', 'tutor')
    .maybeSingle()
  
  // Extract tutor email
  const tutorEmail = (() => {
    const users = tutorMember?.users as { email: string }[] | { email: string } | undefined
    if (Array.isArray(users)) return users[0]?.email || null
    return users?.email || null
  })()

  const success = params?.success
  const error = params?.error
  
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account and integrations
        </p>
      </div>
      
      {success === 'google_connected' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ Google Calendar connected successfully! You&apos;ll now receive calendar invites for tutoring sessions.
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Failed to connect Google Calendar. Please try again.
        </div>
      )}

      <StudentSettingsForms
        workspace={workspace}
        googleConnection={googleConnection}
        user={{ email: user?.email || '' }}
        role={context?.role || 'student'}
        tutorEmail={tutorEmail}
      />
    </div>
  )
}
