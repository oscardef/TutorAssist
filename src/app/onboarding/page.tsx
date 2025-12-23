'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [role, setRole] = useState<'tutor' | 'student' | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (role === 'tutor') {
        if (!workspaceName.trim()) {
          setError('Please enter a workspace name')
          setLoading(false)
          return
        }

        const response = await fetch('/api/workspace/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: workspaceName }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to create workspace')
          return
        }

        console.log('Workspace created successfully:', data)
        
        // Force a full page reload to ensure middleware sees the new membership
        window.location.href = '/tutor/dashboard'
      } else if (role === 'student') {
        if (!inviteToken.trim()) {
          setError('Please enter an invite code')
          setLoading(false)
          return
        }

        const response = await fetch('/api/workspace/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteToken }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to join workspace')
          return
        }

        console.log('Joined workspace successfully:', data)
        
        // Force a full page reload to ensure middleware sees the new membership
        window.location.href = '/student/dashboard'
      }
    } catch (err) {
      console.error('Onboarding error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to TutorAssist</h1>
          <p className="mt-2 text-sm text-gray-600">
            Let&apos;s get you set up. Are you a tutor or a student?
          </p>
        </div>

        {!role ? (
          <div className="mt-8 space-y-4">
            <button
              onClick={() => setRole('tutor')}
              className="w-full rounded-lg border-2 border-gray-200 p-6 text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">I&apos;m a Tutor</h3>
                  <p className="text-sm text-gray-600">Create a workspace and invite students</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setRole('student')}
              className="w-full rounded-lg border-2 border-gray-200 p-6 text-left hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">I&apos;m a Student</h3>
                  <p className="text-sm text-gray-600">Join your tutor&apos;s workspace with an invite</p>
                </div>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {role === 'tutor' ? (
              <div>
                <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-700">
                  Workspace Name
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  This is the name of your tutoring practice (e.g., &quot;Math with Oscar&quot;)
                </p>
                <input
                  id="workspaceName"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="My Tutoring Practice"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="inviteToken" className="block text-sm font-medium text-gray-700">
                  Invite Code
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the invite code your tutor shared with you
                </p>
                <input
                  id="inviteToken"
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  required
                  className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="abc123..."
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRole(null)
                  setError(null)
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Please wait...' : role === 'tutor' ? 'Create Workspace' : 'Join Workspace'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
