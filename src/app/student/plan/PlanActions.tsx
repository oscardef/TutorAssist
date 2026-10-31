'use client'

import { useState } from 'react'

export function PlanActions({ plus, billing, canManage }: { plus: boolean; billing: boolean; canManage: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function go(path: string, body: Record<string, unknown> | undefined, key: string) {
    setBusy(key)
    setError(null)
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const data = await res.json()
      if (!res.ok || !data.url) { setError(data.error || 'Something went wrong. Try again.'); setBusy(null); return }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Check your connection.')
      setBusy(null)
    }
  }

  if (plus) {
    return canManage ? (
      <>
        {error && <div className="alert-error mb-3" role="alert">{error}</div>}
        <button type="button" className="btn btn-secondary w-full" disabled={!!busy} onClick={() => go('/api/billing/portal', undefined, 'portal')}>
          {busy ? 'Opening…' : 'Manage billing'}
        </button>
      </>
    ) : null
  }

  if (!billing) {
    return (
      <>
        <button type="button" className="btn btn-primary w-full" disabled>Plus isn&apos;t on sale yet</button>
        <p className="mt-2 text-xs text-gray-500">It opens soon. Free keeps working in the meantime.</p>
      </>
    )
  }

  return (
    <div className="space-y-2">
      {error && <div className="alert-error" role="alert">{error}</div>}
      <button type="button" className="btn btn-primary w-full" disabled={!!busy} onClick={() => go('/api/billing/checkout', { interval: 'year' }, 'year')}>
        {busy === 'year' ? 'Opening checkout…' : 'Get Plus yearly'}
      </button>
      <button type="button" className="btn btn-secondary w-full" disabled={!!busy} onClick={() => go('/api/billing/checkout', { interval: 'month' }, 'month')}>
        {busy === 'month' ? 'Opening checkout…' : 'Get Plus monthly'}
      </button>
    </div>
  )
}
