import { resolvePolicy, checkLimits, type LimitRow } from '@/lib/ai-policy'

const base: LimitRow[] = [
  { scope: 'global', subject: null, ai_enabled: true, daily_requests: null, monthly_requests: null, monthly_cost_usd: '20.00' },
  { scope: 'role', subject: 'tutor', ai_enabled: false, daily_requests: 100, monthly_requests: 1500, monthly_cost_usd: '5.00' },
]
const tutor = { userId: 'u1', email: 'tutor@example.com', workspaceId: 'w1', role: 'tutor' }
const zero = { day: 0, month: 0, monthCost: 0 }

describe('AI policy', () => {
  it('keeps AI off for new tutors until switched on', () => {
    const p = resolvePolicy(base, tutor)
    expect(p.enabled).toBe(false)
    expect(checkLimits(p, { person: zero, workspace: zero, platform: zero })?.code).toBe('ai_not_enabled')
  })

  it('turns on per person, per workspace or via the env allowlist', () => {
    expect(resolvePolicy([...base, { scope: 'user', subject: 'u1', ai_enabled: true, daily_requests: null, monthly_requests: null, monthly_cost_usd: null }], tutor).enabled).toBe(true)
    expect(resolvePolicy([...base, { scope: 'workspace', subject: 'w1', ai_enabled: true, daily_requests: null, monthly_requests: null, monthly_cost_usd: null }], tutor).enabled).toBe(true)
    expect(resolvePolicy(base, tutor, ['tutor@example.com']).enabled).toBe(true)
  })

  it('lets a person override beat the workspace', () => {
    const rows: LimitRow[] = [...base,
      { scope: 'workspace', subject: 'w1', ai_enabled: true, daily_requests: null, monthly_requests: null, monthly_cost_usd: null },
      { scope: 'user', subject: 'u1', ai_enabled: false, daily_requests: null, monthly_requests: null, monthly_cost_usd: null }]
    expect(resolvePolicy(rows, tutor).enabled).toBe(false)
  })

  it('applies person, workspace and platform caps', () => {
    const p = resolvePolicy(base, tutor, ['tutor@example.com'])
    expect(checkLimits(p, { person: { day: 100, month: 100, monthCost: 1 }, workspace: zero, platform: zero })?.code).toBe('ai_limit')
    expect(checkLimits(p, { person: { day: 1, month: 1, monthCost: 5 }, workspace: zero, platform: zero })?.code).toBe('ai_limit')
    expect(checkLimits(p, { person: zero, workspace: zero, platform: { day: 0, month: 0, monthCost: 20 } })?.message).toMatch(/budget/)
    expect(checkLimits(p, { person: { day: 99, month: 99, monthCost: 4.99 }, workspace: zero, platform: zero })).toBeNull()
  })

  it('pauses everyone but owners with the platform switch', () => {
    const off: LimitRow[] = [{ ...base[0], ai_enabled: false }, base[1]]
    expect(checkLimits(resolvePolicy(off, tutor, ['tutor@example.com']), { person: zero, workspace: zero, platform: zero })?.code).toBe('ai_paused')
    expect(resolvePolicy(off, { ...tutor, isPlatformOwner: true }).enabled).toBe(true)
  })

  it('never limits platform owners', () => {
    const p = resolvePolicy(base, { ...tutor, isPlatformOwner: true })
    expect(checkLimits(p, { person: { day: 9999, month: 9999, monthCost: 999 }, workspace: zero, platform: { day: 0, month: 0, monthCost: 999 } })).toBeNull()
  })
})
