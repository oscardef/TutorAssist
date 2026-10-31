/** The calendar day before a `yyyy-MM-dd` key. */
export function previousDay(key: string): string {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Days in a row with at least one answer, counted back from today. Today
 * counts once the student answers; until then a streak that ran through
 * yesterday is still alive. Day keys are `yyyy-MM-dd` in the student's zone.
 */
export function dayStreak(activeDays: Iterable<string>, today: string): number {
  const days = new Set(activeDays)
  let day = days.has(today) ? today : previousDay(today)
  let streak = 0
  while (days.has(day)) {
    streak++
    day = previousDay(day)
  }
  return streak
}
