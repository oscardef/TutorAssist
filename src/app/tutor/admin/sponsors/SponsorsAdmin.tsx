'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '@/lib/dates'

interface Message {
  id: string
  sponsor: string
  headline: string
  body: string | null
  link_url: string
  link_label: string
  active: boolean
  weight: number
  starts_on: string | null
  ends_on: string | null
  impressions: number
  clicks: number
}

const empty = { sponsor: '', headline: '', body: '', link_url: 'https://', link_label: 'Find out more', weight: 1, starts_on: '', ends_on: '' }

export default function SponsorsAdmin() {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => setMessages((await (await fetch('/api/admin/sponsors')).json()).messages), [])
  useEffect(() => { void load() }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/admin/sponsors', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { ...form, id: editing } : form),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d.error || 'Could not save'); return }
    setForm(empty)
    setEditing(null)
    await load()
  }
  async function toggle(m: Message) {
    await fetch('/api/admin/sponsors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, active: !m.active }) })
    await load()
  }
  async function remove(m: Message) {
    await fetch(`/api/admin/sponsors?id=${m.id}`, { method: 'DELETE' })
    await load()
  }
  const field = (k: keyof typeof empty) => ({ value: String(form[k] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value })) })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Sponsor messages</h1>
        <p className="page-subtitle max-w-3xl">
          Students on the Free plan see one short text message on Home, on Practice and when the daily questions are used up, never during a question. No images or scripts are loaded, and only total views and clicks are counted.
        </p>
        <p className="mt-3 max-w-3xl text-sm text-gray-600">
          Only choose sponsors that are right for children: nothing for food or drink high in fat, salt or sugar, gambling, dating, alcohol, crypto, weight loss or anything for adults.
        </p>
      </div>


      <section className="card overflow-hidden">
        <div className="card-header"><h2 className="card-title">Messages</h2></div>
        {!messages ? <div className="h-24 skeleton m-5" /> : messages.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-gray-500">None yet. Without an active message, Free students see a short note about Plus instead.</p>
        ) : (
          <ul className="divide-y divide-line">
            {messages.map(m => (
              <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">Sponsored by {m.sponsor}</p>
                  <p className="font-bold text-ink">{m.headline}</p>
                  {m.body && <p className="text-sm text-gray-600">{m.body}</p>}
                  <p className="mt-1 truncate text-xs text-gray-500 tnum">
                    {m.link_url}, {m.impressions} views, {m.clicks} clicks{m.starts_on || m.ends_on ? `, ${m.starts_on ? `from ${formatDate(m.starts_on)}` : ''}${m.starts_on && m.ends_on ? ' ' : ''}${m.ends_on ? `until ${formatDate(m.ends_on)}` : ''}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" role="switch" aria-checked={m.active} onClick={() => toggle(m)} className={`btn btn-sm ${m.active ? 'btn-primary' : 'btn-secondary'}`}>{m.active ? 'On' : 'Off'}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(m.id); setForm({ sponsor: m.sponsor, headline: m.headline, body: m.body || '', link_url: m.link_url, link_label: m.link_label, weight: m.weight, starts_on: m.starts_on || '', ends_on: m.ends_on || '' }); document.getElementById('sponsor-form')?.scrollIntoView({ behavior: 'smooth' }) }}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm text-[#9b2c2c]" onClick={() => remove(m)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form id="sponsor-form" onSubmit={save} className="card max-w-3xl scroll-mt-6 space-y-4 p-5 sm:p-6">
        <h2 className="card-title">{editing ? 'Edit message' : 'New message'}</h2>
        {error && <div className="alert-error" role="alert">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="sp-sponsor" className="block text-sm font-medium text-gray-700">Sponsor</label><input id="sp-sponsor" className="input mt-1.5" maxLength={60} required {...field('sponsor')} /></div>
          <div><label htmlFor="sp-label" className="block text-sm font-medium text-gray-700">Button text</label><input id="sp-label" className="input mt-1.5" maxLength={30} {...field('link_label')} /></div>
          <div className="sm:col-span-2"><label htmlFor="sp-headline" className="block text-sm font-medium text-gray-700">Headline</label><input id="sp-headline" className="input mt-1.5" maxLength={90} required {...field('headline')} /></div>
          <div className="sm:col-span-2"><label htmlFor="sp-body" className="block text-sm font-medium text-gray-700">One more line (optional)</label><input id="sp-body" className="input mt-1.5" maxLength={160} {...field('body')} /></div>
          <div className="sm:col-span-2"><label htmlFor="sp-url" className="block text-sm font-medium text-gray-700">Link</label><input id="sp-url" type="url" className="input mt-1.5" required {...field('link_url')} /></div>
          <div><label htmlFor="sp-start" className="block text-sm font-medium text-gray-700">From (optional)</label><input id="sp-start" type="date" className="input mt-1.5" {...field('starts_on')} /></div>
          <div><label htmlFor="sp-end" className="block text-sm font-medium text-gray-700">Until (optional)</label><input id="sp-end" type="date" className="input mt-1.5" {...field('ends_on')} /></div>
          <div><label htmlFor="sp-weight" className="block text-sm font-medium text-gray-700">How often, 1 to 10</label><input id="sp-weight" type="number" min={1} max={10} className="input mt-1.5" {...field('weight')} /></div>
        </div>
        <div className="flex justify-end gap-3">
          {editing && <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setForm(empty) }}>Cancel</button>}
          <button type="submit" className="btn btn-primary">{editing ? 'Save changes' : 'Add message'}</button>
        </div>
        {!editing && <p className="text-xs text-gray-500">New messages start switched off. Switch one on below when it is ready.</p>}
      </form>
    </div>
  )
}
