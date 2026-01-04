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
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const inviteToken = searchParams.get('invite')

  // Check if already logged in and has invite token
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && inviteToken) {
        // User is logged in and has an invite, redirect to the invite page
        router.push(`/invite/${inviteToken}`)
      }
    }
    checkAuth()
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

    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
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

      // If there's an invite token, redirect to the invite page (they'll join after confirming email)
      if (inviteToken) {
        router.push(`/invite/${inviteToken}`)
      } else {
        router.push('/onboarding')
      }
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        <p className="mt-2 text-sm text-gray-500">
          Start your math tutoring journey with TutorAssist
        </p>
      </div>

      {/* Signup Card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
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
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="you@example.com"
            />
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
