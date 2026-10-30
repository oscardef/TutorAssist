import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

function feedUrl(request: Request, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  return `${base}/api/calendar/feed/${token}`
}

/** The caller's private calendar subscription URL (created on first use). */
export async function GET(request: Request) {
  const user = await requireUser()
  const supabase = await createServerClient()
  const { data } = await supabase.from('calendar_feeds').select('token').eq('user_id', user.id).maybeSingle()
  if (data) return NextResponse.json({ url: feedUrl(request, data.token) })
  const token = randomBytes(24).toString('base64url')
  const { error } = await supabase.from('calendar_feeds').insert({ user_id: user.id, token })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: feedUrl(request, token) })
}

/** Replace the token, so an old shared URL stops working. */
export async function POST(request: Request) {
  const user = await requireUser()
  const token = randomBytes(24).toString('base64url')
  const supabase = await createServerClient()
  const { error } = await supabase.from('calendar_feeds').upsert({ user_id: user.id, token, created_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: feedUrl(request, token) })
}
