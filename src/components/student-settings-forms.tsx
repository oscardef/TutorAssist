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
    fullName?: string | null
  }
  role: string
  workspace: {
    name: string
  } | null
  tutorEmail: string | null
  studentProfile?: {
    name: string | null
    study_program?: { code: string; name: string } | null
    grade_level?: { code: string; name: string } | null
  } | null
}

export function StudentSettingsForms({ 
  googleConnection, 
  user, 
  role, 
  workspace, 
  tutorEmail,
  studentProfile 
}: StudentSettingsFormsProps) {
  const router = useRouter()
  
  // Form states
  const [fullName, setFullName] = useState(user.fullName || studentProfile?.name || '')
  
  // Loading states
  const [savingProfile, setSavingProfile] = useState(false)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)
  
  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSaveProfile = async () => {
    if (!fullName.trim()) return
    setSavingProfile(true)

    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() }),
      })

      if (!res.ok) throw new Error('Failed to save')
      showToast('success', 'Profile updated successfully')
      router.refresh()
    } catch {
      showToast('error', 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return
    
    setDisconnectingGoogle(true)

    try {
      const res = await fetch('/api/settings/google', {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to disconnect')
      showToast('success', 'Google Calendar disconnected')
      router.refresh()
    } catch {
      showToast('error', 'Failed to disconnect Google Calendar')
    } finally {
      setDisconnectingGoogle(false)
    }
  }

  const hasProfileChanges = fullName !== (user.fullName || studentProfile?.name || '') && fullName.trim()

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
          toast.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.text}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Profile</h2>
            <p className="text-sm text-gray-500">Your personal information</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile || !hasProfileChanges}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {savingProfile ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                {user.email}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                {role}
              </span>
            </div>

            {/* Program & Grade Level */}
            {(studentProfile?.study_program || studentProfile?.grade_level) && (
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Info</label>
                <div className="flex flex-wrap gap-2">
                  {studentProfile?.study_program && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {studentProfile.study_program.name}
                    </span>
                  )}
                  {studentProfile?.grade_level && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {studentProfile.grade_level.name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Workspace</h2>
            <p className="text-sm text-gray-500">Your tutoring workspace</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace Name</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-medium">
                {workspace?.name || 'My Workspace'}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Tutor</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div className="text-sm text-gray-900">
                  {tutorEmail || 'Not assigned'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Google Calendar Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Google Calendar</h2>
            <p className="text-sm text-gray-500">Sync sessions with your calendar</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  googleConnection ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div>
                  {googleConnection ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Connected</span>
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      </div>
                      <p className="text-sm text-gray-500">{googleConnection.provider_user_id}</p>
                    </>
                  ) : (
                    <>
                      <div className="font-medium text-gray-900">Not connected</div>
                      <p className="text-sm text-gray-500">Get session invites with Meet links</p>
                    </>
                  )}
                </div>
              </div>
              
              {googleConnection ? (
                <div className="flex items-center gap-2">
                  <a
                    href="/api/auth/google?returnTo=/student/settings"
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Reconnect
                  </a>
                  <button
                    onClick={handleDisconnectGoogle}
                    disabled={disconnectingGoogle}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 transition-colors"
                  >
                    {disconnectingGoogle ? '...' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/google?returnTo=/student/settings"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
                >
                  Connect
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Account Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Account</h2>
            <p className="text-sm text-gray-500">Manage your account</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Sign Out</div>
                <p className="text-sm text-gray-500">Sign out on this device</p>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
