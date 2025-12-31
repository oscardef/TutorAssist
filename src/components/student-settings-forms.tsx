'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface StudentSettingsFormsProps {
  googleConnection: {
    provider_user_id: string
    created_at: string
  } | null
  user: {
    email: string
  }
  role: string
  workspace: {
    name: string
  } | null
  tutorEmail: string | null
}

export function StudentSettingsForms({ 
  googleConnection, 
  user, 
  role, 
  workspace, 
  tutorEmail 
}: StudentSettingsFormsProps) {
  const router = useRouter()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return
    
    setIsDisconnecting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/google', {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to disconnect')
      
      setMessage({ type: 'success', text: 'Google Calendar disconnected' })
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect Google Calendar' })
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? '✓ ' : '✕ '}{message.text}
        </div>
      )}

      {/* Workspace Info */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">My Workspace</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your tutoring workspace information</p>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Workspace
              </label>
              <div className="text-gray-900">{workspace?.name || 'My Workspace'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Tutor
              </label>
              <div className="text-gray-900">{tutorEmail || 'Not assigned'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Google Calendar Integration */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Google Calendar</h2>
          <p className="text-sm text-gray-500 mt-0.5">Get tutoring sessions on your calendar</p>
        </div>
        
        <div className="p-6">
          {googleConnection ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Connected</div>
                  <div className="text-sm text-gray-500">{googleConnection.provider_user_id}</div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600">
                Tutoring sessions will automatically appear in your Google Calendar with Google Meet links.
              </p>
              
              <div className="flex gap-3">
                <a
                  href="/api/auth/google?returnTo=/student/settings"
                  className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reconnect
                </a>
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={isDisconnecting}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                Connect Google Calendar to automatically receive calendar invites for your tutoring sessions
                with Google Meet links.
              </p>
              
              <a
                href="/api/auth/google?returnTo=/student/settings"
                className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Calendar
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Account */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Account</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your account information</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Email
              </label>
              <div className="text-gray-900">{user.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Role
              </label>
              <div className="text-gray-900 capitalize">{role}</div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100">
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
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
