'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '@/lib/dates'
import { Ledger, LedgerItem } from '@/components/ui/ledger'

interface Student {
  userId: string
  name: string | null
  email: string | null
  joined: string
  course: string
  plan: 'free' | 'plus'
  source: 'stripe' | 'grant' | null
  periodEnd: string | null
  cancelling: boolean
  note: string | null
  consent: 'confirmed' | 'pending' | 'not needed'
}

export default function PlansAdmin() {
  const [data, setData] = useState<{ billingEnabled: boolean; students: Student[] } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => setData(await (await fetch('/api/admin/plans')).json()), [])
  useEffect(() => { void load() }, [load])

  async function setPlan(s: Student, plan: 'free' | 'plus') {
    const res = await fetch('/api/admin/plans', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: s.userId, plan }) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? (plan === 'plus' ? `Plus given to ${s.name || s.email}` : `${s.name || s.email} is on Free`) : d.error || 'Could not save')
    setTimeout(() => setMsg(null), 3000)
    await load()
  }

  if (!data) return <div className="space-y-4"><div className="h-10 w-64 skeleton" /><div className="h-64 skeleton" /></div>
  const plus = data.students.filter(s => s.plan === 'plus')
  const paying = plus.filter(s => s.source === 'stripe')
  const pending = data.students.filter(s => s.consent === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Plans</h1>
          <p className="page-subtitle">Students practising without a tutor. {data.billingEnabled ? 'Stripe billing is on.' : 'Stripe billing is off: Plus can only be given by hand.'}</p>
        </div>
        {msg && <span className="chip chip-good" role="status">{msg}</span>}
      </div>

      <Ledger>
        <LedgerItem label="Students on their own" value={data.students.length} />
        <LedgerItem label="On Plus" value={plus.length} tone="good" />
        <LedgerItem label="Paying" value={paying.length} />
        <LedgerItem label="Waiting for a parent" value={pending.length} tone={pending.length ? 'spark' : undefined} />
      </Ledger>

      <section className="card overflow-hidden">
        {data.students.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-bold text-ink">No students on their own yet</p>
            <p className="mt-1 text-sm text-gray-500">They appear here once they sign up and choose to practise without a tutor.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.students.map(s => (
              <li key={s.userId} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{s.name || s.email}</p>
                  <p className="truncate text-xs text-gray-500">
                    {[s.email, s.course || 'No course', `joined ${formatDate(s.joined)}`, s.consent === 'pending' ? 'waiting for a parent' : s.consent === 'confirmed' ? 'parent agreed' : null].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className={`font-bold ${s.plan === 'plus' ? 'text-brand-700' : 'text-ink'}`}>{s.plan === 'plus' ? 'Plus' : 'Free'}</p>
                  <p className="text-xs text-gray-500">
                    {s.plan === 'plus' ? (s.source === 'stripe' ? (s.cancelling ? `pays, ends ${s.periodEnd ? formatDate(s.periodEnd) : ''}` : `pays, renews ${s.periodEnd ? formatDate(s.periodEnd) : ''}`) : 'given by hand') : ''}
                  </p>
                </div>
                {s.source !== 'stripe' || s.plan === 'free' ? (
                  s.plan === 'plus'
                    ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlan(s, 'free')}>Back to Free</button>
                    : <button type="button" className="btn btn-primary btn-sm" onClick={() => setPlan(s, 'plus')}>Give Plus</button>
                ) : <span className="w-[6.5rem]" />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
