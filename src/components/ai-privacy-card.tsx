'use client'

import { useState } from 'react'
import Link from 'next/link'

/** Workspace switch: may AI features use anonymised student results? */
export function AiPrivacyCard({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [saving, setSaving] = useState(false)
  async function toggle() {
    const next = !on
    setSaving(true)
    const res = await fetch('/api/settings/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiStudentData: next }) })
    setSaving(false)
    if (res.ok) setOn(next)
  }
  return (
    <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0 flex-1">
        <h2 className="card-title">Student results in AI features</h2>
        <p className="mt-1 text-sm text-gray-500">
          When on, personalised assignments send the AI a summary of a student&apos;s results (accuracy and weaker topics). Names and emails are never sent. See the <Link href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">privacy policy</Link>.
        </p>
      </div>
      <button type="button" role="switch" aria-checked={on} disabled={saving} onClick={toggle} className={`relative h-8 w-14 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
        <span className="sr-only">Use anonymised student results in AI features</span>
      </button>
    </section>
  )
}
