'use client'

import { useState } from 'react'
import { AuthShell, AuthHeading } from '@/components/ui/auth-shell'
import { authClient } from '@/lib/identity/client'

/** Shown instead of the student pages until a parent or guardian agrees. */
export function ConsentPending({ name, parentEmail }: { name: string; parentEmail: string }) {
  const [email, setEmail] = useState(parentEmail)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'good' | 'error'; text: string } | null>(null)

  async function resend(newEmail?: string) {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch('/api/consent/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmail !== undefined ? { parentEmail: newEmail } : {}),
      })
      const data = await res.json()
      if (data.confirmed) { window.location.reload(); return }
      if (!res.ok) { setNote({ tone: 'error', text: data.error || 'Could not send the email.' }); return }
      setEmail(data.parentEmail)
      setEditing(false)
      setNote({ tone: 'good', text: `Sent to ${data.parentEmail}.` })
    } catch {
      setNote({ tone: 'error', text: 'Could not send the email. Check your connection.' })
    } finally {
      setBusy(false)
    }
  }

  async function check() {
    setBusy(true)
    setNote(null)
    try {
      const data = await (await fetch('/api/consent/status')).json()
      if (!data.pending) { window.location.reload(); return }
      setNote({ tone: 'error', text: "Not yet. Once they've pressed the button in the email, try again." })
    } catch {
      setNote({ tone: 'error', text: 'Could not check. Check your connection.' })
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Ask your parent to check their email"
        subtitle={<>Hi {name.split(' ')[0]}. Because you&apos;re under 16, a parent or guardian needs to agree before you start. We emailed <strong className="text-ink">{email}</strong>.</>}
      />
      <ol className="space-y-3 text-sm text-gray-700">
        <li className="flex gap-3"><span className="numeral text-lg text-brand-700">1</span><span>They open the email from Mathium and press <em>Review and agree</em>.</span></li>
        <li className="flex gap-3"><span className="numeral text-lg text-brand-700">2</span><span>You press <em>I&apos;m ready</em> below and start practising.</span></li>
      </ol>

      {note && <div className={`mt-6 ${note.tone === 'good' ? 'alert-success' : 'alert-error'}`} role="status">{note.text}</div>}

      {editing ? (
        <form className="mt-6 space-y-3" onSubmit={e => { e.preventDefault(); void resend(email) }}>
          <label htmlFor="parent-email" className="block text-sm font-medium text-gray-700">Parent or guardian&apos;s email</label>
          <input id="parent-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input" autoComplete="off" />
          <div className="flex gap-3">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => { setEditing(false); setEmail(parentEmail) }}>Cancel</button>
            <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? 'Sending…' : 'Send to this address'}</button>
          </div>
        </form>
      ) : (
        <div className="mt-8 space-y-3">
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void check()}>I&apos;m ready</button>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <button type="button" className="font-semibold text-brand-700 hover:underline disabled:opacity-60" disabled={busy} onClick={() => void resend()}>Send the email again</button>
            <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => setEditing(true)}>Use a different address</button>
            <button type="button" className="text-gray-600 hover:underline" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      )}
      <p className="mt-8 text-xs leading-relaxed text-gray-500">Can&apos;t find it? It comes from Mathium and can land in spam. If you have a tutor, you can also ask them for an invite instead.</p>
    </AuthShell>
  )
}
