'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icons } from '@/components/ui/icons'

interface SlotsResponse { tutors: { id: string; name: string }[]; tutorId: string | null; timezone?: string; slotMinutes?: number; cancelNoticeHours?: number; slots: string[]; error?: string }

export default function BookPage() {
  const [data, setData] = useState<SlotsResponse | null>(null)
  const [tutorId, setTutorId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async (id: string | null) => {
    const res = await fetch(`/api/booking/slots${id ? `?tutorId=${id}` : ''}`)
    const d = (await res.json()) as SlotsResponse
    setData(d)
    setTutorId(d.tutorId)
    setPicked(null)
  }, [])
  useEffect(() => { void load(null) }, [load])

  const myZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const days = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const iso of data?.slots ?? []) {
      const key = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
      map.set(key, [...(map.get(key) ?? []), iso])
    }
    return [...map.entries()]
  }, [data])

  async function book() {
    if (!picked || !tutorId) return
    setBooking(true); setError(null)
    const res = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tutorId, start: picked }) })
    const d = await res.json()
    setBooking(false)
    if (!res.ok) { setError(d.error || 'Could not book that time'); if (res.status === 409) void load(tutorId); return }
    setDone(picked)
  }

  const fmtDay = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
  const fmtTime = (iso: string) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  const Back = Icons.chevronLeft
  const Check = Icons.check
  const Cal = Icons.calendar
  const tutorName = data?.tutors.find(t => t.id === tutorId)?.name

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e3f4ea] text-[#1f6b43]"><Check className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-ink">You’re booked</h1>
        <p className="mt-2 text-gray-600">{fmtDay(done)} at {fmtTime(done)}{tutorName ? ` with ${tutorName}` : ''}. You’ll find it on your dashboard, and you’ll get an email.</p>
        <Link href="/student/dashboard" className="btn btn-primary mt-6">Back to home</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/student/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink"><Back className="h-4 w-4" /> Home</Link>
        <h1 className="page-title mt-2">Book a session</h1>
        <p className="page-subtitle">Pick a time that works for you. Times are shown in your time zone ({myZone.replace(/_/g, ' ')}).</p>
      </div>

      {data && data.tutors.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Tutor">
          {data.tutors.map(t => <button key={t.id} type="button" role="tab" aria-selected={t.id === tutorId} onClick={() => load(t.id)} className={`chip ${t.id === tutorId ? 'chip-brand' : ''}`}>{t.name}</button>)}
        </div>
      )}

      {!data ? (
        <div className="space-y-3"><div className="h-24 skeleton" /><div className="h-24 skeleton" /></div>
      ) : data.tutors.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Cal className="h-6 w-6" /></div>
          <p className="mt-4 font-bold text-ink">Booking isn’t open yet</p>
          <p className="mt-1 text-sm text-gray-500">Your tutor hasn’t shared their hours. Ask them to set up availability.</p>
        </div>
      ) : days.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="font-bold text-ink">No free times right now</p>
          <p className="mt-1 text-sm text-gray-500">Check back later, or message {tutorName || 'your tutor'} to find a time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([key, slots]) => (
            <section key={key} className="card p-4 sm:p-5">
              <h2 className="text-sm font-extrabold text-ink">{fmtDay(slots[0])}</h2>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={fmtDay(slots[0])}>
                {slots.map(iso => (
                  <button key={iso} type="button" role="radio" aria-checked={picked === iso} onClick={() => { setPicked(iso); setError(null) }} className={`rounded-xl border-2 px-4 py-2 text-sm font-bold tnum transition-colors ${picked === iso ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink hover:border-brand-300'}`}>
                    {fmtTime(iso)}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {picked && (
        <div className="sticky bottom-20 z-10 lg:bottom-4">
          <div className="card flex flex-wrap items-center gap-3 border-brand-200 p-4 shadow-lg">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-ink">{fmtDay(picked)}, {fmtTime(picked)}</p>
              <p className="text-sm text-gray-500">{data?.slotMinutes} minutes{tutorName ? ` with ${tutorName}` : ''}{data?.cancelNoticeHours ? ` · cancel up to ${data.cancelNoticeHours} h before` : ''}</p>
              {error && <p className="mt-1 text-sm font-semibold text-[#9b2c2c]" role="alert">{error}</p>}
            </div>
            <button type="button" onClick={book} disabled={booking} className="btn btn-primary">{booking ? 'Booking…' : 'Book this time'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
