'use client'

import { useId, useState } from 'react'

/**
 * A small "i" button that reveals a short explanation on hover, focus or tap.
 * Use it where a label would otherwise need a sentence of explanation.
 */
export function InfoTip({ text, label = 'What is this?', className = '' }: { text: string; label?: string; className?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onClick={() => setOpen(o => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/30 text-[11px] font-extrabold leading-none opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 group"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-lg transition-opacity ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} [button:hover+&]:opacity-100 [button:focus-visible+&]:opacity-100`}
      >
        {text}
      </span>
    </span>
  )
}
