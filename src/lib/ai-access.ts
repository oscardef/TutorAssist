import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { enterAIContext } from '@/lib/ai-context'
import { resolvePolicy, checkLimits, monthStart, type Caller, type LimitRow, type Usage, type Policy } from '@/lib/ai-policy'

/**
 * Who may spend AI credit, and how much. Limits live in public.ai_limits
 * (platform, role, workspace and person; see migration 0013 and the admin
 * page /tutor/admin/ai); usage is measured from ai_usage_log, which the
 * OpenAI client fills on every call. AI_ALLOWED_EMAILS still switches AI on
 * for listed people; platform owners are never limited.
 */

async function loadRows(): Promise<LimitRow[]> {
  const admin = await createAdminClient()
  const { data } = await admin.from('ai_limits').select('scope, subject, ai_enabled, daily_requests, monthly_requests, monthly_cost_usd')
  return (data ?? []) as LimitRow[]
}

const envAllowed = () => (process.env.AI_ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

async function usageFor(filter: { column?: 'user_id' | 'workspace_id'; value?: string }): Promise<Usage> {
  const admin = await createAdminClient()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const since = monthStart().toISOString()
  let dayQ = admin.from('ai_usage_log').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo)
  let monthQ = admin.from('ai_usage_log').select('cost_usd').gte('created_at', since).limit(100000)
  if (filter.column && filter.value) {
    dayQ = dayQ.eq(filter.column, filter.value)
    monthQ = monthQ.eq(filter.column, filter.value)
  }
  const [day, month] = await Promise.all([dayQ, monthQ])
  const rows = (month.data ?? []) as { cost_usd: number | string | null }[]
  return { day: day.count ?? 0, month: rows.length, monthCost: rows.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0) }
}

export async function aiPolicyFor(caller: Caller): Promise<Policy> {
  return resolvePolicy(await loadRows(), caller, envAllowed())
}

/** Usage the caller's limits are measured against. */
export async function aiUsageFor(caller: Caller) {
  const [person, workspace, platform] = await Promise.all([
    usageFor({ column: 'user_id', value: caller.userId }),
    usageFor({ column: 'workspace_id', value: caller.workspaceId }),
    usageFor({}),
  ])
  return { person, workspace, platform }
}

/**
 * Call at the start of every route that uses AI. Returns a response to send
 * back when the caller may not use AI right now; otherwise null, and AI calls
 * for the rest of the request are attributed to this caller.
 */
export async function aiAccessError(caller: Caller, operation = 'request'): Promise<NextResponse | null> {
  const policy = await aiPolicyFor(caller)
  const hit = checkLimits(policy, policy.enabled && !policy.owner ? await aiUsageFor(caller) : { person: zero, workspace: zero, platform: zero })
  if (hit) return NextResponse.json({ error: hit.message, code: hit.code }, { status: hit.status })
  enterAIContext({ workspaceId: caller.workspaceId, userId: caller.userId, operation })
  return null
}
const zero: Usage = { day: 0, month: 0, monthCost: 0 }

/**
 * Whether AI features may use anonymised student results (accuracy, weaker
 * topics; never names or emails) in this workspace. On unless the workspace
 * turned it off in settings (settings_json.ai_student_data = false).
 */
export async function sharesStudentDataWithAI(workspaceId: string): Promise<boolean> {
  const admin = await createAdminClient()
  const { data } = await admin.from('workspaces').select('settings_json').eq('id', workspaceId).maybeSingle()
  return (data?.settings_json as { ai_student_data?: boolean } | null)?.ai_student_data !== false
}
