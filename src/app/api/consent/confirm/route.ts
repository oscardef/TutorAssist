import { NextResponse } from 'next/server'
import { confirmConsent, findConsent } from '@/lib/consent'

/** A parent or guardian agrees from the link in their email. Public: the token is the proof. */
export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({})) as { token?: string }
  if (!token || typeof token !== 'string' || token.length > 100) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  const consent = await findConsent(token)
  if (!consent) return NextResponse.json({ error: 'This link is not valid any more. Ask your child to send a new one from Mathium.' }, { status: 404 })
  if (!consent.confirmed_at) await confirmConsent(token)
  return NextResponse.json({ ok: true })
}
