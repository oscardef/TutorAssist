/**
 * One date style everywhere (decision 2026-10-30): day first with the month
 * as a word, so nobody misreads 03/04: "2 Nov 2026", "2 Nov" in the current
 * year, "Mon 2 Nov" for nearby days, 24-hour times "16:00". Data exports use
 * ISO "2026-11-02". Pass a time zone on the server (lib/tz.ts userTimeZone);
 * in the browser the default is the viewer's own zone.
 */

type DateInput = Date | string | number

const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d))

function parts(d: DateInput, tz?: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })
    .formatToParts(toDate(d))
    .reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc }, {})
}

function sameYearAsNow(d: DateInput, tz?: string) {
  return parts(d, tz).year === parts(new Date(), tz).year
}

/** "2 Nov 2026", or "2 Nov" in the current year (`withYear` forces the year). */
export function formatDate(d: DateInput, opts: { tz?: string; withYear?: boolean } = {}) {
  const p = parts(d, opts.tz)
  return opts.withYear || !sameYearAsNow(d, opts.tz) ? `${p.day} ${p.month} ${p.year}` : `${p.day} ${p.month}`
}

/** "Mon 2 Nov" (year added when it isn't the current one). */
export function formatDay(d: DateInput, opts: { tz?: string } = {}) {
  const p = parts(d, opts.tz)
  return `${p.weekday} ${p.day} ${p.month}${sameYearAsNow(d, opts.tz) ? '' : ` ${p.year}`}`
}

/** "Monday 2 November", for headings such as booking days. */
export function formatLongDay(d: DateInput, opts: { tz?: string } = {}) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: opts.tz, weekday: 'long', day: 'numeric', month: 'long' }).format(toDate(d))
}

/** "16:00" */
export function formatTime(d: DateInput, opts: { tz?: string } = {}) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: opts.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(toDate(d))
}

/** "2 Nov, 16:00" (year added when it isn't the current one). */
export function formatDateTime(d: DateInput, opts: { tz?: string } = {}) {
  return `${formatDate(d, opts)}, ${formatTime(d, opts)}`
}

/** "2026-11-02" for files and data, in the given zone. */
export function isoDate(d: DateInput, opts: { tz?: string } = {}) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: opts.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(toDate(d))
}
