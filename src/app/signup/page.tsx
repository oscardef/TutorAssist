'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const inviteToken = searchParams.get('invite')

  // Check if already logged in and fetch invite info
  useEffect(() => {
    async function checkAuthAndInvite() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && inviteToken) {
        // User is logged in and has an invite, redirect to the invite page
        router.push(`/invite/${inviteToken}`)
        return
      }
      
      // If there's an invite token, fetch the expected email
      if (inviteToken) {
        try {
          const res = await fetch(`/api/invite/${inviteToken}`)
          if (res.ok) {
            const data = await res.json()
            if (data.expectedEmail) {
              setExpectedEmail(data.expectedEmail)
              setEmail(data.expectedEmail) // Pre-fill the email
            }
            if (data.studentName) {
              setStudentName(data.studentName)
            }
          }
        } catch (err) {
          console.error('Failed to fetch invite info:', err)
        }
      }
    }
    checkAuthAndInvite()
  }, [inviteToken, router, supabase.auth])

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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: inviteToken 
            ? `${window.location.origin}/invite/${inviteToken}` 
            : `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      // Check if this is a repeated signup (user exists but not confirmed)
      // Supabase returns a user with identities = [] for repeated signups
      if (data?.user && data.user.identities?.length === 0) {
        // User already exists - they need to confirm their email or use resend
        setSignupComplete(true)
        return
      }

      // Show confirmation message instead of redirecting
      setSignupComplete(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setResending(true)
    setResendSuccess(false)
    setError(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: inviteToken 
            ? `${window.location.origin}/invite/${inviteToken}` 
            : `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setResendSuccess(true)
    } catch {
      setError('Failed to resend confirmation email')
    } finally {
      setResending(false)
    }
  }

  // Show email confirmation screen after successful signup
  if (signupComplete) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            We&apos;ve sent a confirmation link to your email
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
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
        <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4">
          <svg className="w-8 h-8 text-white" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M24 10L36 18V30L24 38L12 30V18L24 10Z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 10V38" strokeLinecap="round"/>
            <path d="M12 18L24 26L36 18" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {studentName ? `Welcome, ${studentName}!` : 'Create your account'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {inviteToken 
            ? 'Create your account to join your tutor\'s workspace'
            : 'Start your math tutoring journey with TutorAssist'
          }
        </p>
      </div>

      {/* Signup Card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
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
            <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-700">{error}</p>
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
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
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
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="relative w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 hover:shadow-blue-500/30 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
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
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
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
    <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-b from-gray-50 to-white">
      <Suspense fallback={<SignupLoading />}>
        <SignupForm />
      </Suspense>
    </div>
  )
}
