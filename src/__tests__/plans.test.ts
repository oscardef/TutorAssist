import { planFromEntitlement, FEATURES, withoutSolutions } from '@/lib/plans'

describe('planFromEntitlement', () => {
  const now = new Date('2026-11-01T12:00:00Z')
  it('is Free without a row', () => {
    expect(planFromEntitlement(null, now)).toBe('free')
  })
  it('is Plus while active and inside the period', () => {
    expect(planFromEntitlement({ plan: 'plus', status: 'active', current_period_end: '2026-12-01T00:00:00Z' }, now)).toBe('plus')
  })
  it('keeps Plus for a grant with no end date', () => {
    expect(planFromEntitlement({ plan: 'plus', status: 'active', current_period_end: null }, now)).toBe('plus')
  })
  it('keeps Plus while a payment is being retried', () => {
    expect(planFromEntitlement({ plan: 'plus', status: 'past_due', current_period_end: '2026-11-05T00:00:00Z' }, now)).toBe('plus')
  })
  it('drops to Free once cancelled or lapsed', () => {
    expect(planFromEntitlement({ plan: 'plus', status: 'canceled', current_period_end: '2026-12-01T00:00:00Z' }, now)).toBe('free')
    expect(planFromEntitlement({ plan: 'plus', status: 'active', current_period_end: '2026-10-01T00:00:00Z' }, now)).toBe('free')
  })
})

describe('FEATURES', () => {
  it('never limits students who have a tutor', () => {
    expect(FEATURES.tutor.dailyQuestions).toBeNull()
    expect(FEATURES.tutor.sponsorMessages).toBe(false)
  })
  it('limits Free and shows sponsor messages only there', () => {
    expect(FEATURES.free.dailyQuestions).toBeGreaterThan(0)
    expect(FEATURES.free.sponsorMessages).toBe(true)
    expect(FEATURES.plus.sponsorMessages).toBe(false)
  })
})

describe('withoutSolutions', () => {
  it('drops worked solutions and markschemes but says one existed', () => {
    const [q] = withoutSolutions([{ id: 'q1', solution_steps_json: [{ step: 'a', result: 'b' }], parts_json: [{ label: 'a', markscheme: 'M1', marks: 1 }] }])!
    expect(q.solution_steps_json).toBeNull()
    expect(q.has_worked_solution).toBe(true)
    expect((q.parts_json as Record<string, unknown>[])[0]).toEqual({ label: 'a', marks: 1 })
  })
  it('marks questions that never had a solution', () => {
    expect(withoutSolutions([{ id: 'q2', solution_steps_json: null }])![0].has_worked_solution).toBe(false)
  })
})
