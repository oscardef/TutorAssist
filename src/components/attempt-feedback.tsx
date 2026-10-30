'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/icons'
import { ERROR_TAGS, type FeedbackItem } from '@/lib/feedback'

/** Tutor notes on one attempt: existing notes, and a small form to add one. */
export function AttemptFeedback({ attemptId, initial }: { attemptId: string; initial: FeedbackItem[] }) {
  const [items, setItems] = useState(initial)
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isPrivate, setIsPrivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setError(null)
    const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId, comment, errorTags: tags, isPrivate }) })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { setError(d.error || 'Could not save'); return }
    setItems(list => [...list, d.feedback])
    setComment(''); setTags([]); setIsPrivate(false); setOpen(false)
  }
  async function remove(id: string) {
    const res = await fetch(`/api/feedback?id=${id}`, { method: 'DELETE' })
    if (res.ok) setItems(list => list.filter(i => i.id !== id))
  }

  return (
    <div className="mt-2 space-y-2">
      {items.map(i => (
        <div key={i.id} className={`group flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${i.is_private ? 'bg-paper' : 'bg-brand-50'}`}>
          <div className="min-w-0 flex-1">
            {(i.error_tags?.length ?? 0) > 0 && <div className="mb-1 flex flex-wrap gap-1">{i.error_tags!.map(t => <span key={t} className="chip !py-0 text-[11px]">{t}</span>)}</div>}
            {i.comment && <p className="whitespace-pre-wrap text-ink">{i.comment}</p>}
            {i.is_private && <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Only tutors see this</p>}
          </div>
          <button type="button" onClick={() => remove(i.id)} className="rounded p-1 text-gray-400 opacity-0 hover:text-ink group-hover:opacity-100 focus:opacity-100" aria-label="Delete note"><Icons.x className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {open ? (
        <div className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap gap-1.5">
            {ERROR_TAGS.map(t => (
              <button key={t} type="button" aria-pressed={tags.includes(t)} onClick={() => setTags(x => (x.includes(t) ? x.filter(y => y !== t) : [...x, t]))} className={`chip text-xs ${tags.includes(t) ? 'chip-brand' : ''}`}>{t}</button>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="A short note for the student…" className="input mt-2 resize-y text-sm" aria-label="Feedback note" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Only for tutors</label>
            <span className="flex gap-1">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button type="button" onClick={save} disabled={busy || (!comment.trim() && tags.length === 0)} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save note'}</button>
            </span>
          </div>
          {error && <p className="mt-1 text-xs text-[#9b2c2c]" role="alert">{error}</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Icons.plus className="h-3.5 w-3.5" /> Add a note</button>
      )}
    </div>
  )
}
