'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

interface InviteInfo {
  workspaceName: string
  tutorName: string
  studentName?: string
  expectedEmail?: string
  expiresAt: string
  isExpired: boolean
  isUsed: boolean
  isAlreadyClaimed: boolean
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  useEffect(() => {
    async function checkInvite() {
      try {
        // Check invite validity
        const inviteRes = await fetch(`/api/invite/${resolvedParams.token}`)
        const inviteData = await inviteRes.json()

        if (!inviteRes.ok) {
          setError(inviteData.error || 'Invalid invite link')
          setLoading(false)
          return
        }

        setInviteInfo(inviteData)

        // Check if user is authenticated and get their email
        const authRes = await fetch('/api/auth/status')
        const authData = await authRes.json()
        setIsAuthenticated(authData.authenticated)
        setCurrentUserEmail(authData.email)
      } catch (err) {
        console.error('Error checking invite:', err)
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    checkInvite()
  }, [resolvedParams.token])

  const handleJoin = async () => {
    setJoining(true)
    setError(null)

    try {
      const response = await fetch('/api/workspace/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resolvedParams.token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to join workspace')
        return
      }

      // Redirect to student dashboard
      window.location.href = '/student/dashboard'
    } catch (err) {
      console.error('Error joining workspace:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Checking invite...</p>
        </div>
      </div>
    )
  }

  if (error || !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Invalid Invite</h1>
            <p className="mt-2 text-gray-600">{error || 'This invite link is not valid.'}</p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (inviteInfo.isExpired || inviteInfo.isUsed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              {inviteInfo.isUsed ? 'Invite Already Used' : 'Invite Expired'}
            </h1>
            <p className="mt-2 text-gray-600">
              {inviteInfo.isUsed
                ? 'This invite link has already been used.'
                : 'This invite link has expired. Please ask your tutor for a new one.'}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check if the student profile was already claimed by another user
  if (inviteInfo.isAlreadyClaimed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Account Already Set Up</h1>
            <p className="mt-2 text-gray-600">
              This student account has already been claimed. If this is your account, please log in.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check for email mismatch if user is authenticated
  const emailMismatch = isAuthenticated && 
    inviteInfo.expectedEmail && 
    currentUserEmail && 
    inviteInfo.expectedEmail.toLowerCase() !== currentUserEmail.toLowerCase()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <div className="text-center">
          {/* Logo/Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">You&apos;re Invited!</h1>
          
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{inviteInfo.tutorName}</span> has invited you to join
            </p>
            <p className="mt-1 text-lg font-semibold text-blue-600">{inviteInfo.workspaceName}</p>
            {inviteInfo.studentName && (
              <p className="mt-2 text-sm text-gray-500">
                Profile: {inviteInfo.studentName}
              </p>
            )}
            {inviteInfo.expectedEmail && (
              <p className="mt-2 text-xs text-gray-400">
                For: {inviteInfo.expectedEmail}
              </p>
            )}
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Join to access your assignments, track progress, and practice with your tutor.
          </p>

          {/* Email mismatch warning */}
          {emailMismatch && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-left">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Email Mismatch</p>
                  <p className="mt-1 text-amber-700">
                    This invite is for <span className="font-medium">{inviteInfo.expectedEmail}</span> but you&apos;re signed in as <span className="font-medium">{currentUserEmail}</span>.
                  </p>
                  <p className="mt-2 text-amber-600">
                    Please sign out and create an account with the correct email.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {isAuthenticated ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="mt-6 w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {joining ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </span>
              ) : (
                'Join Workspace'
              )}
            </button>
          ) : (
            <div className="mt-6 space-y-3">
              <Link
                href={`/signup?invite=${resolvedParams.token}`}
                className="block w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Create Account & Join
              </Link>
              <Link
                href={`/login?invite=${resolvedParams.token}`}
                className="block w-full rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Already have an account? Sign In
              </Link>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400">
            Invite expires {new Date(inviteInfo.expiresAt).toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>
    </div>
  )
}
