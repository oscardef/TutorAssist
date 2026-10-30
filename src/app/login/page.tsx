'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/identity/client'
import { AuthShell, AuthHeading, Spinner } from '@/components/ui/auth-shell'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const inviteToken = searchParams.get('invite')
  const authError = searchParams.get('error')
  const message = searchParams.get('message')

  // Already signed in with an invite in hand: go straight to the invite
  useEffect(() => {
    async function checkAuth() {
      const { data: session } = await authClient.getSession()
      if (session?.user && inviteToken) router.push(`/invite/${inviteToken}`)
    }
    checkAuth()
  }, [inviteToken, router])

  useEffect(() => {
    if (authError === 'session_expired') setError('Your session expired. Sign in again to continue.')
  }, [authError])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        setError(error.message || 'Check your email and password and try again.')
        return
      }
      router.push(inviteToken ? `/invite/${inviteToken}` : '/')
      router.refresh()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Sign in to pick up where you left off." />

      {message && <div className="alert-success mb-5">{message}</div>}

      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="input"
            placeholder="you@school.org"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="label mb-0">Password</label>
            <Link href="/forgot-password" className="text-sm font-semibold text-brand-700 hover:text-brand-800">Forgot password?</Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="input"
            placeholder="Your password"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading ? (<><Spinner /> Signing in…</>) : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600">
        New here?{' '}
        <Link href={inviteToken ? `/invite/${inviteToken}` : '/signup'} className="font-bold text-brand-700 hover:text-brand-800">
          Create an account
        </Link>
      </p>
    </>
  )
}

function LoginLoading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 skeleton" />
      <div className="h-12 w-full skeleton" />
      <div className="h-12 w-full skeleton" />
      <div className="h-13 w-full skeleton" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoginLoading />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
