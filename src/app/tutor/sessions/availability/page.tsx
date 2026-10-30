'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { CalendarFeedCard } from '@/components/calendar-feed-card'

interface Window { weekday: number; startMinute: number; endMinute: number }
interface Settings {
  enabled: boolean
  timezone: string
  slot_minutes: number
  buffer_minutes: number
  min_notice_hours: number
  max_days_ahead: number
  cancel_notice_hours: number
  windows: Window[]
}

// Monday first, as people plan their week
const DAYS = [1, 2, 3, 4, 5, 6, 0]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fromTime = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export default function AvailabilityPage() {
  const [s, setS] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string[] | null>(null)
  const zones = useMemo(() => { try { return Intl.supportedValuesOf('timeZone') } catch { return ['Europe/Zurich'] } }, [])

  useEffect(() => { fetch('/api/booking/settings').then(r => r.json()).then(d => setS({ ...d.settings, windows: d.settings.windows || [] })) }, [])

  function patch(p: Partial<Settings>) { setS(prev => (prev ? { ...prev, ...p } : prev)); setSaved(false) }
  function setDay(weekday: number, list: Window[]) { if (!s) return; patch({ windows: [...s.windows.filter(w => w.weekday !== weekday), ...list].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute) }) }

  async function save() {
    if (!s) return
    setSaving(true); setError(null)
    const res = await fetch('/api/booking/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error || 'Could not save'); return }
    setS({ ...d.settings, windows: d.settings.windows || [] })
    setSaved(true)
    if (d.settings.enabled) {
      const p = await (await fetch(`/api/booking/slots?tutorId=${d.settings.tutor_user_id}`)).json()
      setPreview(p.slots || [])
    } else setPreview(null)
  }

  if (!s) return <div className="space-y-4"><div className="h-10 w-64 skeleton" /><div className="h-96 skeleton" /></div>
  const Back = Icons.chevronLeft
  const Plus = Icons.plus
  const X = Icons.x
  const hoursPerWeek = s.windows.reduce((n, w) => n + (w.endMinute - w.startMinute), 0) / 60

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/tutor/sessions" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink"><Back className="h-4 w-4" /> Sessions</Link>
        <h1 className="page-title mt-2">Availability</h1>
        <p className="page-subtitle">When students can book sessions with you. Booked sessions and busy times in your Google calendar are left out automatically.</p>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="font-extrabold text-ink">Take bookings</p>
          <p className="text-sm text-gray-500">{s.enabled ? 'Your students can pick a time from their dashboard.' : 'Students can’t book yet.'}</p>
        </div>
        <button type="button" role="switch" aria-checked={s.enabled} onClick={() => patch({ enabled: !s.enabled })} className={`relative h-8 w-14 rounded-full transition-colors ${s.enabled ? 'bg-brand-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-7' : 'left-1'}`} />
          <span className="sr-only">Take bookings</span>
        </button>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Weekly hours</h2>
          <span className="chip tnum">{hoursPerWeek.toFixed(hoursPerWeek % 1 ? 1 : 0)} h a week</span>
        </div>
        <ul className="divide-y divide-line">
          {DAYS.map(day => {
            const list = s.windows.filter(w => w.weekday === day)
            return (
              <li key={day} className="grid gap-3 px-5 py-4 sm:grid-cols-[7.5rem_1fr] sm:px-6">
                <span className={`pt-2 text-sm font-bold ${list.length ? 'text-ink' : 'text-gray-400'}`}>{DAY_NAMES[day]}</span>
                <div className="space-y-2">
                  {list.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" step={900} value={toTime(w.startMinute)} onChange={e => setDay(day, list.map((x, j) => j === i ? { ...x, startMinute: fromTime(e.target.value) } : x))} className="input !min-h-10 w-32 tnum" aria-label={`${DAY_NAMES[day]} from`} />
                      <span className="text-gray-400">–</span>
                      <input type="time" step={900} value={toTime(w.endMinute)} onChange={e => setDay(day, list.map((x, j) => j === i ? { ...x, endMinute: fromTime(e.target.value) } : x))} className="input !min-h-10 w-32 tnum" aria-label={`${DAY_NAMES[day]} until`} />
                      <button type="button" onClick={() => setDay(day, list.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-gray-400 hover:bg-paper hover:text-ink" aria-label="Remove these hours"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => { const last = list[list.length - 1]; const start = last ? Math.min(last.endMinute + 60, 22 * 60) : 15 * 60; setDay(day, [...list, { weekday: day, startMinute: start, endMinute: Math.min(start + 180, 23 * 60) }]) }} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                    <Plus className="h-4 w-4" /> {list.length ? 'Add more hours' : 'Add hours'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="card-title">Booking rules</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className="label">Time zone</span>
            <select value={s.timezone} onChange={e => patch({ timezone: e.target.value })} className="input">{zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}</select>
          </label>
          <label><span className="label">Session length</span>
            <select value={s.slot_minutes} onChange={e => patch({ slot_minutes: Number(e.target.value) })} className="input">{[30, 45, 60, 75, 90, 120].map(m => <option key={m} value={m}>{m} minutes</option>)}</select>
          </label>
          <label><span className="label inline-flex items-center gap-1">Break between sessions <InfoTip text="Kept free before and after every session and busy time." className="text-gray-400" /></span>
            <select value={s.buffer_minutes} onChange={e => patch({ buffer_minutes: Number(e.target.value) })} className="input">{[0, 5, 10, 15, 30, 45, 60].map(m => <option key={m} value={m}>{m ? `${m} minutes` : 'None'}</option>)}</select>
          </label>
          <label><span className="label">Book at least</span>
            <select value={s.min_notice_hours} onChange={e => patch({ min_notice_hours: Number(e.target.value) })} className="input">{[0, 2, 6, 12, 24, 48, 72].map(h => <option key={h} value={h}>{h ? `${h} hours ahead` : 'Any time'}</option>)}</select>
          </label>
          <label><span className="label">Book up to</span>
            <select value={s.max_days_ahead} onChange={e => patch({ max_days_ahead: Number(e.target.value) })} className="input">{[7, 14, 21, 28, 42, 56, 90].map(d => <option key={d} value={d}>{d} days ahead</option>)}</select>
          </label>
          <label><span className="label inline-flex items-center gap-1">Students can cancel <InfoTip text="Later than this, students see a note to message you instead. You can always cancel." className="text-gray-400" /></span>
            <select value={s.cancel_notice_hours} onChange={e => patch({ cancel_notice_hours: Number(e.target.value) })} className="input">{[0, 2, 6, 12, 24, 48].map(h => <option key={h} value={h}>{h ? `up to ${h} hours before` : 'any time before'}</option>)}</select>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save availability'}</button>
        {saved && <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1f6b43]" role="status"><Icons.check className="h-4 w-4" /> Saved</span>}
        {error && <span className="text-sm font-semibold text-[#9b2c2c]" role="alert">{error}</span>}
      </div>

      {preview && (
        <section className="card p-5 sm:p-6">
          <h2 className="card-title">What students see</h2>
          <p className="mt-1 text-sm text-gray-500">{preview.length ? `${preview.length} free times in the next ${s.max_days_ahead} days. The first few:` : 'No free times with these hours. Add hours or loosen the rules.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {preview.slice(0, 8).map(iso => <span key={iso} className="chip tnum">{new Intl.DateTimeFormat(undefined, { timeZone: s.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))}</span>)}
          </div>
        </section>
      )}

      <CalendarFeedCard />
    </div>
  )
}
