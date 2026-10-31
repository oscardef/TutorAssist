import { dayStreak, previousDay } from '@/lib/streak'

describe('dayStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(dayStreak(['2026-10-29', '2026-10-30', '2026-10-31'], '2026-10-31')).toBe(3)
  })

  it('keeps a streak alive through yesterday until today is answered', () => {
    expect(dayStreak(['2026-10-29', '2026-10-30'], '2026-10-31')).toBe(2)
  })

  it('is zero once a whole day is missed', () => {
    expect(dayStreak(['2026-10-28', '2026-10-29'], '2026-10-31')).toBe(0)
  })

  it('stops at the first gap', () => {
    expect(dayStreak(['2026-10-25', '2026-10-27', '2026-10-28'], '2026-10-28')).toBe(2)
  })

  it('crosses month and year boundaries', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(dayStreak(['2025-12-31', '2026-01-01'], '2026-01-01')).toBe(2)
  })
})
