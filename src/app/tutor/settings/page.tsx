import { requireUser, getUserContext } from '@/lib/auth'
import { AccountDataCard } from '@/components/account-data-card'
import { AiPrivacyCard } from '@/components/ai-privacy-card'
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
    .select('id, name, settings_json')
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
  

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your profile, workspace, and integrations
        </p>
      </div>
      
      {success === 'google_connected' && (
        <div className="alert-success" role="status">Google calendar connected.</div>
      )}
      
      {error && (
        <div className="alert-error" role="alert">Google calendar didn&apos;t connect. Try again.</div>
      )}

      <SettingsForms 
        workspace={workspace ? { ...workspace, invite_token: inviteTokenData?.token || null } : null}
        googleConnection={googleConnection}
        user={{ 
          email: user?.email || '',
          fullName: user.name || null
        }}
        role={context?.role || 'tutor'}
      />
      <div className="mt-6">
        <AiPrivacyCard initial={(workspace?.settings_json as { ai_student_data?: boolean } | null)?.ai_student_data !== false} />
      </div>
      <div className="mt-6">
        <AccountDataCard email={user.email} isTutor />
      </div>
    </div>
  )
}
