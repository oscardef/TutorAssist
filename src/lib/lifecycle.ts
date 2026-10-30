import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deleteAccount } from '@/lib/account'
import { sendEmail } from '@/lib/email'
import { inactivityEmail } from '@/lib/email-templates'
import { formatDate } from '@/lib/dates'

/**
 * Inactive accounts (privacy policy): after 23 months without a sign-in we
 * email a warning; 30 days later, if there was still no sign-in, the account
 * is deleted. Signing in at any point clears the warning. Platform owners are
 * never touched; tutors who are the only tutor of a workspace with students
 * are skipped and logged, because deleting them would remove other people's
 * work. Last activity is the latest of account creation, account update and
 * sign-in session activity.
 */
const GRACE_DAYS = 30

type Row = { id: string; email: string; name: string | null; warned_at: Date | null; last_active: Date }

export async function runAccountHygiene(): Promise<{ warned: number; deleted: number; skipped: number; reset: number }> {
  const owners = (process.env.PLATFORM_OWNER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  const rows = (await db.execute(sql`
    SELECT u.id, u.email, u.name, l.inactivity_warned_at AS warned_at,
           greatest(u.created_at, u.updated_at, coalesce(max(s.updated_at), u.created_at)) AS last_active
      FROM identity.users u
      LEFT JOIN identity.sessions s ON s.user_id = u.id
      LEFT JOIN public.account_lifecycle l ON l.user_id = u.id
     WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.user_id = u.id AND m.role = 'platform_owner')
     GROUP BY u.id, l.inactivity_warned_at`)) as unknown as Row[]

  const now = Date.now()
  const warnBefore = new Date(now)
  warnBefore.setMonth(warnBefore.getMonth() - 23)
  let warned = 0, deleted = 0, skipped = 0, reset = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mathium.app'

  for (const r of rows) {
    if (owners.includes(r.email.toLowerCase())) continue
    const lastActive = new Date(r.last_active).getTime()
    const warnedAt = r.warned_at ? new Date(r.warned_at).getTime() : null

    if (warnedAt && lastActive > warnedAt) {
      await db.execute(sql`UPDATE public.account_lifecycle SET inactivity_warned_at = NULL, updated_at = now() WHERE user_id = ${r.id}::uuid`)
      reset++
    } else if (!warnedAt && lastActive < warnBefore.getTime()) {
      const deleteOn = formatDate(new Date(now + GRACE_DAYS * 86_400_000), { withYear: true, tz: process.env.TZ })
      await sendEmail({ to: r.email, subject: 'Your Mathium account will be deleted soon', html: inactivityEmail({ name: r.name || '', deleteOn, url: `${appUrl}/login` }) }).catch(() => null)
      await db.execute(sql`INSERT INTO public.account_lifecycle (user_id, inactivity_warned_at) VALUES (${r.id}::uuid, now())
        ON CONFLICT (user_id) DO UPDATE SET inactivity_warned_at = now(), updated_at = now()`)
      warned++
    } else if (warnedAt && now - warnedAt > GRACE_DAYS * 86_400_000) {
      const result = await deleteAccount(r.id, false)
      if (result.ok) deleted++
      else { skipped++; console.warn(`[lifecycle] inactive tutor ${r.id} still has students; not deleted`) }
    }
  }
  return { warned, deleted, skipped, reset }
}

export const ACCOUNT_HYGIENE_INTERVAL_MS = 24 * 3600_000
