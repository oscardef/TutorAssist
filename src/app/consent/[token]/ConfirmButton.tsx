'use client'

import { useState } from 'react'

export function ConfirmButton({ token, name }: { token: string; name: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  async function confirm() {
    setState('busy')
    const res = await fetch('/api/consent/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    if (res.ok) { setState('done'); return }
    const data = await res.json().catch(() => ({}))
    setError(data.error || 'Something went wrong. Try again.')
    setState('error')
  }
  if (state === 'done') return <div className="alert-success mt-6" role="status">Thank you. {name} can start practising now.</div>
  return (
    <div className="mt-6">
      {state === 'error' && <div className="alert-error mb-3" role="alert">{error}</div>}
      <button type="button" onClick={confirm} disabled={state === 'busy'} className="btn btn-primary w-full">
        {state === 'busy' ? 'Saving…' : `I'm their parent or guardian and I agree`}
      </button>
    </div>
  )
}
