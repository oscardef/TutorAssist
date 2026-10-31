import { requireTutor, getUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { isPast, differenceInDays } from 'date-fns'
import { userTimeZone, zoned } from '@/lib/tz'
import { Ledger, LedgerItem } from '@/components/ui/ledger'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function TutorDashboard() {
  const context = await requireTutor()
  const user = await getUser()
  const supabase = await createServerClient()
  const { fmt, isToday, isTomorrow } = zoned(await userTimeZone())

  // Performance: Fetch all independent data in parallel
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [
    sessionsResult,
    studentsResult,
    flagCountResult,
    assignmentsResult,
    attemptStatsResult,
  ] = await Promise.all([
    // Get upcoming sessions (today and tomorrow only)
    supabase
      .from('sessions')
      .select('*, student_profiles(name)')
      .eq('workspace_id', context.workspaceId)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(5),
    // Get student profiles with their stats
    supabase
      .from('student_profiles')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .order('name'),
    // Get pending flags count  
    supabase
      .from('question_flags')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', context.workspaceId)
      .eq('status', 'pending'),
    // Get assignments that are due soon or overdue
    supabase
      .from('assignments')
      .select('*, student_profiles(name)')
      .eq('workspace_id', context.workspaceId)
      .eq('status', 'active')
      .order('due_at'),
    // Get student attempt stats for "needs attention" calculation
    supabase
      .from('attempts')
      .select('student_user_id, is_correct')
      .eq('workspace_id', context.workspaceId)
      .gte('created_at', twoWeeksAgo.toISOString()),
  ])

  // Extract results
  const firstName = 
    user?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Tutor'
  
  const sessions = sessionsResult.data
  const students = studentsResult.data
  const flagCount = flagCountResult.count
  const assignments = assignmentsResult.data
  const attemptStats = attemptStatsResult.data

  // Calculate students needing attention (accuracy < 50% in last 2 weeks with >= 5 attempts)
  const studentStats = new Map<string, { correct: number; total: number }>()
  attemptStats?.forEach(attempt => {
    const existing = studentStats.get(attempt.student_user_id) || { correct: 0, total: 0 }
    existing.total++
    if (attempt.is_correct) existing.correct++
    studentStats.set(attempt.student_user_id, existing)
  })

  const studentsNeedingAttention = students?.filter(student => {
    if (!student.user_id) return false
    const stats = studentStats.get(student.user_id)
    if (!stats || stats.total < 5) return false
    return (stats.correct / stats.total) < 0.5
  }) || []

  // Categorize assignments
  const overdueAssignments = assignments?.filter(a => a.due_at && isPast(new Date(a.due_at))) || []
  const dueSoonAssignments = assignments?.filter(a => {
    if (!a.due_at) return false
    const dueDate = new Date(a.due_at)
    return !isPast(dueDate) && differenceInDays(dueDate, new Date()) <= 3
  }) || []

  // Get today's and tomorrow's sessions
  const todaySessions = sessions?.filter(s => isToday(new Date(s.scheduled_at))) || []
  const tomorrowSessions = sessions?.filter(s => isTomorrow(new Date(s.scheduled_at))) || []

  // Determine what needs attention
  const hasFlags = (flagCount || 0) > 0
  const hasOverdue = overdueAssignments.length > 0
  const hasStruggling = studentsNeedingAttention.length > 0
  const hasActionItems = hasFlags || hasOverdue || hasStruggling

  const totalAttempts = attemptStats?.length || 0
  const correctAttempts = attemptStats?.filter(a => a.is_correct).length || 0
  const fortnightAccuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null
  const activeStudents = new Set(attemptStats?.map(a => a.student_user_id)).size

  const Flag = Icons.flag
  const Clock = Icons.clock
  const Students = Icons.students
  const Plus = Icons.plus
  const Calendar = Icons.calendar

  return (
    <div className="space-y-8">
      {/* Hero band: greeting plus the numbers that matter this fortnight */}
      <section className="bg-graph-fade -mx-4 -mt-6 px-4 pb-6 pt-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10">
        <div className="animate-rise">
          <h1 className="page-title">{getGreeting()}, {firstName}</h1>
          <p className="page-subtitle">
            {hasActionItems ? 'A few things need your attention.' : 'Nothing is waiting on you. Nice.'}
          </p>
        </div>
        <Ledger className="animate-rise-2 mt-6">
          <LedgerItem label="Students" value={students?.length || 0} />
          <LedgerItem label="Active in 14 days" value={activeStudents} />
          <LedgerItem label="Accuracy, 14 days" value={fortnightAccuracy === null ? '–' : `${fortnightAccuracy}%`} />
          <LedgerItem label="Sessions today" value={todaySessions.length} />
        </Ledger>
      </section>

      {/* Attention items */}
      {hasActionItems && (
        <section aria-labelledby="attention" className="animate-rise-3">
          <h2 id="attention" className="sr-only">Needs attention</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hasFlags && (
              <Attention href="/tutor/flags" icon={<Flag className="h-5 w-5" />} tone="spark" title={`${flagCount} flagged question${flagCount === 1 ? '' : 's'}`} body="Students reported answers to check" />
            )}
            {hasOverdue && (
              <Attention href="/tutor/assignments" icon={<Clock className="h-5 w-5" />} tone="red" title={`${overdueAssignments.length} overdue`} body="Assignments past their due date" />
            )}
            {hasStruggling && (
              <Attention href="/tutor/students" icon={<Students className="h-5 w-5" />} tone="red" title={`${studentsNeedingAttention.length} struggling`} body="Under 50% in the last two weeks" />
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's schedule */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Today</h2>
            <Link href="/tutor/sessions" className="btn btn-ghost btn-sm">Calendar</Link>
          </div>
          {todaySessions.length > 0 ? (
            <ul className="divide-y divide-line">
              {todaySessions.map(session => (
                <li key={session.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-ink">{session.student_profiles?.name || 'Session'}</div>
                      <div className="text-sm text-gray-500 tnum">{fmt(new Date(session.scheduled_at), 'HH:mm')}</div>
                    </div>
                  </div>
                  {session.meet_link && (
                    <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">Join</a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow>No sessions today.</EmptyRow>
          )}
          {tomorrowSessions.length > 0 && (
            <>
              <div className="border-t border-line bg-paper px-6 py-2 text-xs font-bold text-gray-500">Tomorrow</div>
              <ul className="divide-y divide-line">
                {tomorrowSessions.slice(0, 2).map(session => (
                  <li key={session.id} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm font-semibold text-gray-700">{session.student_profiles?.name || 'Session'}</span>
                    <span className="text-sm text-gray-500 tnum">{fmt(new Date(session.scheduled_at), 'HH:mm')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Due soon */}
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Due soon</h2>
            <Link href="/tutor/assignments" className="btn btn-ghost btn-sm">All assignments</Link>
          </div>
          {dueSoonAssignments.length > 0 ? (
            <ul className="divide-y divide-line">
              {dueSoonAssignments.slice(0, 5).map(assignment => {
                const due = new Date(assignment.due_at)
                const label = isToday(due) ? 'Today' : isTomorrow(due) ? 'Tomorrow' : fmt(due, 'd MMM')
                const tone = isToday(due) ? 'text-red-700' : isTomorrow(due) ? 'text-spark-700' : 'text-gray-600'
                return (
                  <li key={assignment.id}>
                    <Link href={`/tutor/assignments/${assignment.id}`} className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-paper">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-ink">{assignment.title}</div>
                        <div className="text-sm text-gray-500">{assignment.student_profiles?.name || 'All students'}</div>
                      </div>
                      <span className={`text-sm font-bold ${tone}`}>{label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyRow>Nothing due in the next three days.</EmptyRow>
          )}
        </section>
      </div>

      {/* Students */}
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Students <span className="ml-1 text-gray-400 tnum">{students?.length || 0}</span></h2>
          <Link href="/tutor/students/new" className="btn btn-secondary btn-sm"><Plus className="h-4 w-4" /> Add student</Link>
        </div>
        {students && students.length > 0 ? (
          <ul className="divide-y divide-line">
            {students.slice(0, 6).map(student => {
              const stats = student.user_id ? studentStats.get(student.user_id) : null
              const accuracy = stats && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null
              return (
                <li key={student.id}>
                  <Link href={`/tutor/students/${student.id}`} className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-paper">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-spark-100 text-sm font-extrabold text-spark-700">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-bold text-ink">{student.name}</div>
                        <div className="truncate text-sm text-gray-500">
                          {[student.grade_current ? `Grade ${student.grade_current}` : null, student.school].filter(Boolean).join(', ') || 'No details yet'}
                        </div>
                      </div>
                    </div>
                    {accuracy !== null ? (
                      <AccuracyPill value={accuracy} />
                    ) : (
                      <span className="text-sm text-gray-400">No attempts yet</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-bold text-ink">No students yet</p>
            <p className="mt-1 text-sm text-gray-500">Add a student and send them an invite link.</p>
            <Link href="/tutor/students/new" className="btn btn-primary mt-5"><Plus className="h-4 w-4" /> Add your first student</Link>
          </div>
        )}
        {students && students.length > 6 && (
          <div className="border-t border-line px-6 py-3">
            <Link href="/tutor/students" className="text-sm font-bold text-brand-700 hover:text-brand-800">See all {students.length} students</Link>
          </div>
        )}
      </section>
    </div>
  )
}

function Attention({ href, icon, tone, title, body }: { href: string; icon: React.ReactNode; tone: 'spark' | 'red'; title: string; body: string }) {
  // A margin note: a white slip with a coloured edge, like a tutor's pen mark
  const tones = {
    spark: 'border-l-spark-400 [&_.ico]:text-spark-600',
    red: 'border-l-[#d9534f] [&_.ico]:text-[#c0392b]',
  }
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-r-lg border border-l-4 border-line bg-white p-4 transition-colors hover:bg-paper ${tones[tone]}`}>
      <div className="ico flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-extrabold text-ink">{title}</div>
        <div className="text-sm text-gray-600">{body}</div>
      </div>
    </Link>
  )
}

function AccuracyPill({ value }: { value: number }) {
  const cls = value >= 70 ? 'chip-good' : value >= 50 ? 'chip-spark' : 'chip-bad'
  return <span className={`chip ${cls} tnum`}>{value}%</span>
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-10 text-center text-sm text-gray-500">{children}</div>
}
