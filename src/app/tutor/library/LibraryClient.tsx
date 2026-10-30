'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import LatexRenderer from '@/components/latex-renderer'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { DifficultyDots, IconButton } from '@/components/question-player'
import { useCurricula, type Curriculum } from '@/components/syllabus-picker'

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
  curriculum_node_id: string | null
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

type Tab = 'browse' | 'coverage' | 'mine' | 'review'

/** Reviewed questions we want per syllabus point before calling it covered. */
const COVERAGE_TARGET = 30

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
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const curricula = useCurricula()
  const [courseId, setCourseId] = useState('')
  const [nodeId, setNodeId] = useState('')
  const [coverage, setCoverage] = useState<Record<string, { library: number; workspace: number }> | null>(null)
  const nodeById = new Map(curricula.flatMap(c => c.nodes.map(n => [n.id, { node: n, course: c }] as const)))
  const course = curricula.find(c => c.id === courseId)

  const load = useCallback(async (q: string, filter: { courseId?: string; nodeId?: string } = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search: q, limit: '50' })
      if (filter.nodeId) params.set('nodeId', filter.nodeId)
      else if (filter.courseId) params.set('curriculumId', filter.courseId)
      const res = await fetch(`/api/library?${params}`)
      const data = await res.json()
      setItems(data.questions || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load('') }, [load])

  useEffect(() => {
    if (tab === 'coverage' && !coverage) {
      fetch('/api/curricula?coverage=1').then(r => r.json()).then(d => setCoverage(d.coverage || {}))
    }
    if (tab === 'review' && isOwner && !queueLoaded) {
      fetch('/api/library/review').then(r => r.json()).then(d => { setQueue(d.questions || []); setQueueLoaded(true) })
    }
  }, [tab, isOwner, queueLoaded, coverage])

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
      setPicked(p => { const n = new Set(p); n.delete(id); return n })
      setMessage(decision === 'approve' ? 'Added to the library.' : 'Sent back with your note.')
      if (decision === 'approve') load(search, { courseId, nodeId })
    } else {
      setMessage(data.error || 'Review failed')
    }
    setTimeout(() => setMessage(null), 2500)
  }

  async function decideMany(decision: 'approve' | 'reject') {
    const ids = Array.from(picked)
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/library/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionIds: ids, decision }) })
      const data = await res.json()
      const done = new Set((data.results || []).filter((r: { ok: boolean }) => r.ok).map((r: { id: string }) => r.id))
      setQueue(q => q.filter(x => !done.has(x.id)))
      setPicked(new Set())
      setMessage(`${done.size} ${decision === 'approve' ? 'added to the library' : 'sent back'}${data.failed ? `, ${data.failed} failed` : ''}.`)
      if (decision === 'approve') load(search, { courseId, nodeId })
    } finally {
      setBulkBusy(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const Book = Icons.book
  const Plus = Icons.plus
  const Check = Icons.check
  const X = Icons.x

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'browse', label: 'Browse', count: total },
    { key: 'coverage', label: 'Coverage' },
    { key: 'mine', label: 'My questions', count: mine.length },
    ...(isOwner ? [{ key: 'review' as Tab, label: 'Review queue', count: queueLoaded ? queue.length : undefined }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">Library <InfoTip text="Every question created in any workspace is reviewed. Approved ones get a shared copy here that anyone can add to their bank." className="text-gray-500" /></h1>
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
          <div className="grid gap-2 sm:grid-cols-[1fr_11rem_minmax(0,16rem)]">
            <input type="search" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value, { courseId, nodeId }) }} placeholder="Search the library…" className="input" aria-label="Search the library" />
            <select value={courseId} onChange={e => { setCourseId(e.target.value); setNodeId(''); load(search, { courseId: e.target.value }) }} className="input" aria-label="Course">
              <option value="">All courses</option>
              {curricula.map(c => <option key={c.id} value={c.id}>{c.framework} {c.short_name}</option>)}
            </select>
            <select value={nodeId} onChange={e => { setNodeId(e.target.value); load(search, { courseId, nodeId: e.target.value }) }} disabled={!course} className="input" aria-label="Syllabus point">
              <option value="">{course ? 'All syllabus points' : 'Pick a course first'}</option>
              {course && <SyllabusOptions course={course} />}
            </select>
          </div>
          {loading ? (
            <div className="space-y-3"><div className="h-20 skeleton" /><div className="h-20 skeleton" /></div>
          ) : items.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Book className="h-6 w-6" /></div>
              <p className="mt-4 font-bold text-ink">The library is empty so far</p>
              <p className="mt-1 text-sm text-gray-500">Approved questions from every workspace appear here.</p>
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
                        {q.curriculum_node_id && nodeById.get(q.curriculum_node_id) && (() => {
                          const { node, course: c } = nodeById.get(q.curriculum_node_id!)!
                          return <span className="chip chip-spark" title={`${c.short_name}: ${node.title}`}>{c.short_name} {node.code}</span>
                        })()}
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

      {tab === 'coverage' && (
        <CoverageView curricula={curricula} coverage={coverage} onPick={(c, n) => { setCourseId(c); setNodeId(n); setTab('browse'); load(search, { courseId: c, nodeId: n }) }} />
      )}

      {tab === 'mine' && (
        <section>
          {mine.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <p className="font-bold text-ink">No questions in review</p>
              <p className="mt-1 text-sm text-gray-500">Questions you create are reviewed for the library automatically and show up here with their status.</p>
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
            <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={picked.size === queue.length && queue.length > 0} onChange={() => setPicked(picked.size === queue.length ? new Set() : new Set(queue.map(q => q.id)))} className="h-4 w-4 rounded border-gray-300 accent-brand-600" /> Select all <span className="text-gray-500 tnum">{queue.length}</span>
              </label>
              {picked.size > 0 && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => decideMany('reject')} disabled={bulkBusy} className="btn btn-secondary btn-sm"><X className="h-4 w-4" /> Reject {picked.size}</button>
                  <button type="button" onClick={() => decideMany('approve')} disabled={bulkBusy} className="btn btn-primary btn-sm"><Check className="h-4 w-4" /> {bulkBusy ? 'Working…' : `Approve ${picked.size}`}</button>
                </div>
              )}
            </div>
            <ul className="space-y-4">
              {queue.map(q => (
                <li key={q.id} className={`card p-5 ${picked.has(q.id) ? 'border-brand-400' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="checkbox" checked={picked.has(q.id)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n })} className="h-4 w-4 rounded border-gray-300 accent-brand-600" aria-label="Select for bulk review" />
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
            </>
          )}
        </section>
      )}
    </div>
  )
}

function SyllabusOptions({ course }: { course: Curriculum }) {
  const headings = course.nodes.filter(n => n.depth === 0)
  return (
    <>
      {headings.map(h => (
        <optgroup key={h.id} label={`${h.code} ${h.title}`}>
          {course.nodes.filter(n => n.parent_id === h.id).map(n => <option key={n.id} value={n.id}>{n.code} {n.title}</option>)}
        </optgroup>
      ))}
    </>
  )
}

/**
 * How many reviewed library questions each syllabus point has against the
 * target, plus how many this workspace has. Thin points are where generation
 * (and the monthly credit sweep) should go next.
 */
function CoverageView({ curricula, coverage, onPick }: {
  curricula: Curriculum[]
  coverage: Record<string, { library: number; workspace: number }> | null
  onPick: (courseId: string, nodeId: string) => void
}) {
  const [courseId, setCourseId] = useState('')
  const course = curricula.find(c => c.id === courseId) ?? curricula[0]
  if (!course || !coverage) return <div className="space-y-3"><div className="h-12 skeleton" /><div className="h-64 skeleton" /></div>
  const points = course.nodes.filter(n => n.depth > 0)
  const covered = points.filter(n => (coverage[n.id]?.library ?? 0) >= COVERAGE_TARGET).length
  const started = points.filter(n => (coverage[n.id]?.library ?? 0) > 0).length

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Course">
          {curricula.map(c => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === course.id} onClick={() => setCourseId(c.id)} className={`chip ${c.id === course.id ? 'chip-brand' : ''}`}>{c.framework} {c.short_name}</button>
          ))}
        </div>
        <p className="inline-flex items-center gap-1.5 text-sm text-gray-600">
          <span className="font-bold text-ink tnum">{covered}</span> of <span className="tnum">{points.length}</span> points covered · <span className="tnum">{started}</span> started
          <InfoTip text={`A syllabus point counts as covered at ${COVERAGE_TARGET} reviewed library questions. ${course.status === 'draft' ? 'This syllabus outline is still a draft: ' + (course.source_note || '') : ''}`} className="text-gray-500" />
        </p>
      </div>
      <div className="card divide-y divide-line">
        {course.nodes.filter(n => n.depth === 0).map(h => (
          <div key={h.id}>
            <div className="bg-paper px-4 py-2 text-sm font-extrabold text-ink">{h.code} · {h.title}</div>
            <ul>
              {course.nodes.filter(n => n.parent_id === h.id).map(n => {
                const c = coverage[n.id] ?? { library: 0, workspace: 0 }
                const pct = Math.min(100, Math.round((c.library / COVERAGE_TARGET) * 100))
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => onPick(course.id, n.id)} className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-left hover:bg-paper sm:grid-cols-[4.5rem_1fr_9rem_5rem]">
                      <span className="text-sm font-bold text-ink tnum">{n.code}</span>
                      <span className="min-w-0 truncate text-sm text-gray-700">{n.title}{n.level === 'AHL' && <span className="chip ml-2 !py-0 text-[11px]">HL</span>}</span>
                      <span className="hidden items-center gap-2 sm:flex" aria-label={`${c.library} of ${COVERAGE_TARGET} library questions`}>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-line"><span className={`block h-full rounded-full ${pct >= 100 ? 'bg-[#2f855a]' : pct > 0 ? 'bg-brand-500' : ''}`} style={{ width: `${pct}%` }} /></span>
                        <span className="w-8 text-right text-xs text-gray-500 tnum">{c.library}</span>
                      </span>
                      <span className="text-right text-xs text-gray-500 tnum" title="Questions in your bank">{c.workspace > 0 ? `${c.workspace} yours` : ''}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
