import { formatDate, formatDay, formatTime, formatDateTime, formatLongDay, isoDate } from '@/lib/dates'

const tz = 'Europe/Zurich'
const d = Date.UTC(2026, 10, 2, 15, 0) // Mon 2 Nov 2026, 16:00 in Zurich
const thisYear = new Date().getUTCFullYear()

describe('date formats', () => {
  it('uses day, month word and year', () => {
    expect(formatDate(d, { tz, withYear: true })).toBe('2 Nov 2026')
    expect(formatDate(Date.UTC(thisYear, 0, 5, 12), { tz })).toBe('5 Jan')
    expect(formatDate(Date.UTC(thisYear + 1, 0, 5, 12), { tz })).toBe(`5 Jan ${thisYear + 1}`)
  })
  it('formats days, times and data dates', () => {
    expect(formatDay(Date.UTC(thisYear, 10, 2, 15), { tz })).toMatch(/^[A-Z][a-z]{2} 2 Nov$/)
    expect(formatTime(d, { tz })).toBe('16:00')
    expect(formatTime(d, { tz: 'America/New_York' })).toBe('10:00')
    expect(formatLongDay(d, { tz })).toBe('Monday 2 November')
    expect(isoDate(d, { tz })).toBe('2026-11-02')
    expect(formatDateTime(d, { tz })).toMatch(/^2 Nov( 2026)?, 16:00$/)
  })
})
