'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SettingsFormsProps {
  workspace: {
    id: string
    name: string
    invite_token: string | null
  } | null
  googleConnection: {
    provider_user_id: string
    created_at: string
  } | null
  user: {
    email: string
    fullName: string | null
  }
  role: string
}

export function SettingsForms({ workspace, googleConnection, user, role }: SettingsFormsProps) {
  const router = useRouter()
  
  // Form states
  const [fullName, setFullName] = useState(user.fullName || '')
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '')
  const [inviteToken, setInviteToken] = useState(workspace?.invite_token)
  
  // Loading states
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)
  
  // UI states
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const inviteUrl = inviteToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteToken}`
    : null

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

  const handleSaveWorkspace = async () => {
    if (!workspaceName.trim()) return
    setSavingWorkspace(true)

    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName.trim() }),
      })

      if (!res.ok) throw new Error('Failed to save')
      showToast('success', 'Workspace name updated')
      router.refresh()
    } catch {
      showToast('error', 'Failed to update workspace')
    } finally {
      setSavingWorkspace(false)
    }
  }

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true)

    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invite' }),
      })

      if (!res.ok) throw new Error('Failed to generate')
      
      const data = await res.json()
      setInviteToken(data.invite_token)
      showToast('success', 'New invite link generated')
    } catch {
      showToast('error', 'Failed to generate invite link')
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleCopyInvite = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('error', 'Failed to copy')
    }
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect Google Calendar? Sessions will no longer sync automatically.')) return
    
    setDisconnectingGoogle(true)

    try {
      const res = await fetch('/api/settings/google', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disconnect')
      showToast('success', 'Google Calendar disconnected')
      router.refresh()
    } catch {
      showToast('error', 'Failed to disconnect')
    } finally {
      setDisconnectingGoogle(false)
    }
  }

  const hasProfileChanges = fullName !== (user.fullName || '') && fullName.trim()
  const hasWorkspaceChanges = workspaceName !== (workspace?.name || '') && workspaceName.trim()

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
              <p className="text-xs text-gray-500 mt-1.5">This is how you appear to students</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                {user.email}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Workspace</h2>
            <p className="text-sm text-gray-500">Manage your tutoring workspace</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Tutoring Workspace"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSaveWorkspace}
                  disabled={savingWorkspace || !hasWorkspaceChanges}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {savingWorkspace ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Visible to your students</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Invite Link</label>
              {inviteUrl ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteUrl}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 font-mono text-xs"
                    />
                    <button
                      onClick={handleCopyInvite}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                        copied 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <button
                    onClick={handleGenerateInvite}
                    disabled={generatingInvite}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {generatingInvite ? 'Generating...' : 'Generate new link'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {generatingInvite ? 'Generating...' : 'Generate Invite Link'}
                </button>
              )}
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
                      <p className="text-sm text-gray-500">Auto-create events with Meet links</p>
                    </>
                  )}
                </div>
              </div>
              
              {googleConnection ? (
                <div className="flex items-center gap-2">
                  <a
                    href="/api/auth/google"
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
                  href="/api/auth/google"
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
