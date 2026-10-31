import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { parentConsentEmail } from '@/lib/email-templates'

/**
 * Parental agreement for students under 16 who sign up without a tutor
 * (terms and privacy policy). The link carries a random token; only its
 * hash is stored.
 */

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const RESEND_AFTER_MS = 2 * 60_000
export const MAX_SENDS = 5

export async function requestParentConsent(params: { studentUserId: string; childName: string; childEmail: string; parentEmail: string; resend?: boolean }) {
  const admin = await createAdminClient()
  const token = randomBytes(24).toString('base64url')
  const { data: existing } = await admin.from('parental_consents').select('sent_at, send_count, confirmed_at').eq('student_user_id', params.studentUserId).maybeSingle()
  if (existing?.confirmed_at) return { ok: true as const }
  if (existing && params.resend) {
    if (existing.send_count >= MAX_SENDS) return { ok: false as const, error: 'We have sent this email five times. Write to us and we will help.' }
    if (Date.now() - Date.parse(existing.sent_at) < RESEND_AFTER_MS) return { ok: false as const, error: 'We sent it a moment ago. Give it a couple of minutes, and check the spam folder.' }
  }
  const row = {
    student_user_id: params.studentUserId,
    parent_email: params.parentEmail,
    token_hash: hashToken(token),
    sent_at: new Date().toISOString(),
    send_count: (existing?.send_count ?? 0) + 1,
  }
  const { error } = await admin.from('parental_consents').upsert(row, { onConflict: 'student_user_id' })
  if (error) throw new Error(error.message)
  await sendEmail({
    to: params.parentEmail,
    subject: `Please confirm ${params.childName.split(' ')[0] || 'your child'}'s Mathium account`,
    html: parentConsentEmail({ childName: params.childName, childEmail: params.childEmail, url: `${appUrl()}/consent/${token}`, privacyUrl: `${appUrl()}/privacy`, contact: process.env.PRIVACY_CONTACT_EMAIL || 'privacy@mathium.app' }),
  })
  return { ok: true as const }
}

export async function findConsent(token: string) {
  const admin = await createAdminClient()
  const { data } = await admin.from('parental_consents').select('student_user_id, parent_email, confirmed_at').eq('token_hash', hashToken(token)).maybeSingle()
  return data as { student_user_id: string; parent_email: string; confirmed_at: string | null } | null
}

export async function confirmConsent(token: string) {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('parental_consents')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('token_hash', hashToken(token))
    .is('confirmed_at', null)
    .select('student_user_id')
    .maybeSingle()
  return !!data
}
