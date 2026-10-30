'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { InfoTip } from '@/components/ui/info-tip'
import { formatDate } from '@/lib/dates'

type Scope = 'global' | 'role' | 'workspace' | 'user'
interface Limit { scope: Scope; subject: string | null; ai_enabled: boolean | null; daily_requests: number | null; monthly_requests: number | null; monthly_cost_usd: string | number | null; note: string | null }
interface Person { user_id: string; role: string; workspace_id: string; name: string | null; email: string | null }
interface UsageRow { user_id: string | null; workspace_id: string | null; day: number; month: number; cost: number }
interface Data { monthStart: string; limits: Limit[]; workspaces: { id: string; name: string }[]; people: Person[]; usage: UsageRow[]; operations: { op: string; n: number; cost: number }[]; envAllowed: string[]; owners: string[] }

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`

export default function AiAdmin() {
  const [data, setData] = useState<Data | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => setData(await (await fetch('/api/admin/ai')).json()), [])
  useEffect(() => { void load() }, [load])

  const find = useCallback((scope: Scope, subject: string | null) => data?.limits.find(l => l.scope === scope && (l.subject ?? null) === subject), [data])
  async function save(row: Partial<Limit> & { scope: Scope; subject: string | null }) {
    const res = await fetch('/api/admin/ai', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })
    setMsg(res.ok ? 'Saved' : 'Could not save'); setTimeout(() => setMsg(null), 2000)
    await load()
  }
  async function clear(scope: 'workspace' | 'user', subject: string) {
    await fetch(`/api/admin/ai?scope=${scope}&subject=${subject}`, { method: 'DELETE' })
    await load()
  }

  const totals = useMemo(() => {
    const u = data?.usage ?? []
    const byUser = new Map<string, UsageRow>()
    const byWs = new Map<string, UsageRow>()
    for (const r of u) {
      if (r.user_id) { const x = byUser.get(r.user_id) ?? { user_id: r.user_id, workspace_id: null, day: 0, month: 0, cost: 0 }; x.day += r.day; x.month += r.month; x.cost += r.cost; byUser.set(r.user_id, x) }
      if (r.workspace_id) { const x = byWs.get(r.workspace_id) ?? { user_id: null, workspace_id: r.workspace_id, day: 0, month: 0, cost: 0 }; x.day += r.day; x.month += r.month; x.cost += r.cost; byWs.set(r.workspace_id, x) }
    }
    const all = u.reduce((a, r) => ({ day: a.day + r.day, month: a.month + r.month, cost: a.cost + r.cost }), { day: 0, month: 0, cost: 0 })
    return { byUser, byWs, all }
  }, [data])

  if (!data) return <div className="space-y-4"><div className="h-10 w-64 skeleton" /><div className="h-64 skeleton" /></div>
  const global = find('global', null)
  const budget = global?.monthly_cost_usd != null ? Number(global.monthly_cost_usd) : null
  const pct = budget ? Math.min(100, (totals.all.cost / budget) * 100) : 0
  const wsName = (id: string) => data.workspaces.find(w => w.id === id)?.name ?? '—'
  const people = [...new Map(data.people.map(p => [p.user_id, p])).values()].sort((a, b) => (totals.byUser.get(b.user_id)?.cost ?? 0) - (totals.byUser.get(a.user_id)?.cost ?? 0))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">AI usage</h1>
          <p className="page-subtitle">Who can use AI features and how much, since {formatDate(data.monthStart)}. Limits left empty are inherited.</p>
        </div>
        {msg && <span className="chip chip-good" role="status">{msg}</span>}
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="card-title inline-flex items-center gap-1.5">Platform <InfoTip text="The switch pauses AI for everyone except platform owners. The budget is the most all AI use may cost in a calendar month." className="text-gray-400" /></h2>
            <p className="mt-1 text-sm text-gray-500 tnum">{totals.all.day} requests today · {totals.all.month} this month · {usd(totals.all.cost)}{budget !== null ? ` of ${usd(budget)}` : ''}</p>
          </div>
          <Switch on={global?.ai_enabled !== false} label="AI features on" onChange={v => save({ ...(global ?? { scope: 'global', subject: null }), scope: 'global', subject: null, ai_enabled: v })} />
        </div>
        {budget !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${pct > 85 ? 'bg-[#c53030]' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} /></div>}
        <CapsEditor row={global} scope="global" subject={null} onSave={save} showEnabled={false} />
        {data.operations.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
            {data.operations.map(o => <span key={o.op} className="chip tnum">{o.op.replace(/_/g, ' ')} · {o.n} · {usd(o.cost)}</span>)}
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="card-title inline-flex items-center gap-1.5">Defaults by role <InfoTip text="Applies to each person with this role unless their workspace or they themselves have their own setting. Caps count that person's own use." className="text-gray-400" /></h2>
        {(['tutor', 'student'] as const).map(r => (
          <div key={r} className="mt-4 border-t border-line pt-4 first:mt-3 first:border-0 first:pt-0">
            <p className="text-sm font-bold capitalize text-ink">{r}s</p>
            <CapsEditor row={find('role', r)} scope="role" subject={r} onSave={save} enabledLabel={`AI on for new ${r}s`} />
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title inline-flex items-center gap-1.5">People <InfoTip text="Override for one person. Caps here replace the role defaults for them. Emails in AI_ALLOWED_EMAILS are switched on unless set to Off here." className="text-gray-400" /></h2></div>
        <ul className="divide-y divide-line">
          {people.map(p => {
            const row = find('user', p.user_id)
            const u = totals.byUser.get(p.user_id)
            return (
              <li key={p.user_id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{p.name || p.email}</p>
                    <p className="truncate text-xs text-gray-500">{p.email} · {p.role.replace('_', ' ')} · {wsName(p.workspace_id)}{data.envAllowed.includes((p.email || '').toLowerCase()) ? ' · on via AI_ALLOWED_EMAILS' : ''}</p>
                  </div>
                  <p className="text-xs text-gray-500 tnum">{u ? `${u.day} today · ${u.month} this month · ${usd(u.cost)}` : 'No AI use this month'}</p>
                </div>
                <CapsEditor row={row} scope="user" subject={p.user_id} onSave={save} onClear={row ? () => clear('user', p.user_id) : undefined} tri disabled={p.role === 'platform_owner' || data.owners.includes((p.email || '').toLowerCase())} />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="card-title inline-flex items-center gap-1.5">Workspaces <InfoTip text="On/Off applies to everyone in the workspace who has no personal setting. Caps here count the whole workspace's use together." className="text-gray-400" /></h2></div>
        <ul className="divide-y divide-line">
          {data.workspaces.map(w => {
            const row = find('workspace', w.id)
            const u = totals.byWs.get(w.id)
            return (
              <li key={w.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-ink">{w.name}</p>
                  <p className="text-xs text-gray-500 tnum">{u ? `${u.day} today · ${u.month} this month · ${usd(u.cost)}` : 'No AI use this month'}</p>
                </div>
                <CapsEditor row={row} scope="workspace" subject={w.id} onSave={save} onClear={row ? () => clear('workspace', w.id) : undefined} tri />
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-8 w-14 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-gray-300'}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

/** Inline editor for one limit row. `tri` adds Inherit/On/Off for overrides. */
function CapsEditor({ row, scope, subject, onSave, onClear, tri = false, showEnabled = true, enabledLabel, disabled = false }: {
  row?: Limit; scope: Scope; subject: string | null; onSave: (r: Partial<Limit> & { scope: Scope; subject: string | null }) => void; onClear?: () => void
  tri?: boolean; showEnabled?: boolean; enabledLabel?: string; disabled?: boolean
}) {
  const [enabled, setEnabled] = useState<'inherit' | 'on' | 'off'>(row?.ai_enabled === true ? 'on' : row?.ai_enabled === false ? 'off' : 'inherit')
  const [daily, setDaily] = useState(row?.daily_requests?.toString() ?? '')
  const [monthly, setMonthly] = useState(row?.monthly_requests?.toString() ?? '')
  const [cost, setCost] = useState(row?.monthly_cost_usd != null ? String(Number(row.monthly_cost_usd)) : '')
  if (disabled) return <p className="mt-2 text-xs text-gray-500">Platform owners are never limited.</p>
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
      {showEnabled && (tri ? (
        <label><span className="hint block">AI</span>
          <select value={enabled} onChange={e => setEnabled(e.target.value as typeof enabled)} className="input !min-h-9 !py-1 w-28">
            <option value="inherit">Inherit</option><option value="on">On</option><option value="off">Off</option>
          </select>
        </label>
      ) : (
        <label className="inline-flex items-center gap-2 pb-2 text-gray-700"><input type="checkbox" checked={enabled === 'on'} onChange={e => setEnabled(e.target.checked ? 'on' : 'off')} className="h-4 w-4 accent-brand-600" /> {enabledLabel}</label>
      ))}
      <label><span className="hint block">Per day</span><input value={daily} onChange={e => setDaily(e.target.value.replace(/[^0-9]/g, ''))} placeholder="inherit" className="input !min-h-9 !py-1 w-24 tnum" inputMode="numeric" /></label>
      <label><span className="hint block">Per month</span><input value={monthly} onChange={e => setMonthly(e.target.value.replace(/[^0-9]/g, ''))} placeholder="inherit" className="input !min-h-9 !py-1 w-24 tnum" inputMode="numeric" /></label>
      <label><span className="hint block">$ per month</span><input value={cost} onChange={e => setCost(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="inherit" className="input !min-h-9 !py-1 w-24 tnum" inputMode="decimal" /></label>
      <button type="button" onClick={() => onSave({ scope, subject, ai_enabled: showEnabled ? (enabled === 'inherit' ? null : enabled === 'on') : row?.ai_enabled ?? null, daily_requests: daily === '' ? null : Number(daily), monthly_requests: monthly === '' ? null : Number(monthly), monthly_cost_usd: cost === '' ? null : Number(cost) })} className="btn btn-primary btn-sm">Save</button>
      {onClear && <button type="button" onClick={onClear} className="btn btn-ghost btn-sm">Reset</button>}
    </div>
  )
}
