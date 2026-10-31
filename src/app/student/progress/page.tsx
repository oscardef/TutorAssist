import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { userTimeZone, zoned } from '@/lib/tz'
import { dayStreak, previousDay } from '@/lib/streak'
import { Ledger, LedgerItem } from '@/components/ui/ledger'

interface QuestionData {
  topic_id: string
  difficulty: number | string
  topics: { name: string } | { name: string }[] | null
}

interface AttemptData {
  is_correct: boolean
  submitted_at: string
  questions: QuestionData | null
}

export default async function StudentProgressPage() {
  const user = await requireUser()
  await getUserContext()
  const supabase = await createServerClient()
  
  // Get all attempts - fix: use student_user_id instead of student_id
  const { data: attempts } = await supabase
    .from('attempts')
    .select('is_correct, submitted_at, questions(topic_id, difficulty, topics(name))')
    .eq('student_user_id', user?.id)
    .order('submitted_at', { ascending: false })
    .limit(500)
  
  // Normalize the data
  const normalizedAttempts = (attempts as unknown as AttemptData[])?.map((a) => ({
    ...a,
    questions: a.questions ? {
      ...a.questions,
      topics: Array.isArray(a.questions.topics) ? a.questions.topics[0] : a.questions.topics
    } : null
  }))
  
  // Calculate overall stats
  const totalAttempts = normalizedAttempts?.length || 0
  const correctAttempts = normalizedAttempts?.filter((a) => a.is_correct).length || 0
  const overallAccuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0
  
  // Group by topic
  const topicStats = new Map<string, { name: string; total: number; correct: number }>()
  normalizedAttempts?.forEach((attempt) => {
    const question = attempt.questions
    if (!question?.topic_id) return
    
    const topicName = question.topics?.name || 'Unknown'
    const existing = topicStats.get(question.topic_id) || { name: topicName, total: 0, correct: 0 }
    existing.total += 1
    if (attempt.is_correct) existing.correct += 1
    topicStats.set(question.topic_id, existing)
  })
  
  // Group by difficulty - map numeric difficulty to category
  const difficultyStats = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } }
  normalizedAttempts?.forEach((attempt) => {
    const question = attempt.questions
    if (!question?.difficulty) return
    
    // Map numeric difficulty (1-5) to category
    const diff = typeof question.difficulty === 'number' ? question.difficulty : parseInt(String(question.difficulty))
    let category: 'easy' | 'medium' | 'hard'
    if (diff <= 2) category = 'easy'
    else if (diff <= 3) category = 'medium'
    else category = 'hard'
    
    difficultyStats[category].total += 1
    if (attempt.is_correct) difficultyStats[category].correct += 1
  })
  
  // Days are counted in the student's time zone, the same way as on Home
  const { dayKey } = zoned(await userTimeZone())
  const dayCounts = new Map<string, number>()
  attempts?.forEach(a => {
    if (!a.submitted_at) return
    const key = dayKey(a.submitted_at)
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1)
  })
  const todayKey = dayKey(new Date())
  const currentStreak = dayStreak(dayCounts.keys(), todayKey)

  // Activity heat: last 12 weeks plus this one, Monday-first columns
  const nextDay = (key: string) => {
    const d = new Date(`${key}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  const weekday = (new Date(`${todayKey}T12:00:00Z`).getUTCDay() + 6) % 7
  let cursor = todayKey
  for (let i = 0; i < 84 + weekday; i++) cursor = previousDay(cursor)
  const weeks: { key: string; count: number; future: boolean }[][] = []
  for (let w = 0; w < 13; w++) {
    const col: { key: string; count: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      col.push({ key: cursor, count: dayCounts.get(cursor) || 0, future: cursor > todayKey })
      cursor = nextDay(cursor)
    }
    weeks.push(col)
  }
  const maxDay = Math.max(1, ...Array.from(dayCounts.values()))
  const activeDays = weeks.flat().filter(d => !d.future && d.count > 0).length
  const topics = Array.from(topicStats.entries()).map(([id, t]) => ({ id, ...t, accuracy: Math.round((t.correct / t.total) * 100) })).sort((a, b) => b.total - a.total)
  const Practice = Icons.practice

  return (
    <div className="space-y-8">
      <section className="bg-graph-fade -mx-4 -mt-6 px-4 pb-6 pt-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10">
        <div className="animate-rise">
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">{totalAttempts > 0 ? `${totalAttempts} questions answered across ${topicStats.size} topic${topicStats.size === 1 ? '' : 's'}` : 'Your first answers will show up here'}</p>
        </div>
        <Ledger className="animate-rise-2 mt-6">
          <LedgerItem label="Answered" value={totalAttempts} />
          <LedgerItem label="Right" value={`${overallAccuracy}%`} />
          <LedgerItem label="Topics practised" value={topicStats.size} />
          <LedgerItem label="Day streak" value={currentStreak} tone={currentStreak > 0 ? 'spark' : undefined} />
        </Ledger>
      </section>

      {totalAttempts === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="font-bold text-ink">Nothing to show yet</p>
          <p className="mt-1 text-sm text-gray-500">Answer a few questions and your progress appears here.</p>
          <Link href="/student/practice" className="btn btn-primary mt-5"><Practice className="h-4 w-4" /> Start practising</Link>
        </div>
      ) : (
        <>
          {/* Activity heat */}
          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="card-title">Activity</h2>
              <p className="text-sm text-gray-500 tnum">{activeDays} active day{activeDays === 1 ? '' : 's'} in the last 12 weeks</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <div className="flex gap-1" role="img" aria-label="Questions answered per day over the last twelve weeks">
                {weeks.map((col, w) => (
                  <div key={w} className="flex flex-col gap-1">
                    {col.map(day => {
                      const level = day.future ? -1 : day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / maxDay) * 4))
                      const cls = level < 0 ? 'bg-transparent' : level === 0 ? 'bg-paper-deep' : level === 1 ? 'bg-brand-200' : level === 2 ? 'bg-brand-300' : level === 3 ? 'bg-brand-500' : 'bg-brand-700'
                      return <span key={day.key} className={`block h-3.5 w-3.5 rounded-[4px] ${cls}`} title={day.future ? '' : `${day.key}: ${day.count} answered`} />
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Topics */}
            <section className="card lg:col-span-3">
              <div className="card-header"><h2 className="card-title">By topic</h2><Link href="/student/practice" className="btn btn-ghost btn-sm">Practise</Link></div>
              <ul className="divide-y divide-line">
                {topics.map(t => (
                  <li key={t.id} className="flex items-center gap-4 px-5 py-3">
                    <TopicRing value={t.accuracy} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">{t.name}</p>
                      <p className="text-xs text-gray-500 tnum">{t.correct} of {t.total} correct</p>
                    </div>
                    <div className="hidden w-32 sm:block">
                      <div className="h-2 overflow-hidden rounded-full bg-paper-deep"><div className={`h-full rounded-full ${t.accuracy >= 80 ? 'bg-[#2e8b57]' : t.accuracy >= 60 ? 'bg-spark-400' : 'bg-[#d64545]'}`} style={{ width: `${t.accuracy}%` }} /></div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Difficulty */}
            <section className="card p-5 lg:col-span-2">
              <h2 className="card-title">By difficulty</h2>
              <ul className="mt-4 space-y-4">
                {([['easy', 'Easy', 2], ['medium', 'Medium', 3], ['hard', 'Hard', 5]] as const).map(([k, label, dots]) => {
                  const d = difficultyStats[k]
                  const acc = d.total > 0 ? Math.round((d.correct / d.total) * 100) : null
                  return (
                    <li key={k}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-2 font-bold text-ink">
                          <span className="inline-flex gap-0.5" aria-hidden="true">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i < dots ? 'bg-brand-500' : 'bg-paper-deep'}`} />)}</span>
                          {label}
                        </span>
                        <span className="text-gray-500 tnum">{acc === null ? 'Not yet' : `${d.correct}/${d.total}, ${acc}%`}</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper-deep"><div className="h-full rounded-full bg-brand-500" style={{ width: `${acc ?? 0}%` }} /></div>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-5 text-sm text-gray-600">
                {difficultyStats.hard.total > 0 && difficultyStats.hard.correct / difficultyStats.hard.total >= 0.7
                  ? 'Hard questions are going well. Keep mixing them in.'
                  : difficultyStats.easy.total > 0 && difficultyStats.easy.correct / difficultyStats.easy.total >= 0.9
                  ? 'Easy ones are solid. Try a harder set next.'
                  : 'Mix difficulties to build confidence and stretch.'}
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  )
}


function TopicRing({ value }: { value: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  const color = value >= 80 ? '#2e8b57' : value >= 60 ? 'var(--color-spark-400)' : '#d64545'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0" aria-label={`${value}% accuracy`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-paper-deep)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--color-ink)">{value}</text>
    </svg>
  )
}
