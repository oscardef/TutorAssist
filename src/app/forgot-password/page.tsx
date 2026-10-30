'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/identity/client'
import { AuthShell, AuthHeading, Spinner } from '@/components/ui/auth-shell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })
      if (error) {
        setError(error.message || 'Could not send the reset email. Try again.')
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <>
          <AuthHeading title="Check your inbox" subtitle={<>If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in one hour.</>} />
          <Link href="/login" className="btn btn-secondary w-full">Back to sign in</Link>
        </>
      ) : (
        <>
          <AuthHeading title="Reset your password" subtitle="Enter your email and we’ll send you a link to choose a new one." />
          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && <div className="alert-error" role="alert">{error}</div>}
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input id="email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="you@school.org" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? (<><Spinner /> Sending…</>) : 'Send reset link'}
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-gray-600">
            Remembered it? <Link href="/login" className="font-bold text-brand-700 hover:text-brand-800">Sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
