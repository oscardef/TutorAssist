import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { getUsersByIds } from '@/lib/users'
import { planFromEntitlement } from '@/lib/plans'
import { billingEnabled } from '@/lib/billing'

/** Students practising on their own, and their plans. Platform owners only. */
async function owner() {
  const context = await getUserContext()
  return context?.isPlatformOwner ? context : null
}

export async function GET() {
  if (!(await owner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = await createAdminClient()
  const { data: members } = await admin.from('workspace_members').select('user_id, workspace_id, created_at, workspaces!inner(kind)').eq('workspaces.kind', 'solo').limit(5000)
  const rows = (members ?? []) as unknown as { user_id: string; workspace_id: string; created_at: string }[]
  const ids = rows.map(r => r.user_id)
  const [users, ents, consents, profiles] = await Promise.all([
    getUsersByIds(ids),
    ids.length ? admin.from('entitlements').select('*').in('user_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from('parental_consents').select('student_user_id, confirmed_at').in('student_user_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from('student_profiles').select('user_id, study_program:study_programs(code), grade_level:grade_levels(name)').in('user_id', ids) : Promise.resolve({ data: [] }),
  ])
  const ent = new Map(((ents.data ?? []) as Record<string, unknown>[]).map(e => [e.user_id as string, e]))
  const consent = new Map(((consents.data ?? []) as { student_user_id: string; confirmed_at: string | null }[]).map(c => [c.student_user_id, c]))
  const profile = new Map(((profiles.data ?? []) as unknown as { user_id: string; study_program: { code: string } | null; grade_level: { name: string } | null }[]).map(p => [p.user_id, p]))
  return NextResponse.json({
    billingEnabled: billingEnabled(),
    students: rows.map(r => {
      const e = ent.get(r.user_id) as Parameters<typeof planFromEntitlement>[0] & { source?: string; note?: string | null; cancel_at_period_end?: boolean } | undefined
      const c = consent.get(r.user_id)
      const p = profile.get(r.user_id)
      return {
        userId: r.user_id,
        name: users.get(r.user_id)?.name ?? null,
        email: users.get(r.user_id)?.email ?? null,
        joined: r.created_at,
        course: [p?.study_program?.code, p?.grade_level?.name].filter(Boolean).join(' '),
        plan: planFromEntitlement(e ?? null),
        source: e?.source ?? null,
        periodEnd: e?.current_period_end ?? null,
        cancelling: !!e?.cancel_at_period_end,
        note: e?.note ?? null,
        consent: c ? (c.confirmed_at ? 'confirmed' : 'pending') : 'not needed',
      }
    }).sort((a, b) => b.joined.localeCompare(a.joined)),
  })
}

/** Give or take back Plus by hand (beta testers, families who pay another way). */
export async function PUT(request: Request) {
  const context = await owner()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId, plan, note } = await request.json().catch(() => ({})) as { userId?: string; plan?: string; note?: string }
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || (plan !== 'plus' && plan !== 'free')) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const admin = await createAdminClient()
  const { data: existing } = await admin.from('entitlements').select('source, status').eq('user_id', userId).maybeSingle()
  if (existing?.source === 'stripe' && existing.status !== 'canceled') {
    return NextResponse.json({ error: 'This student pays through Stripe. Change it in the Stripe dashboard.' }, { status: 409 })
  }
  const { error } = await admin.from('entitlements').upsert({
    user_id: userId,
    plan,
    status: 'active',
    source: 'grant',
    current_period_end: null,
    cancel_at_period_end: false,
    billing_interval: null,
    granted_by: context.userId,
    note: note?.slice(0, 200) || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
