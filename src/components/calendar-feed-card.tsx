'use client'

import { useEffect, useState } from 'react'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'

/** Private ICS address for Apple Calendar, Google Calendar or Outlook. */
export function CalendarFeedCard() {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  useEffect(() => { fetch('/api/calendar/feed').then(r => r.json()).then(d => setUrl(d.url || null)) }, [])
  async function copy() {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }
  async function replace() {
    const d = await (await fetch('/api/calendar/feed', { method: 'POST' })).json()
    setUrl(d.url || null)
    setConfirmReplace(false)
  }
  const Cal = Icons.calendar
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="card-title inline-flex items-center gap-2"><Cal className="h-5 w-5 text-brand-600" /> Add sessions to your calendar
        <InfoTip text="Subscribe to this address in Apple Calendar, Google Calendar (Other calendars › From URL) or Outlook. New, moved and cancelled sessions appear automatically. Keep it private: anyone with the link can see your session times." className="text-gray-500" />
      </h2>
      <div className="mt-3 flex gap-2">
        <input readOnly value={url ?? 'Loading…'} className="input min-w-0 flex-1 font-mono text-xs" aria-label="Calendar subscription address" onFocus={e => e.currentTarget.select()} />
        <button type="button" onClick={copy} disabled={!url} className="btn btn-secondary btn-sm flex-shrink-0">{copied ? <><Icons.check className="h-4 w-4" /> Copied</> : 'Copy'}</button>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {confirmReplace ? (
          <span className="inline-flex flex-wrap items-center gap-2">The old address will stop working.
            <button type="button" onClick={replace} className="font-bold text-[#9b2c2c] hover:underline">Replace it</button>
            <button type="button" onClick={() => setConfirmReplace(false)} className="font-semibold hover:underline">Keep it</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmReplace(true)} className="font-semibold hover:text-ink hover:underline">Shared it by mistake? Get a new address</button>
        )}
      </div>
    </section>
  )
}
