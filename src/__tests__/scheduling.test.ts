import { computeSlots, zonedToUtc, zoneOffsetMs, normaliseWindows, type BookingSettings } from '@/lib/scheduling'

const settings: BookingSettings = { timezone: 'Europe/Zurich', slotMinutes: 60, bufferMinutes: 0, minNoticeHours: 0, maxDaysAhead: 7 }
// Monday 2 Nov 2026, 08:00 Zurich (CET, UTC+1) = 07:00 UTC
const monday8 = Date.UTC(2026, 10, 2, 7, 0)

describe('timezone helpers', () => {
  it('knows Zurich offsets in winter and summer', () => {
    expect(zoneOffsetMs(Date.UTC(2026, 0, 15, 12), 'Europe/Zurich')).toBe(3_600_000)
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15, 12), 'Europe/Zurich')).toBe(7_200_000)
  })
  it('converts wall-clock time across the DST change', () => {
    // 29 Mar 2026: clocks jump 02:00 -> 03:00 in Zurich; 10:00 local is 08:00 UTC
    expect(zonedToUtc(2026, 3, 29, 10 * 60, 'Europe/Zurich')).toBe(Date.UTC(2026, 2, 29, 8, 0))
    expect(zonedToUtc(2026, 3, 28, 10 * 60, 'Europe/Zurich')).toBe(Date.UTC(2026, 2, 28, 9, 0))
  })
})

describe('computeSlots', () => {
  const mondayMorning = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }]

  it('cuts a window into slots in the tutor timezone', () => {
    const slots = computeSlots(mondayMorning, [], { ...settings, maxDaysAhead: 1 }, monday8)
    expect(slots.map(s => new Date(s).toISOString())).toEqual(['2026-11-02T08:00:00.000Z', '2026-11-02T09:00:00.000Z', '2026-11-02T10:00:00.000Z'])
  })

  it('skips slots that clash with busy times, including the buffer', () => {
    const busy = [{ start: Date.UTC(2026, 10, 2, 9, 0), end: Date.UTC(2026, 10, 2, 10, 0) }]
    expect(computeSlots(mondayMorning, busy, { ...settings, maxDaysAhead: 1 }, monday8)).toHaveLength(2)
    expect(computeSlots(mondayMorning, busy, { ...settings, maxDaysAhead: 1, bufferMinutes: 15 }, monday8)).toHaveLength(0)
  })

  it('respects minimum notice', () => {
    const slots = computeSlots(mondayMorning, [], { ...settings, maxDaysAhead: 1, minNoticeHours: 2 }, monday8)
    expect(slots.map(s => new Date(s).toISOString())).toEqual(['2026-11-02T09:00:00.000Z', '2026-11-02T10:00:00.000Z'])
  })

  it('repeats weekly within the horizon', () => {
    // 14 days from Monday 08:00 ends just before the third Monday's slots
    expect(computeSlots(mondayMorning, [], { ...settings, maxDaysAhead: 14 }, monday8)).toHaveLength(6)
    expect(computeSlots(mondayMorning, [], { ...settings, maxDaysAhead: 15 }, monday8)).toHaveLength(9)
  })
})

describe('normaliseWindows', () => {
  it('drops invalid windows and merges overlaps', () => {
    expect(normaliseWindows([
      { weekday: 1, startMinute: 540, endMinute: 600 },
      { weekday: 1, startMinute: 590, endMinute: 660 },
      { weekday: 8, startMinute: 0, endMinute: 60 },
      { weekday: 2, startMinute: 600, endMinute: 540 },
    ])).toEqual([{ weekday: 1, startMinute: 540, endMinute: 660 }])
  })
})
