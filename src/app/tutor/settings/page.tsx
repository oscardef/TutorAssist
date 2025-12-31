import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { SettingsForms } from '@/components/settings-forms'

export default async function TutorSettingsPage({
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
    .select('id, name')
    .eq('id', context?.workspaceId)
    .maybeSingle()
  
  // Get any existing workspace invite token (for general invites, not student-specific)
  const { data: inviteTokenData } = await supabase
    .from('invite_tokens')
    .select('token')
    .eq('workspace_id', context?.workspaceId)
    .is('student_profile_id', null)  // General invite, not tied to a specific student
    .is('used_at', null)  // Not used yet
    .gt('expires_at', new Date().toISOString())  // Not expired
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  // Check Google connection
  const { data: googleConnection } = await supabase
    .from('oauth_connections')
    .select('provider_user_id, created_at')
    .eq('user_id', user?.id)
    .eq('provider', 'google')
    .maybeSingle()

  const success = params?.success
  const error = params?.error
  
  // Get user metadata for full name
  const metadata = user?.user_metadata || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your profile, workspace, and integrations
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

      <SettingsForms 
        workspace={workspace ? { ...workspace, invite_token: inviteTokenData?.token || null } : null}
        googleConnection={googleConnection}
        user={{ 
          email: user?.email || '',
          fullName: metadata.full_name || null
        }}
        role={context?.role || 'tutor'}
      />
    </div>
  )
}
