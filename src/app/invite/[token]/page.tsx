'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  const router = useRouter()
  const supabase = createClient()

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state for password setup
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

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

        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser()
        setIsAuthenticated(!!user)
        setCurrentUserEmail(user?.email || null)
      } catch (err) {
        console.error('Error checking invite:', err)
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    checkInvite()
  }, [resolvedParams.token, supabase.auth])

  // Handle setting up password (new account)
  const handleSetupAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resolvedParams.token,
          email: inviteInfo?.expectedEmail,
          password,
          fullName: inviteInfo?.studentName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If account exists, show login option
        if (data.existingAccount) {
          setError(data.error)
          return
        }
        setError(data.error || 'Failed to create account')
        return
      }

      if (data.autoSignIn) {
        // Successfully signed in - redirect to dashboard
        router.push('/student/dashboard')
        router.refresh()
      } else {
        // Need to sign in manually - redirect to login
        router.push(`/login?message=Account created! Please sign in.`)
      }
    } catch (err) {
      console.error('Error setting up account:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle joining workspace (existing logged-in user)
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
      router.push('/student/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Error joining workspace:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading invite...</p>
        </div>
      </div>
    )
  }

  // Error state (invalid invite)
  if (error && !inviteInfo) {
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

  // Expired or used invite
  if (inviteInfo?.isExpired || inviteInfo?.isUsed) {
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
                ? 'This invite has already been used. If this is your account, please log in.'
                : 'This invite has expired. Please ask your tutor for a new one.'}
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

  // Already claimed by another user
  if (inviteInfo?.isAlreadyClaimed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Account Already Set Up</h1>
            <p className="mt-2 text-gray-600">
              Your account is ready! Please log in to continue.
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

  // Check for email mismatch if user is logged in
  const emailMismatch = isAuthenticated && 
    inviteInfo?.expectedEmail && 
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
              <span className="font-semibold text-gray-900">{inviteInfo?.tutorName}</span> has invited you to join
            </p>
            <p className="mt-1 text-lg font-semibold text-blue-600">{inviteInfo?.workspaceName}</p>
            {inviteInfo?.studentName && (
              <p className="mt-2 text-sm text-gray-500">
                Profile: {inviteInfo.studentName}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Email mismatch warning for logged-in users */}
          {emailMismatch && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-left">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Email Mismatch</p>
                  <p className="mt-1 text-amber-700">
                    This invite is for <span className="font-medium">{inviteInfo?.expectedEmail}</span> but you&apos;re signed in as <span className="font-medium">{currentUserEmail}</span>.
                  </p>
                  <Link href="/api/auth/signout" className="mt-2 inline-block text-amber-700 underline hover:text-amber-800">
                    Sign out to continue
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Main content area */}
          {isAuthenticated && !emailMismatch ? (
            // User is logged in with correct email - just join
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-4">
                You&apos;re signed in as <span className="font-medium">{currentUserEmail}</span>
              </p>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
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
            </div>
          ) : !isAuthenticated ? (
            // Not logged in - show password setup form
            <form onSubmit={handleSetupAccount} className="mt-6 text-left">
              <p className="text-sm text-gray-600 mb-4 text-center">
                Complete your account setup by creating a password.
              </p>

              {inviteInfo?.expectedEmail && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={inviteInfo.expectedEmail}
                    disabled
                    className="block w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This email was set by your tutor
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Create Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Repeat your password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Account...
                  </span>
                ) : (
                  'Create Account & Join'
                )}
              </button>

              <p className="mt-4 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          ) : null}

          <p className="mt-6 text-xs text-gray-400">
            Invite expires {inviteInfo?.expiresAt ? new Date(inviteInfo.expiresAt).toLocaleDateString('en-GB') : 'soon'}
          </p>
        </div>
      </div>
    </div>
  )
}
