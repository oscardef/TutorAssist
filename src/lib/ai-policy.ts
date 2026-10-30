/**
 * AI limit rules (pure, testable). Rows come from public.ai_limits; usage
 * from ai_usage_log. See lib/ai-access.ts for the database side.
 */

export interface LimitRow {
  scope: 'global' | 'role' | 'workspace' | 'user'
  subject: string | null
  ai_enabled: boolean | null
  daily_requests: number | null
  monthly_requests: number | null
  monthly_cost_usd: number | string | null
}

export interface Caps { daily: number | null; monthly: number | null; monthlyCost: number | null }
export interface Usage { day: number; month: number; monthCost: number }

export interface Caller { userId: string; email: string; workspaceId: string; role?: string | null; isPlatformOwner?: boolean }

export interface Policy {
  enabled: boolean
  /** Why AI is off, when it is */
  offReason?: 'platform_off' | 'not_enabled'
  owner: boolean
  person: Caps
  workspace: Caps
  platform: Caps
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v))
const caps = (r?: LimitRow): Caps => ({ daily: num(r?.daily_requests), monthly: num(r?.monthly_requests), monthlyCost: num(r?.monthly_cost_usd) })
const first = <T,>(...vals: (T | null | undefined)[]) => vals.find(v => v !== null && v !== undefined) ?? null

export function resolvePolicy(rows: LimitRow[], caller: Caller, envAllowed: string[] = []): Policy {
  const find = (scope: LimitRow['scope'], subject: string | null) => rows.find(r => r.scope === scope && (r.subject ?? null) === subject)
  const global = find('global', null)
  const role = find('role', caller.role === 'student' ? 'student' : 'tutor')
  const ws = find('workspace', caller.workspaceId)
  const user = find('user', caller.userId)
  const owner = !!caller.isPlatformOwner || caller.role === 'platform_owner'

  const platformOn = global?.ai_enabled !== false
  const listed = envAllowed.includes(caller.email.toLowerCase())
  // Person beats workspace beats role; the env allowlist counts as a person-level yes
  const personOn = first(user?.ai_enabled, listed ? true : null, ws?.ai_enabled, role?.ai_enabled) ?? false
  const enabled = owner || (platformOn && personOn === true)

  const roleCaps = caps(role)
  const userCaps = caps(user)
  return {
    enabled,
    offReason: enabled ? undefined : platformOn ? 'not_enabled' : 'platform_off',
    owner,
    person: { daily: first(userCaps.daily, roleCaps.daily), monthly: first(userCaps.monthly, roleCaps.monthly), monthlyCost: first(userCaps.monthlyCost, roleCaps.monthlyCost) },
    workspace: caps(ws),
    platform: caps(global),
  }
}

export type LimitHit = { code: string; message: string; status: number }

/** The first limit this request would break, or null. Owners are never limited. */
export function checkLimits(policy: Policy, usage: { person: Usage; workspace: Usage; platform: Usage }): LimitHit | null {
  if (!policy.enabled) {
    return policy.offReason === 'platform_off'
      ? { code: 'ai_paused', message: 'AI features are paused on Mathium at the moment. Everything else works as usual.', status: 503 }
      : { code: 'ai_not_enabled', message: 'AI features are not switched on for this account yet. Ask the Mathium team to enable them.', status: 403 }
  }
  if (policy.owner) return null
  const checks: [keyof Usage, keyof Caps, Caps, Usage, string][] = [
    ['day', 'daily', policy.person, usage.person, `You've reached today's AI limit`],
    ['month', 'monthly', policy.person, usage.person, `You've reached this month's AI limit`],
    ['monthCost', 'monthlyCost', policy.person, usage.person, `You've reached this month's AI limit`],
    ['day', 'daily', policy.workspace, usage.workspace, `This workspace has reached today's AI limit`],
    ['month', 'monthly', policy.workspace, usage.workspace, `This workspace has reached this month's AI limit`],
    ['monthCost', 'monthlyCost', policy.workspace, usage.workspace, `This workspace has reached this month's AI limit`],
    ['day', 'daily', policy.platform, usage.platform, 'Mathium has reached its AI limit for today'],
    ['month', 'monthly', policy.platform, usage.platform, 'Mathium has reached its AI limit for this month'],
    ['monthCost', 'monthlyCost', policy.platform, usage.platform, 'Mathium has reached its AI budget for this month'],
  ]
  for (const [u, c, cap, used, msg] of checks) {
    const limit = cap[c]
    if (limit !== null && used[u] >= limit) {
      const when = c === 'daily' ? 'It resets within 24 hours.' : 'It resets on the 1st of next month.'
      return { code: 'ai_limit', message: `${msg}. ${when}`, status: 429 }
    }
  }
  return null
}

/** Start of the current calendar month (UTC), for monthly usage. */
export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
