'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/auth-shell'
import { FREE_DAILY_QUESTIONS } from '@/lib/plans'

interface Course { program: string; programName: string; grades: { code: string; name: string; questions: number }[] }

/** Course, year and age for a student starting without a tutor. */
export function SoloSetup({ onBack }: { onBack: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [program, setProgram] = useState('')
  const [grade, setGrade] = useState('')
  const [over16, setOver16] = useState<boolean | null>(null)
  const [parentEmail, setParentEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/workspace/solo')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { courses: Course[] }) => {
        setCourses(d.courses)
        const first = d.courses.find(c => c.grades.some(g => g.questions > 0))
        if (first) setProgram(first.program)
      })
      .catch(() => setError('Could not load the courses. Reload the page to try again.'))
  }, [])

  const open = useMemo(() => (courses ?? []).filter(c => c.grades.some(g => g.questions > 0)), [courses])
  const current = courses?.find(c => c.program === program)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!grade) { setError('Choose your year or course.'); return }
    if (over16 === null) { setError('Tell us whether you are 16 or older.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/workspace/solo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program, grade, over16, parentEmail: over16 ? undefined : parentEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not set up your account.'); return }
      window.location.href = '/student/dashboard'
    } catch {
      setError('Could not set up your account. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!courses && !error) {
    return <div className="mt-8 flex items-center gap-3 text-gray-600"><Spinner className="h-5 w-5 text-brand-600" />Loading courses…</div>
  }

  if (courses && open.length === 0) {
    return (
      <div className="mt-8 space-y-5">
        <div className="card p-5 text-sm leading-relaxed text-gray-700">
          <p className="font-semibold text-ink">Practising on your own opens soon.</p>
          <p className="mt-2">We&apos;re still checking the first questions for each course. If you have a tutor, ask them for an invite code and you can start today.</p>
        </div>
        <button type="button" onClick={onBack} className="btn btn-secondary w-full">Back</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-7">
      {error && <div className="alert-error" role="alert">{error}</div>}

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Your course</legend>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Programme">
          {(courses ?? []).map(c => {
            const has = c.grades.some(g => g.questions > 0)
            return (
              <button
                key={c.program}
                type="button"
                role="radio"
                aria-checked={program === c.program}
                disabled={!has}
                onClick={() => { setProgram(c.program); setGrade('') }}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:text-gray-400 ${program === c.program ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-gray-400'}`}
              >
                {c.programName}
              </button>
            )
          })}
        </div>
        {current && (
          <div className="card mt-4 divide-y divide-line overflow-hidden p-0" role="radiogroup" aria-label="Year or course">
            {current.grades.map(g => (
              <div key={g.code}>
                <label className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${g.questions ? 'cursor-pointer hover:bg-paper' : 'cursor-not-allowed text-gray-400'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="grade" value={g.code} checked={grade === g.code} disabled={!g.questions} onChange={() => setGrade(g.code)} className="h-4 w-4 accent-brand-600" />
                    <span className={g.questions ? 'font-medium text-ink' : ''}>{g.name}</span>
                  </span>
                  <span className="text-xs">{g.questions ? `${g.questions} question${g.questions === 1 ? '' : 's'}` : 'Coming soon'}</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">How old are you?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[{ v: true, label: '16 or older' }, { v: false, label: 'Under 16' }].map(o => (
            <label key={o.label} className={`card flex cursor-pointer items-center gap-3 px-4 py-3 text-sm font-medium ${over16 === o.v ? 'border-ink' : ''}`}>
              <input type="radio" name="age" checked={over16 === o.v} onChange={() => setOver16(o.v)} className="h-4 w-4 accent-brand-600" />
              {o.label}
            </label>
          ))}
        </div>
        {over16 === false && (
          <div className="mt-4">
            <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700">Parent or guardian&apos;s email</label>
            <input id="parentEmail" type="email" required value={parentEmail} onChange={e => setParentEmail(e.target.value)} className="input mt-2" autoComplete="off" />
            <p className="mt-2 text-xs leading-relaxed text-gray-500">We&apos;ll ask them to agree. You can start as soon as they do.</p>
          </div>
        )}
      </fieldset>

      <p className="text-sm leading-relaxed text-gray-600">
        You start on Free: {FREE_DAILY_QUESTIONS} questions a day, no card needed. <Link href="/terms" className="font-semibold text-brand-700 hover:underline">Terms</Link> and <Link href="/privacy" className="font-semibold text-brand-700 hover:underline">privacy</Link>.
      </p>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="btn btn-secondary flex-1">Back</button>
        <button type="submit" disabled={busy} className="btn btn-primary flex-1">{busy ? 'Setting up…' : 'Start practising'}</button>
      </div>
    </form>
  )
}
