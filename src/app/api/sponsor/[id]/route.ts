import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/** Counts a click on a sponsor message and goes to the sponsor's page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = await createAdminClient()
  const { data } = await admin.from('sponsor_messages').select('link_url').eq('id', id).maybeSingle()
  const url = data?.link_url as string | undefined
  if (!url || !url.startsWith('https://')) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await admin.rpc('count_sponsor_event', { p_id: id, p_click: true })
  return NextResponse.redirect(url, 302)
}
