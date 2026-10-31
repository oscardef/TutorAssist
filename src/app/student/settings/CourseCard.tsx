'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Course { program: string; programName: string; grades: { code: string; name: string; questions: number }[] }

/** Students practising on their own pick their own course and year. */
export function CourseCard({ program: initialProgram, grade: initialGrade }: { program: string | null; grade: string | null }) {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [program, setProgram] = useState(initialProgram || '')
  const [grade, setGrade] = useState(initialGrade || '')
  const [msg, setMsg] = useState<{ tone: 'good' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/workspace/solo').then(r => r.json()).then(d => setCourses(d.courses || [])).catch(() => {})
  }, [])

  const current = courses.find(c => c.program === program)
  const changed = program !== (initialProgram || '') || grade !== (initialGrade || '')

  async function save() {
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/workspace/solo', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ program, grade }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg({ tone: 'error', text: data.error || 'Could not save.' }); return }
    setMsg({ tone: 'good', text: 'Course saved. Practice now shows its topics.' })
    router.refresh()
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="course-title">
      <div className="card-header">
        <div>
          <h2 id="course-title" className="card-title">Course</h2>
          <p className="text-sm text-gray-500">Practice and review use the topics of this course.</p>
        </div>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label htmlFor="course-program" className="block text-sm font-medium text-gray-700">Programme</label>
          <select id="course-program" className="input mt-1.5" value={program} onChange={e => { setProgram(e.target.value); setGrade('') }}>
            <option value="" disabled>Choose…</option>
            {courses.map(c => <option key={c.program} value={c.program}>{c.programName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="course-grade" className="block text-sm font-medium text-gray-700">Year or course</label>
          <select id="course-grade" className="input mt-1.5" value={grade} onChange={e => setGrade(e.target.value)} disabled={!current}>
            <option value="" disabled>Choose…</option>
            {current?.grades.map(g => (
              <option key={g.code} value={g.code} disabled={!g.questions && g.code !== initialGrade}>
                {g.name}{g.questions ? '' : ' (coming soon)'}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper px-6 py-3">
        {msg && <span className={`text-sm ${msg.tone === 'good' ? 'text-[#1f6b43]' : 'text-[#9b2c2c]'}`} role="status">{msg.text}</span>}
        <button type="button" className="btn btn-primary btn-sm" disabled={!changed || !grade || busy} onClick={save}>{busy ? 'Saving…' : 'Save course'}</button>
      </div>
    </section>
  )
}
