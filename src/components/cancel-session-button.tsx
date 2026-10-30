'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Inline two-step cancel for an upcoming session (no browser dialog). */
export function CancelSessionButton({ sessionId, onDone }: { sessionId: string; onDone?: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy'>('idle')
  const [error, setError] = useState<string | null>(null)
  async function cancel() {
    setStep('busy'); setError(null)
    const res = await fetch('/api/booking/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d.error || 'Could not cancel'); setStep('idle'); return }
    if (onDone) { setStep('idle'); onDone() } else router.refresh()
  }
  if (error) return <p className="mt-2 text-xs text-[#9b2c2c]" role="alert">{error}</p>
  if (step === 'idle') return <button type="button" onClick={() => setStep('confirm')} className="btn btn-ghost btn-sm">Cancel</button>
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={cancel} disabled={step === 'busy'} className="btn btn-danger btn-sm">{step === 'busy' ? 'Cancelling…' : 'Yes, cancel'}</button>
      <button type="button" onClick={() => setStep('idle')} className="btn btn-ghost btn-sm">Keep</button>
    </span>
  )
}
