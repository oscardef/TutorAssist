'use client'

import { useState } from 'react'
import { Icons } from '@/components/ui/icons'
import { useCurricula } from '@/components/syllabus-picker'

/** Set up a workspace's topics from a course syllabus in one step. */
export function StartFromSyllabus({ onDone, compact = false }: { onDone: (created: number) => void; compact?: boolean }) {
  const curricula = useCurricula()
  const [courseId, setCourseId] = useState('')
  const [full, setFull] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const course = curricula.find(c => c.id === courseId) ?? curricula[0]
  const hasHL = course?.nodes.some(n => n.level === 'AHL')
  const hasExt = course?.nodes.some(n => n.level === 'EXT')
  const names = hasHL ? ['SL', 'HL'] : hasExt ? ['Standard', 'Extended'] : null
  const points = course ? course.nodes.filter(n => n.depth > 0 && (full || (n.level !== 'AHL' && n.level !== 'EXT'))).length : 0

  async function create() {
    if (!course) return
    setBusy(true); setMsg(null)
    const res = await fetch('/api/topics/from-syllabus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ curriculumId: course.id, fullCourse: full }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(d.error || 'Could not create the topics'); return }
    setMsg(d.created ? `Added ${d.created} topics` : 'All of these topics are already there')
    onDone(d.created ?? 0)
  }

  return (
    <section className={compact ? '' : 'card p-5 sm:p-6'}>
      {!compact && (
        <>
          <h2 className="card-title inline-flex items-center gap-2"><Icons.topics className="h-5 w-5 text-brand-600" /> Start from a syllabus</h2>
          <p className="mt-1 text-sm text-gray-500">Creates your topics from the course outline, already linked to each syllabus point, so practice, generation and the library line up.</p>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1"><span className="hint mb-1 block">Course</span>
          <select value={course?.id ?? ''} onChange={e => { setCourseId(e.target.value); setFull(true) }} className="input">
            {curricula.map(c => <option key={c.id} value={c.id}>{c.framework} {c.short_name}{c.version ? ` (${c.version})` : ''}</option>)}
          </select>
        </label>
        {names && (
          <div className="inline-flex rounded-full bg-paper p-0.5 text-sm font-bold" role="group" aria-label="Level">
            <button type="button" aria-pressed={!full} onClick={() => setFull(false)} className={`rounded-full px-4 py-2 ${!full ? 'bg-white text-ink shadow-sm' : 'text-gray-500'}`}>{names[0]}</button>
            <button type="button" aria-pressed={full} onClick={() => setFull(true)} className={`rounded-full px-4 py-2 ${full ? 'bg-white text-ink shadow-sm' : 'text-gray-500'}`}>{names[1]}</button>
          </div>
        )}
        <button type="button" onClick={create} disabled={busy || !course} className="btn btn-primary">{busy ? 'Adding…' : `Add topics (${points} points)`}</button>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold text-[#1f6b43]" role="status">{msg}</p>}
    </section>
  )
}
