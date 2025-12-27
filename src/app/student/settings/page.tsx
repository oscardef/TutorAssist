import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
    .single()
  
  // Check Google connection
  const { data: googleConnection } = await supabase
    .from('oauth_connections')
    .select('provider_user_id, created_at')
    .eq('user_id', user?.id)
    .eq('provider', 'google')
    .single()
  
  // Get tutor info
  const { data: tutorMember } = await supabase
    .from('workspace_members')
    .select('users(email)')
    .eq('workspace_id', context?.workspaceId)
    .eq('role', 'tutor')
    .single()
  
  const success = params.success
  const error = params.error
  
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and integrations.</p>
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
      
      {/* Workspace Info */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Workspace</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workspace
            </label>
            <div className="text-gray-900">{workspace?.name || 'My Workspace'}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tutor
            </label>
            <div className="text-gray-900">
              {(() => {
                const users = tutorMember?.users as { email: string }[] | undefined
                return users?.[0]?.email || 'Not assigned'
              })()}
            </div>
          </div>
        </div>
      </section>
      
      {/* Google Calendar Integration */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Google Calendar</h2>
        
        {googleConnection ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-lg">✓</span>
              </div>
              <div>
                <div className="font-medium text-gray-900">Connected</div>
                <div className="text-sm text-gray-500">
                  {googleConnection.provider_user_id}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600">
              Tutoring sessions will automatically appear in your Google Calendar with Google Meet links.
            </p>
            
            <Link
              href="/api/auth/google?returnTo=/student/settings"
              className="inline-block px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Reconnect
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Connect Google Calendar to automatically receive calendar invites for your tutoring sessions
              with Google Meet links.
            </p>
            
            <Link
              href="/api/auth/google?returnTo=/student/settings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Connect Google Calendar
            </Link>
          </div>
        )}
      </section>
      
      {/* Account */}
      <section className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="text-gray-900">{user?.email}</div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <div className="text-gray-900 capitalize">{context?.role}</div>
          </div>
          
          <div className="pt-4 border-t">
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
