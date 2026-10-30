'use client'

import { useState, useEffect, Suspense } from 'react'
import { authClient } from '@/lib/identity/client'
import { AuthShell } from '@/components/ui/auth-shell'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [expectedEmail, setExpectedEmail] = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)
  const [signupComplete, setSignupComplete] = useState(false)
  const [userAlreadyExists, setUserAlreadyExists] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const inviteToken = searchParams.get('invite')

  // Check if already logged in and fetch invite info
  useEffect(() => {
    async function checkAuthAndInvite() {
      const { data: session } = await authClient.getSession()
      const user = session?.user
      if (user && inviteToken) {
        // User is logged in and has an invite, redirect to the invite page
        router.push(`/invite/${inviteToken}`)
        return
      }
      
      // If there's an invite token, redirect to the invite page for streamlined signup
      // The invite page now handles account creation directly
      if (inviteToken) {
        router.push(`/invite/${inviteToken}`)
        return
      }
    }
    checkAuthAndInvite()
  }, [inviteToken, router])

  const handleSignup = async (e: React.FormEvent) => {
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
    
    // Validate email matches expected email for invite
    if (expectedEmail && email.toLowerCase() !== expectedEmail.toLowerCase()) {
      setError(`This invite is for ${expectedEmail}. Please use that email address.`)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await authClient.signUp.email({
        name: email.split('@')[0],
        email,
        password,
        callbackURL: inviteToken ? `/invite/${inviteToken}` : '/onboarding',
      })

      if (error) {
        // Check if user already exists
        if (error.status === 422 || error.code === 'USER_ALREADY_EXISTS' || /already exist/i.test(error.message || '')) {
          setUserAlreadyExists(true)
          setError('An account with this email already exists. You can sign in or reset your password.')
          return
        }
        setError(error.message || 'Sign up failed')
        return
      }

      // Account created and signed in (no email verification required)
      if (data?.user && data.token) {
        // User is already signed in, redirect appropriately
        if (inviteToken) {
          router.push(`/invite/${inviteToken}`)
        } else {
          router.push('/')
        }
        router.refresh()
        return
      }

      // Show confirmation message (for cases where email confirmation is still enabled)
      setSignupComplete(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })

      if (error) {
        setError(error.message || 'Failed to send password reset email')
        return
      }

      setResetEmailSent(true)
    } catch {
      setError('Failed to send password reset email')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setResending(true)
    setResendSuccess(false)
    setError(null)

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: inviteToken ? `/invite/${inviteToken}` : '/onboarding',
      })

      if (error) {
        setError(error.message || 'Failed to resend confirmation email')
        return
      }

      setResendSuccess(true)
    } catch {
      setError('Failed to resend confirmation email')
    } finally {
      setResending(false)
    }
  }

  // Show password reset email sent screen
  if (resetEmailSent) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="page-title">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;ve sent a password reset link to your email
          </p>
        </div>

        <div className="card p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-900 font-medium">{email}</p>
              <p className="text-sm text-gray-500 mt-2">
                Click the link in the email to set your password and access your account.
              </p>
            </div>
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs text-gray-400">
                Didn&apos;t receive the email? Check your spam folder.
              </p>
              <button 
                type="button"
                onClick={handlePasswordReset}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Resend reset email'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
              className="block w-full text-center px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
            >
              Go to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show email confirmation screen after successful signup
  if (signupComplete) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="page-title">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;ve sent a confirmation link to your email
          </p>
        </div>

        <div className="card p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-900 font-medium">{email}</p>
              <p className="text-sm text-gray-500 mt-2">
                Please check your inbox and click the confirmation link to activate your account.
              </p>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {resendSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">Confirmation email sent! Check your inbox.</p>
              </div>
            )}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs text-gray-400">
                Didn&apos;t receive the email? Check your spam folder.
              </p>
              <button 
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? 'Sending...' : 'Resend confirmation email'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/login"
              className="block w-full text-center px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
            >
              Go to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo/Brand */}
      <div className="text-center mb-8">
        <h1 className="page-title">
          {studentName ? `Welcome, ${studentName}!` : 'Create your account'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {inviteToken 
            ? 'Create your account to join your tutor\'s workspace'
            : 'Start your math tutoring journey with Mathium'
          }
        </p>
      </div>

      {/* Signup Card */}
      <div className="card p-8">
        {/* Invite info banner */}
        {expectedEmail && (
          <div className="mb-5 rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-sm text-blue-700">
              Please sign up with <span className="font-medium">{expectedEmail}</span> to claim your student account.
            </p>
          </div>
        )}
        
        <form onSubmit={handleSignup} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              {userAlreadyExists && (
                <div className="mt-3 pt-3 border-t border-red-200 flex flex-wrap gap-3">
                  <Link
                    href={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Sign in instead →
                  </Link>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Reset password →'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={!!expectedEmail}
              className={`block w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${
                expectedEmail ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50 focus:bg-white'
              }`}
              placeholder="you@example.com"
            />
            {expectedEmail && (
              <p className="mt-1.5 text-xs text-gray-500">
                This email is linked to your student profile
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input"
              placeholder="••••••••"
            />
            <p className="mt-1.5 text-xs text-gray-500">Must be at least 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Creating account...
              </span>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {/* Terms notice */}
        <p className="mt-5 text-center text-xs text-gray-500">
          By creating an account, you agree to our{' '}
          <span className="text-gray-700 hover:text-blue-600 cursor-pointer">Terms of Service</span>
          {' '}and{' '}
          <span className="text-gray-700 hover:text-blue-600 cursor-pointer">Privacy Policy</span>
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link 
          href={inviteToken ? `/login?invite=${inviteToken}` : '/login'} 
          className="font-semibold text-blue-600 hover:text-blue-500 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

function SignupLoading() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 bg-gray-200 rounded-2xl skeleton mb-4"></div>
        <div className="mx-auto h-7 w-48 bg-gray-200 rounded-lg skeleton"></div>
        <div className="mt-2 mx-auto h-4 w-64 bg-gray-200 rounded skeleton"></div>
      </div>
      <div className="card p-8">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <div className="h-4 w-24 bg-gray-200 rounded skeleton"></div>
            <div className="h-12 w-full bg-gray-100 rounded-xl skeleton"></div>
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-16 bg-gray-200 rounded skeleton"></div>
            <div className="h-12 w-full bg-gray-100 rounded-xl skeleton"></div>
            <div className="h-3 w-36 bg-gray-200 rounded skeleton"></div>
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-28 bg-gray-200 rounded skeleton"></div>
            <div className="h-12 w-full bg-gray-100 rounded-xl skeleton"></div>
          </div>
          <div className="h-12 w-full bg-gray-200 rounded-xl skeleton"></div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense fallback={<SignupLoading />}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  )
}
