import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { requestParentConsent } from '@/lib/consent'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Send the parent's confirmation email again, optionally to a corrected address. */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { parentEmail?: string }
  const admin = await createAdminClient()
  const { data } = await admin.from('parental_consents').select('parent_email, confirmed_at').eq('student_user_id', user.id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Nothing to confirm' }, { status: 404 })
  if (data.confirmed_at) return NextResponse.json({ ok: true, confirmed: true })
  let parentEmail = data.parent_email as string
  if (body.parentEmail !== undefined) {
    const next = String(body.parentEmail).trim().toLowerCase()
    if (!EMAIL.test(next)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    if (next === user.email.toLowerCase()) return NextResponse.json({ error: "Use your parent or guardian's own email address, not yours." }, { status: 400 })
    parentEmail = next
    await admin.from('student_profiles').update({ parent_email: next }).eq('user_id', user.id)
  }
  try {
    const result = await requestParentConsent({ studentUserId: user.id, childName: user.name || '', childEmail: user.email, parentEmail, resend: true })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 429 })
  } catch (err) {
    console.error('[consent] resend failed', err)
    return NextResponse.json({ error: 'Could not send the email. Try again in a moment.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, parentEmail })
}
