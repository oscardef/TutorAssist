'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import LatexRenderer from '@/components/latex-renderer'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { DifficultyDots, IconButton } from '@/components/question-player'

interface LibraryQuestion {
  id: string
  prompt_text: string
  prompt_latex: string | null
  answer_type: string
  difficulty: number | null
  tags_json: string[] | null
  curriculum_json: { libraryTopic?: string | null; libraryProgram?: string | null; libraryGrade?: string | null } | null
  license: string
  attribution: string | null
  reviewed_at: string | null
}
interface MyQuestion {
  id: string
  prompt_text: string
  prompt_latex: string | null
  review_status: 'submitted' | 'approved' | 'rejected'
  review_notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
  topics: { name: string } | null
}
interface ReviewQuestion {
  id: string
  prompt_text: string
  prompt_latex: string | null
  answer_type: string
  correct_answer_json: { value?: unknown; choices?: unknown[]; correct?: number }
  difficulty: number | null
  hints_json: string[] | null
  solution_steps_json: { step: string; result?: string }[] | null
  submitted_at: string | null
  workspaces: { name: string } | null
  topics: { name: string } | null
}

type Tab = 'browse' | 'mine' | 'review'

export default function LibraryClient({ isOwner, initialMine }: { isOwner: boolean; initialMine: MyQuestion[] }) {
  const [tab, setTab] = useState<Tab>('browse')
  const [items, setItems] = useState<LibraryQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [imported, setImported] = useState<Record<string, 'done' | 'dup' | 'busy'>>({})
  const [mine] = useState<MyQuestion[]>(initialMine)
  const [queue, setQueue] = useState<ReviewQuestion[]>([])
  const [queueLoaded, setQueueLoaded] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/library?search=${encodeURIComponent(q)}&limit=50`)
      const data = await res.json()
      setItems(data.questions || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load('') }, [load])

  useEffect(() => {
    if (tab === 'review' && isOwner && !queueLoaded) {
      fetch('/api/library/review').then(r => r.json()).then(d => { setQueue(d.questions || []); setQueueLoaded(true) })
    }
  }, [tab, isOwner, queueLoaded])

  async function importQuestion(id: string) {
    setImported(p => ({ ...p, [id]: 'busy' }))
    const res = await fetch('/api/library/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: id }) })
    const data = await res.json()
    setImported(p => ({ ...p, [id]: res.ok ? (data.duplicate ? 'dup' : 'done') : 'busy' }))
    if (!res.ok) { setMessage(data.error || 'Could not add this question'); setImported(p => { const n = { ...p }; delete n[id]; return n }) }
  }

  async function decide(id: string, decision: 'approve' | 'reject') {
    const res = await fetch('/api/library/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: id, decision, notes: notes[id] || null }) })
    const data = await res.json()
    if (res.ok) {
      setQueue(q => q.filter(x => x.id !== id))
      setMessage(decision === 'approve' ? 'Added to the library.' : 'Sent back with your note.')
      if (decision === 'approve') load(search)
    } else {
      setMessage(data.error || 'Review failed')
    }
    setTimeout(() => setMessage(null), 2500)
  }

  const Book = Icons.book
  const Plus = Icons.plus
  const Check = Icons.check
  const X = Icons.x

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'browse', label: 'Browse', count: total },
    { key: 'mine', label: 'My proposals', count: mine.length },
    ...(isOwner ? [{ key: 'review' as Tab, label: 'Review queue', count: queueLoaded ? queue.length : undefined }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">Library <InfoTip text="Questions checked and approved for everyone. Propose your own from the question bank; approved ones get a shared copy here." className="text-gray-500" /></h1>
          <p className="page-subtitle">Approved questions shared across every workspace. Add any of them to your bank.</p>
        </div>
        <Link href="/tutor/questions" className="btn btn-secondary btn-sm"><Book className="h-4 w-4" /> My question bank</Link>
      </div>

      {message && <div className="alert-success" role="status">{message}</div>}

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`chip ${tab === t.key ? 'chip-brand' : ''}`}>
            {t.label}{t.count !== undefined && <span className="tnum opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <section className="space-y-4">
          <input type="search" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }} placeholder="Search the library…" className="input" aria-label="Search the library" />
          {loading ? (
            <div className="space-y-3"><div className="h-20 skeleton" /><div className="h-20 skeleton" /></div>
          ) : items.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Book className="h-6 w-6" /></div>
              <p className="mt-4 font-bold text-ink">The library is empty so far</p>
              <p className="mt-1 text-sm text-gray-500">Propose questions from your bank; approved ones appear here for everyone.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map(q => {
                const meta = q.curriculum_json || {}
                const state = imported[q.id]
                return (
                  <li key={q.id} className="card flex items-start gap-4 p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {meta.libraryTopic && <span className="chip chip-brand">{meta.libraryTopic}</span>}
                        {meta.libraryProgram && <span className="chip">{meta.libraryProgram}{meta.libraryGrade ? ` · ${meta.libraryGrade}` : ''}</span>}
                        <DifficultyDots level={q.difficulty} />
                        <span className="text-gray-500">{q.answer_type.replace('_', ' ')}</span>
                      </div>
                      <p className="mt-2 text-ink"><LatexRenderer content={q.prompt_latex || q.prompt_text} /></p>
                      {q.attribution && <p className="mt-1 text-xs text-gray-500">{q.attribution}</p>}
                    </div>
                    <button type="button" onClick={() => importQuestion(q.id)} disabled={!!state} className={`btn btn-sm flex-shrink-0 ${state === 'done' || state === 'dup' ? 'btn-secondary' : 'btn-primary'}`} title="Copy into my question bank">
                      {state === 'busy' ? 'Adding…' : state === 'done' ? <><Check className="h-4 w-4" /> Added</> : state === 'dup' ? 'Already in bank' : <><Plus className="h-4 w-4" /> Add to bank</>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'mine' && (
        <section>
          {mine.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <p className="font-bold text-ink">No proposals yet</p>
              <p className="mt-1 text-sm text-gray-500">Open the question bank and press “Propose” on a question you’re proud of.</p>
              <Link href="/tutor/questions" className="btn btn-primary mt-5">Question bank</Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {mine.map(q => (
                <li key={q.id} className="card flex items-start gap-4 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`chip ${q.review_status === 'approved' ? 'chip-good' : q.review_status === 'rejected' ? 'chip-bad' : 'chip-spark'}`}>
                        {q.review_status === 'approved' ? 'In library' : q.review_status === 'rejected' ? 'Not accepted' : 'In review'}
                      </span>
                      {q.topics?.name && <span className="chip">{q.topics.name}</span>}
                    </div>
                    <p className="mt-2 text-ink"><LatexRenderer content={q.prompt_latex || q.prompt_text} /></p>
                    {q.review_notes && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm text-gray-700"><span className="font-semibold">Reviewer: </span>{q.review_notes}</p>}
                  </div>
                  <Link href={`/tutor/questions/${q.id}`} className="btn btn-secondary btn-sm flex-shrink-0">Open</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'review' && isOwner && (
        <section>
          {!queueLoaded ? (
            <div className="space-y-3"><div className="h-24 skeleton" /><div className="h-24 skeleton" /></div>
          ) : queue.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <p className="font-bold text-ink">Queue is clear</p>
              <p className="mt-1 text-sm text-gray-500">Proposed questions from every workspace show up here.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {queue.map(q => (
                <li key={q.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="chip">{q.workspaces?.name || 'Workspace'}</span>
                    {q.topics?.name && <span className="chip chip-brand">{q.topics.name}</span>}
                    <DifficultyDots level={q.difficulty} />
                    <span className="text-gray-500">{q.answer_type.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-3 text-lg text-ink"><LatexRenderer content={q.prompt_latex || q.prompt_text} /></p>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs font-semibold text-gray-500">Answer</dt><dd className="font-semibold text-ink"><LatexRenderer content={String(q.correct_answer_json?.value ?? (q.correct_answer_json?.correct !== undefined ? `Choice ${String.fromCharCode(65 + (q.correct_answer_json.correct || 0))}` : '—'))} /></dd></div>
                    <div><dt className="text-xs font-semibold text-gray-500">Hints</dt><dd className="text-ink tnum">{q.hints_json?.length || 0}</dd></div>
                    <div><dt className="text-xs font-semibold text-gray-500">Solution steps</dt><dd className="text-ink tnum">{q.solution_steps_json?.length || 0}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <input type="text" value={notes[q.id] || ''} onChange={e => setNotes(n => ({ ...n, [q.id]: e.target.value }))} placeholder="Note to the author (optional)…" className="input flex-1 !min-h-10" aria-label="Review note" />
                    <IconButton label="Reject" onClick={() => decide(q.id, 'reject')} className="!text-[#9b2c2c]"><X className="h-5 w-5" /></IconButton>
                    <button type="button" onClick={() => decide(q.id, 'approve')} className="btn btn-primary btn-sm"><Check className="h-4 w-4" /> Approve</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
