'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Message { id: string; sponsor: string; headline: string; body: string | null; link_label: string }

/**
 * One small, clearly labelled sponsor message for students on the Free plan
 * (see lib/sponsor.ts). Renders nothing for everyone else. Without an active
 * sponsor it shows Mathium's own note about Plus. Never place it inside a
 * question.
 */
export function SponsorSlot({ className = '', house = true }: { className?: string; /** Show the note about Plus when no sponsor is active. */ house?: boolean }) {
  const [state, setState] = useState<{ show: boolean; message: Message | null } | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/sponsor').then(r => r.json()).then(d => { if (live) setState(d) }).catch(() => {})
    return () => { live = false }
  }, [])
  if (!state?.show || (!state.message && !house)) return null
  const m = state.message
  return (
    <aside aria-label={m ? 'Sponsor message' : 'About Plus'} className={`flex flex-col gap-3 rounded-sheet border border-dashed border-line bg-white/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{m ? `Sponsored by ${m.sponsor}` : 'From Mathium'}</p>
        <p className="mt-0.5 font-semibold text-ink">{m ? m.headline : 'Unlimited practice and worked solutions with Plus.'}</p>
        {(m ? m.body : 'Plus also removes these messages.') && <p className="mt-0.5 text-gray-600">{m ? m.body : 'Plus also removes these messages.'}</p>}
      </div>
      {m ? (
        <a href={`/api/sponsor/${m.id}`} target="_blank" rel="sponsored noopener noreferrer" referrerPolicy="no-referrer" className="btn btn-secondary btn-sm shrink-0">
          {m.link_label}<span className="sr-only"> (opens a new tab)</span>
        </a>
      ) : (
        <Link href="/student/plan" className="btn btn-secondary btn-sm shrink-0">See Plus</Link>
      )}
    </aside>
  )
}
