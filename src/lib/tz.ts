import { cookies } from 'next/headers'
import { format } from 'date-fns'
import { isValidTimeZone, zoneOffsetMs } from '@/lib/scheduling'

/**
 * Per-user time zone for server-rendered times. The browser reports its zone
 * in the `tz` cookie (see components/timezone-cookie.tsx); without it we use
 * the server's zone (APP_TIMEZONE / TZ).
 */
export async function userTimeZone(): Promise<string> {
  let fromCookie = (await cookies()).get('tz')?.value
  try { if (fromCookie) fromCookie = decodeURIComponent(fromCookie) } catch { fromCookie = undefined }
  if (fromCookie && isValidTimeZone(fromCookie)) return fromCookie
  return process.env.TZ && isValidTimeZone(process.env.TZ) ? process.env.TZ : 'Europe/Zurich'
}

/**
 * A Date whose local fields show the wall-clock time in `tz`, for formatting
 * with date-fns on the server. Display only: don't do arithmetic on it.
 */
export function inZone(date: Date, tz: string): Date {
  const t = date.getTime()
  return new Date(t + zoneOffsetMs(t, tz) + date.getTimezoneOffset() * 60_000)
}

/** date-fns `format` in a time zone, plus day comparisons that respect it. */
export function zoned(tz: string) {
  const fmt = (d: Date | string | number, pattern: string) => format(inZone(new Date(d), tz), pattern)
  const dayKey = (d: Date | string | number) => fmt(d, 'yyyy-MM-dd')
  const today = () => dayKey(new Date())
  return {
    fmt,
    dayKey,
    isToday: (d: Date | string | number) => dayKey(d) === today(),
    isTomorrow: (d: Date | string | number) => dayKey(d) === dayKey(new Date(new Date().getTime() + 86_400_000)),
    hour: () => Number(fmt(new Date(), 'H')),
  }
}
