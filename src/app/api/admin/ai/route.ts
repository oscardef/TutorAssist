import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getUserContext } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/server'
import { getUsersByIds } from '@/lib/users'
import { monthStart } from '@/lib/ai-policy'

/** AI limits and usage across the platform. Platform owners only. */
async function owner() {
  const context = await getUserContext()
  return context?.isPlatformOwner ? context : null
}

export async function GET() {
  const context = await owner()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = await createAdminClient()
  const since = monthStart()
  const [limits, members, workspaces, usage, ops] = await Promise.all([
    admin.from('ai_limits').select('scope, subject, ai_enabled, daily_requests, monthly_requests, monthly_cost_usd, note, updated_at'),
    admin.from('workspace_members').select('user_id, role, workspace_id'),
    admin.from('workspaces').select('id, name, slug'),
    db.execute(sql`SELECT user_id, workspace_id,
        count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS day,
        count(*)::int AS month,
        coalesce(sum(cost_usd), 0)::float AS cost
      FROM public.ai_usage_log WHERE created_at >= ${since.toISOString()}::timestamptz
      GROUP BY user_id, workspace_id`),
    db.execute(sql`SELECT operation_type AS op, count(*)::int AS n, coalesce(sum(cost_usd), 0)::float AS cost
      FROM public.ai_usage_log WHERE created_at >= ${since.toISOString()}::timestamptz
      GROUP BY operation_type ORDER BY cost DESC LIMIT 12`),
  ])
  const memberRows = (members.data ?? []) as { user_id: string; role: string; workspace_id: string }[]
  const users = await getUsersByIds([...new Set(memberRows.map(m => m.user_id))])
  return NextResponse.json({
    monthStart: since.toISOString(),
    limits: limits.data ?? [],
    workspaces: (workspaces.data ?? []).filter(w => w.slug !== 'mathium-archive'),
    people: memberRows.map(m => ({ ...m, name: users.get(m.user_id)?.name ?? null, email: users.get(m.user_id)?.email ?? null })),
    usage,
    operations: ops,
    envAllowed: (process.env.AI_ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
    owners: (process.env.PLATFORM_OWNER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
  })
}

/** Set a limit row; fields left null inherit. */
export async function PUT(request: Request) {
  const context = await owner()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await request.json().catch(() => ({})) as Record<string, unknown>
  const scope = String(b.scope)
  if (!['global', 'role', 'workspace', 'user'].includes(scope)) return NextResponse.json({ error: 'Bad scope' }, { status: 400 })
  const subject = scope === 'global' ? null : typeof b.subject === 'string' && b.subject ? b.subject : null
  if (scope !== 'global' && !subject) return NextResponse.json({ error: 'Subject required' }, { status: 400 })
  if (scope === 'role' && !['tutor', 'student'].includes(subject!)) return NextResponse.json({ error: 'Unknown role' }, { status: 400 })
  const int = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.max(0, Math.round(Number(v))))
  const money = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.max(0, Math.round(Number(v) * 100) / 100))
  const enabled = typeof b.ai_enabled === 'boolean' ? b.ai_enabled : null
  const daily = int(b.daily_requests), monthly = int(b.monthly_requests), cost = money(b.monthly_cost_usd)
  const note = typeof b.note === 'string' ? b.note.slice(0, 300) : null
  await db.execute(sql`INSERT INTO public.ai_limits (scope, subject, ai_enabled, daily_requests, monthly_requests, monthly_cost_usd, note, updated_by, updated_at)
    VALUES (${scope}, ${subject}, ${enabled}, ${daily}, ${monthly}, ${cost}, ${note}, ${context.userId}::uuid, now())
    ON CONFLICT (scope, (coalesce(subject, ''))) DO UPDATE SET ai_enabled = EXCLUDED.ai_enabled, daily_requests = EXCLUDED.daily_requests,
      monthly_requests = EXCLUDED.monthly_requests, monthly_cost_usd = EXCLUDED.monthly_cost_usd, note = EXCLUDED.note,
      updated_by = EXCLUDED.updated_by, updated_at = now()`)
  return NextResponse.json({ ok: true })
}

/** Remove a workspace or person override (back to inheriting). */
export async function DELETE(request: Request) {
  const context = await owner()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const u = new URL(request.url)
  const scope = u.searchParams.get('scope'), subject = u.searchParams.get('subject')
  if (!scope || !['workspace', 'user'].includes(scope) || !subject) return NextResponse.json({ error: 'Only workspace or person overrides can be removed' }, { status: 400 })
  await db.execute(sql`DELETE FROM public.ai_limits WHERE scope = ${scope} AND subject = ${subject}`)
  return NextResponse.json({ ok: true })
}
