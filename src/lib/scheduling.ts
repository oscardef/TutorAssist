/**
 * Bookable slots from a tutor's weekly availability. Pure functions so the
 * rules are easy to test: availability is given in the tutor's own timezone
 * (minutes from local midnight per weekday), and busy times come from
 * existing sessions and, when connected, Google free/busy.
 */

export interface AvailabilityWindow {
  /** 0 = Sunday … 6 = Saturday, in the tutor's timezone */
  weekday: number
  startMinute: number
  endMinute: number
}

export interface BookingSettings {
  timezone: string
  slotMinutes: number
  bufferMinutes: number
  minNoticeHours: number
  maxDaysAhead: number
}

export interface Interval { start: number; end: number }

/** Offset (ms) of `timeZone` from UTC at the instant `utcMs`. */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** UTC instant for a wall-clock time in `timeZone` (DST-safe). */
export function zonedToUtc(year: number, month: number, day: number, minuteOfDay: number, timeZone: string): number {
  const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay)
  let utc = naive - zoneOffsetMs(naive, timeZone)
  // A second pass settles instants near a DST change
  utc = naive - zoneOffsetMs(utc, timeZone)
  return utc
}

/** Calendar date (y, m, d, weekday) of an instant in `timeZone`. */
export function zonedDate(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(new Date(utcMs))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), weekday }
}

export function isValidTimeZone(tz: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/**
 * Free slot start times (UTC ms) between now + notice and now + maxDaysAhead.
 * A slot is free when it, padded by the buffer on both sides, overlaps no
 * busy interval.
 */
export function computeSlots(windows: AvailabilityWindow[], busy: Interval[], settings: BookingSettings, nowMs: number): number[] {
  const { timezone, slotMinutes, bufferMinutes, minNoticeHours, maxDaysAhead } = settings
  if (!isValidTimeZone(timezone) || slotMinutes < 15) return []
  const slotMs = slotMinutes * 60_000
  const bufferMs = bufferMinutes * 60_000
  const earliest = nowMs + minNoticeHours * 3_600_000
  const latest = nowMs + maxDaysAhead * 86_400_000
  const sortedBusy = [...busy].sort((a, b) => a.start - b.start)
  const slots: number[] = []
  const seen = new Set<number>()

  for (let d = 0; d <= maxDaysAhead + 1; d++) {
    const date = zonedDate(nowMs + d * 86_400_000, timezone)
    for (const w of windows) {
      if (w.weekday !== date.weekday || w.endMinute <= w.startMinute) continue
      for (let m = w.startMinute; m + slotMinutes <= w.endMinute; m += slotMinutes) {
        const start = zonedToUtc(date.year, date.month, date.day, m, timezone)
        const end = start + slotMs
        if (start < earliest || start > latest || seen.has(start)) continue
        const clash = sortedBusy.some(b => b.start < end + bufferMs && b.end > start - bufferMs)
        if (!clash) { slots.push(start); seen.add(start) }
      }
    }
  }
  return slots.sort((a, b) => a - b)
}

/** Validate windows from the editor: in range, non-empty, merged per day. */
export function normaliseWindows(input: unknown): AvailabilityWindow[] {
  if (!Array.isArray(input)) return []
  const ok = input
    .map(w => w as Partial<AvailabilityWindow>)
    .filter(w => Number.isInteger(w.weekday) && w.weekday! >= 0 && w.weekday! <= 6 && Number.isFinite(w.startMinute) && Number.isFinite(w.endMinute))
    .map(w => ({ weekday: w.weekday!, startMinute: Math.max(0, Math.min(1440, Math.round(w.startMinute!))), endMinute: Math.max(0, Math.min(1440, Math.round(w.endMinute!))) }))
    .filter(w => w.endMinute > w.startMinute)
    .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
  const merged: AvailabilityWindow[] = []
  for (const w of ok) {
    const last = merged[merged.length - 1]
    if (last && last.weekday === w.weekday && w.startMinute <= last.endMinute) last.endMinute = Math.max(last.endMinute, w.endMinute)
    else merged.push({ ...w })
  }
  return merged.slice(0, 50)
}
