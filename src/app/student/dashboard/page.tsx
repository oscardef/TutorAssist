import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

interface AssignmentWithItems {
  id: string
  title: string
  description: string | null
  due_at: string | null
  status: string
  parent_assignment_id: string | null
  created_at: string
  assignment_items: { count: number }[]
  children?: AssignmentWithItems[]
}

export default async function StudentDashboard() {
  const user = await requireUser()
  const context = await getUserContext()
  const supabase = await createServerClient()
  
  // Performance: Fetch all independent data in parallel (Phase 1)
  const [
    profileResult,
    recentAttemptsResult,
    assignmentsResult,
    dueItemsResult,
    upcomingSessionsResult,
    totalAttemptsResult,
    correctAttemptsResult,
    streakDataResult,
  ] = await Promise.all([
    // Get student profile with program/grade info
    supabase
      .from('student_profiles')
      .select(`
        *,
        study_programs (
          id,
          code,
          name,
          color
        ),
        grade_levels (
          id,
          code,
          name
        )
      `)
      .eq('user_id', user?.id)
      .eq('workspace_id', context?.workspaceId)
      .single(),
    // Get recent attempts
    supabase
      .from('attempts')
      .select('*, questions(prompt_latex, prompt_text, difficulty, topics(name))')
      .eq('student_user_id', user?.id)
      .order('submitted_at', { ascending: false })
      .limit(10),
    // Get ALL assignments (both parent and children)
    supabase
      .from('assignments')
      .select(`
        id,
        title,
        description,
        due_at,
        status,
        parent_assignment_id,
        created_at,
        assignment_items(count)
      `)
      .eq('assigned_student_user_id', user?.id)
      .eq('status', 'active')
      .order('due_at', { ascending: true })
      .limit(20),
    // Get spaced repetition items due
    supabase
      .from('spaced_repetition')
      .select('*, questions(prompt_latex, topics(name))')
      .eq('student_user_id', user?.id)
      .lte('next_due', new Date().toISOString())
      .order('next_due')
      .limit(10),
    // Get upcoming sessions
    supabase
      .from('sessions')
      .select('*')
      .eq('student_id', user?.id)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(3),
    // Calculate stats - total attempts count
    supabase
      .from('attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_user_id', user?.id),
    // Calculate stats - correct attempts count
    supabase
      .from('attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_user_id', user?.id)
      .eq('is_correct', true),
    // Calculate streak
    supabase
      .from('attempts')
      .select('submitted_at')
      .eq('student_user_id', user?.id)
      .order('submitted_at', { ascending: false })
      .limit(100),
  ])

  // Extract results
  const profile = profileResult.data
  const recentAttempts = recentAttemptsResult.data
  const allAssignments = assignmentsResult.data as AssignmentWithItems[] | null
  const dueItems = dueItemsResult.data
  const upcomingSessions = upcomingSessionsResult.data
  const totalAttempts = totalAttemptsResult.count
  const correctAttempts = correctAttemptsResult.count
  const streakData = streakDataResult.data

  // Get assigned tutor info (conditional on profile having assigned_tutor_id)
  let assignedTutor = null
  if (profile?.assigned_tutor_id) {
    const { data: tutorMember } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('user_id', profile.assigned_tutor_id)
      .single()
    if (tutorMember) {
      assignedTutor = { user_id: tutorMember.user_id, name: 'Tutor', email: '' }
    }
  }
  
  const firstName = 
    profile?.name?.split(' ')[0] ||
    user.name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'Student'
  
  // Group assignments: parent assignments with their children
  const parentAssignments: AssignmentWithItems[] = []
  const childrenByParent = new Map<string, AssignmentWithItems[]>()
  
  allAssignments?.forEach(assignment => {
    if (assignment.parent_assignment_id) {
      const siblings = childrenByParent.get(assignment.parent_assignment_id) || []
      siblings.push(assignment)
      childrenByParent.set(assignment.parent_assignment_id, siblings)
    } else {
      parentAssignments.push(assignment)
    }
  })
  
  // Attach children to parents
  const displayAssignments: AssignmentWithItems[] = []
  parentAssignments.forEach(parent => {
    const children = childrenByParent.get(parent.id)
    if (children && children.length > 0) {
      parent.children = children.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }
    displayAssignments.push(parent)
  })
  
  // Get count of completed assignment questions AND correct counts (single query already fetched)
  const allAssignmentIds = allAssignments?.map(a => a.id) || []
  const attemptData = allAssignmentIds.length > 0 
    ? (await supabase
        .from('attempts')
        .select('assignment_id, is_correct')
        .eq('student_user_id', user?.id)
        .in('assignment_id', allAssignmentIds)).data
    : []
  
  const completedByAssignment = new Map<string, number>()
  const correctByAssignment = new Map<string, number>()
  attemptData?.forEach(a => {
    if (a.assignment_id) {
      completedByAssignment.set(
        a.assignment_id, 
        (completedByAssignment.get(a.assignment_id) || 0) + 1
      )
      if (a.is_correct) {
        correctByAssignment.set(
          a.assignment_id,
          (correctByAssignment.get(a.assignment_id) || 0) + 1
        )
      }
    }
  })
  
  // Calculate streak (using already-fetched streakData)
  let currentStreak = 0
  if (streakData && streakData.length > 0) {
    const now = new Date()
    const dates = new Set(
      streakData.map(a => format(new Date(a.submitted_at!), 'yyyy-MM-dd'))
    )
    const today = format(now, 'yyyy-MM-dd')
    const yesterdayDate = new Date(now.getTime() - 86400000)
    const yesterday = format(yesterdayDate, 'yyyy-MM-dd')
    
    if (dates.has(today) || dates.has(yesterday)) {
      let checkDate = dates.has(today) ? now : yesterdayDate
      while (dates.has(format(checkDate, 'yyyy-MM-dd'))) {
        currentStreak++
        checkDate = new Date(checkDate.getTime() - 86400000)
      }
    }
  }
  
  const accuracy = totalAttempts && totalAttempts > 0
    ? Math.round((correctAttempts || 0) / totalAttempts * 100)
    : 0
  
  const greeting = getGreeting()
  
  const Practice = Icons.practice
  const Progress = Icons.progress
  const Clock = Icons.clock
  const Mail = Icons.mail
  const ArrowRight = Icons.arrowRight
  const Flame = Icons.flame

  return (
    <div className="space-y-8">
      {/* Hero band */}
      <section className="bg-graph-fade -mx-4 -mt-6 px-4 pb-6 pt-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10">
        <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page-title">{greeting}, {firstName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {profile?.study_programs && <span className="chip chip-brand">{profile.study_programs.name}</span>}
              {profile?.grade_levels && <span className="chip">{profile.grade_levels.name}</span>}
              {currentStreak > 0 && (
                <span className="chip chip-spark"><Flame className="h-3.5 w-3.5" /> {currentStreak} day streak</span>
              )}
            </div>
          </div>
          {dueItems && dueItems.length > 0 ? (
            <Link href="/student/practice?mode=review" className="btn btn-spark btn-lg">
              <Clock className="h-5 w-5" /> Review {dueItems.length} due
            </Link>
          ) : (
            <Link href="/student/practice" className="btn btn-primary btn-lg">
              <Practice className="h-5 w-5" /> Practise now
            </Link>
          )}
        </div>
        <dl className="animate-rise-2 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Questions answered" value={totalAttempts || 0} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Day streak" value={currentStreak} />
          <Stat label="Ready to review" value={dueItems?.length || 0} />
        </dl>
      </section>

      {assignedTutor && (
        <section className="card animate-rise-3 flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-lg font-extrabold text-white">
            {assignedTutor.name?.charAt(0).toUpperCase() || 'T'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-500">Your tutor</p>
            <p className="truncate text-lg font-extrabold text-ink">{assignedTutor.name}</p>
          </div>
          {assignedTutor.email && (
            <a href={`mailto:${assignedTutor.email}`} className="btn btn-secondary btn-sm"><Mail className="h-4 w-4" /> Email</a>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Assignments */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Assignments</h2>
              <Link href="/student/assignments" className="btn btn-ghost btn-sm">See all</Link>
            </div>
            {displayAssignments.length > 0 ? (
              <ul className="divide-y divide-line">
                {displayAssignments.slice(0, 5).map(assignment => {
                  const hasChildren = !!assignment.children && assignment.children.length > 0
                  let totalQuestions = 0, completedQuestions = 0, correctQuestions = 0
                  if (hasChildren) {
                    assignment.children!.forEach(child => {
                      totalQuestions += (child.assignment_items as { count: number }[])?.[0]?.count || 0
                      completedQuestions += completedByAssignment.get(child.id) || 0
                      correctQuestions += correctByAssignment.get(child.id) || 0
                    })
                  } else {
                    totalQuestions = (assignment.assignment_items as { count: number }[])?.[0]?.count || 0
                    completedQuestions = completedByAssignment.get(assignment.id) || 0
                    correctQuestions = correctByAssignment.get(assignment.id) || 0
                  }
                  const progress = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0
                  const dueDate = hasChildren
                    ? assignment.children!.reduce((earliest, child) => {
                        if (!child.due_at) return earliest
                        if (!earliest) return new Date(child.due_at)
                        return new Date(child.due_at) < earliest ? new Date(child.due_at) : earliest
                      }, null as Date | null)
                    : assignment.due_at ? new Date(assignment.due_at) : null
                  const isOverdue = !!dueDate && isPast(dueDate) && progress < 100
                  const dueLabel = !dueDate ? null : isOverdue ? 'Overdue' : isToday(dueDate) ? 'Due today' : isTomorrow(dueDate) ? 'Due tomorrow' : `Due ${format(dueDate, 'd MMM')}`
                  const targetLink = hasChildren ? `/student/assignments/${assignment.children![0].id}` : `/student/assignments/${assignment.id}`
                  return (
                    <li key={assignment.id}>
                      <Link href={targetLink} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-paper">
                        <ProgressRing value={progress} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-bold text-ink">{assignment.title}</span>
                            {hasChildren && <span className="chip">{assignment.children!.length} parts</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="text-gray-500 tnum">{completedQuestions}/{totalQuestions} done</span>
                            {completedQuestions > 0 && <span className="font-semibold text-[#1f6b43] tnum">{correctQuestions} correct</span>}
                            {dueLabel && <span className={`font-semibold ${isOverdue ? 'text-red-700' : 'text-gray-500'}`}>{dueLabel}</span>}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="font-bold text-ink">No assignments right now</p>
                <p className="mt-1 text-sm text-gray-500">Practise a topic of your choice in the meantime.</p>
                <Link href="/student/practice" className="btn btn-primary mt-5"><Practice className="h-4 w-4" /> Practise</Link>
              </div>
            )}
          </section>

          {/* Recent activity */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Recent activity</h2>
              <Link href="/student/progress" className="btn btn-ghost btn-sm"><Progress className="h-4 w-4" /> Progress</Link>
            </div>
            {recentAttempts && recentAttempts.length > 0 ? (
              <ul className="divide-y divide-line">
                {recentAttempts.slice(0, 5).map(attempt => {
                  const question = attempt.questions as { prompt_latex: string | null; prompt_text: string; difficulty: number | null; topics: { name: string } | null } | null
                  return (
                    <li key={attempt.id} className="flex items-center gap-4 px-6 py-3.5">
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${attempt.is_correct ? 'bg-[#e3f3ea] text-[#1f6b43]' : 'bg-[#fbe5e5] text-[#9b2c2c]'}`} aria-label={attempt.is_correct ? 'Correct' : 'Incorrect'}>
                        {attempt.is_correct ? '✓' : '✗'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-ink">{question?.topics?.name || 'Practice question'}</div>
                        <div className="text-xs text-gray-500 tnum">
                          {format(new Date(attempt.submitted_at!), 'd MMM, HH:mm')}
                          {attempt.time_spent_seconds ? ` · ${formatTime(attempt.time_spent_seconds)}` : ''}
                        </div>
                      </div>
                      {question?.difficulty && (
                        <div className="flex gap-0.5" aria-label={`Difficulty ${question.difficulty} of 5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={`h-4 w-1.5 rounded-full ${i < question.difficulty! ? 'bg-brand-500' : 'bg-paper-deep'}`} />
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="font-bold text-ink">Nothing here yet</p>
                <p className="mt-1 text-sm text-gray-500">Your answers will show up here as you practise.</p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {upcomingSessions && upcomingSessions.length > 0 && (
            <section className="card">
              <div className="card-header"><h2 className="card-title">Upcoming sessions</h2></div>
              <ul className="divide-y divide-line">
                {upcomingSessions.map(session => {
                  const start = new Date(session.scheduled_at)
                  const end = new Date(start.getTime() + (session.duration_minutes || 60) * 60000)
                  return (
                    <li key={session.id} className="px-6 py-4">
                      <div className="font-bold text-ink">{format(start, 'EEEE d MMM')}</div>
                      <div className="text-sm text-gray-500 tnum">{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</div>
                      {session.meet_link && (
                        <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm mt-3">Join meeting</a>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section className="card p-6">
            <h2 className="card-title">This week</h2>
            <div className="mt-4">
              <WeeklyProgressChart attempts={recentAttempts || []} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card px-4 py-3">
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold text-ink tnum">{value}</dd>
    </div>
  )
}

function ProgressRing({ value }: { value: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const done = value >= 100
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-label={`${value}% complete`} className="flex-shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-paper-deep)" strokeWidth="5" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={done ? '#2e8b57' : 'var(--color-brand-500)'} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(value, 100) / 100)} transform="rotate(-90 24 24)" />
      <text x="24" y="28" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--color-ink)">{done ? '✓' : `${value}`}</text>
    </svg>
  )
}

function WeeklyProgressChart({ attempts }: { attempts: { submitted_at: string | null; is_correct: boolean | null }[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const dailyCounts = days.map((_, index) => {
    const dayDate = new Date(weekStart)
    dayDate.setDate(weekStart.getDate() + index)
    const dayStr = format(dayDate, 'yyyy-MM-dd')
    const dayAttempts = attempts.filter(a => a.submitted_at && format(new Date(a.submitted_at), 'yyyy-MM-dd') === dayStr)
    return { day: days[index], total: dayAttempts.length, correct: dayAttempts.filter(a => a.is_correct).length, isToday: format(today, 'yyyy-MM-dd') === dayStr }
  })
  const maxCount = Math.max(...dailyCounts.map(d => d.total), 5)
  return (
    <div className="flex h-28 items-end justify-between gap-2" role="img" aria-label="Questions answered per day this week">
      {dailyCounts.map((day, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-20 w-full flex-col items-center justify-end">
            {day.total > 0 ? (
              <div className={`w-full rounded-t-md ${day.isToday ? 'bg-brand-600' : 'bg-brand-300'}`} style={{ height: `${(day.total / maxCount) * 100}%`, minHeight: '8px' }} title={`${day.total} answered`} />
            ) : (
              <div className="h-1 w-full rounded bg-paper-deep" />
            )}
          </div>
          <span className={`text-xs ${day.isToday ? 'font-extrabold text-brand-700' : 'text-gray-500'}`}>{day.day}</span>
        </div>
      ))}
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}
