'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'

/** Download your data, or delete your account (privacy policy commitments). */
export function AccountDataCard({ email, isTutor }: { email: string; isTutor: boolean }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soleTutor, setSoleTutor] = useState(false)
  const [alsoWorkspace, setAlsoWorkspace] = useState(false)

  async function remove() {
    setBusy(true); setError(null)
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmEmail: typed, deleteWorkspaces: alsoWorkspace }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { window.location.href = '/'; return }
    if (d.code === 'sole_tutor') setSoleTutor(true)
    setError(d.error || 'Could not delete the account')
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="card-title">Your data</h2>
      <p className="mt-1 text-sm text-gray-500">What we keep and why is in the <Link href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">privacy policy</Link>.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/api/account/export" className="btn btn-secondary btn-sm"><Icons.arrowRight className="h-4 w-4 rotate-90" /> Download my data</a>
        {!open && <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm !text-[#9b2c2c]">Delete my account…</button>}
      </div>

      {open && (
        <div className="mt-4 rounded-2xl border border-[#f3c7c7] bg-[#fdf5f5] p-4">
          <p className="font-extrabold text-ink">Delete your account</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Your account, progress, answers, sessions and notes are deleted. This can&apos;t be undone.</li>
            {isTutor && <li>Questions you wrote stay on Mathium without your name, so the students and tutors using them keep them.</li>}
            <li>Backups are cleared within 14 days.</li>
          </ul>
          {soleTutor && (
            <label className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-sm text-gray-700">
              <input type="checkbox" checked={alsoWorkspace} onChange={e => setAlsoWorkspace(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#9b2c2c]" />
              <span>Also delete my workspace and its students&apos; work there. Students keep their accounts; their questions move to the Mathium library archive.</span>
            </label>
          )}
          <label className="mt-3 block text-sm text-gray-700">
            Type <span className="font-mono font-semibold">{email}</span> to confirm
            <input value={typed} onChange={e => setTyped(e.target.value)} className="input mt-1" autoComplete="off" aria-label="Your email address" />
          </label>
          {error && <p className="mt-2 text-sm font-semibold text-[#9b2c2c]" role="alert">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={remove} disabled={busy || typed.trim().toLowerCase() !== email.toLowerCase() || (soleTutor && !alsoWorkspace)} className="btn btn-danger btn-sm">{busy ? 'Deleting…' : 'Delete my account'}</button>
            <button type="button" onClick={() => { setOpen(false); setTyped(''); setError(null); setSoleTutor(false) }} className="btn btn-ghost btn-sm">Keep my account</button>
          </div>
        </div>
      )}
    </section>
  )
}
