import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

/** Sponsor messages shown to Free students. Platform owners only. */
async function owner() {
  const context = await getUserContext()
  return context?.isPlatformOwner ? context : null
}

const FIELDS = ['sponsor', 'headline', 'body', 'link_url', 'link_label', 'active', 'weight', 'starts_on', 'ends_on'] as const

function clean(body: Record<string, unknown>): { row?: Record<string, unknown>; error?: string } {
  const row: Record<string, unknown> = {}
  for (const f of FIELDS) if (f in body) row[f] = body[f]
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : v)
  if ('sponsor' in row) row.sponsor = text(row.sponsor, 60)
  if ('headline' in row) row.headline = text(row.headline, 90)
  if ('body' in row) row.body = text(row.body, 160) || null
  if ('link_label' in row) row.link_label = text(row.link_label, 30) || 'Find out more'
  if ('link_url' in row) {
    const url = String(row.link_url || '').trim()
    try { if (new URL(url).protocol !== 'https:') return { error: 'The link must start with https://' } } catch { return { error: 'Enter the full link, starting with https://' } }
    row.link_url = url
  }
  if ('weight' in row) row.weight = Math.min(10, Math.max(1, Math.round(Number(row.weight) || 1)))
  for (const d of ['starts_on', 'ends_on'] as const) if (d in row) row[d] = row[d] || null
  if ('active' in row) row.active = !!row.active
  return { row }
}

export async function GET() {
  if (!(await owner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = await createAdminClient()
  const { data } = await admin.from('sponsor_messages').select('*').order('created_at', { ascending: false })
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(request: Request) {
  const context = await owner()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { row, error } = clean(await request.json().catch(() => ({})))
  if (error || !row) return NextResponse.json({ error }, { status: 400 })
  if (!row.sponsor || !row.headline || !row.link_url) return NextResponse.json({ error: 'Sponsor, headline and link are needed.' }, { status: 400 })
  const admin = await createAdminClient()
  const { error: dbError } = await admin.from('sponsor_messages').insert({ ...row, created_by: context.userId })
  if (dbError) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  if (!(await owner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = String(body.id || '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { row, error } = clean(body)
  if (error || !row) return NextResponse.json({ error }, { status: 400 })
  const admin = await createAdminClient()
  const { error: dbError } = await admin.from('sponsor_messages').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
  if (dbError) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  if (!(await owner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const admin = await createAdminClient()
  await admin.from('sponsor_messages').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
