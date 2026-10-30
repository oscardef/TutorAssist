import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { CancelSessionButton } from '@/components/cancel-session-button'
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
      // Keep a session listed while it may still be running
      .gte('scheduled_at', new Date(new Date().getTime() - 4 * 3600_000).toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .is('actual_end', null)
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
  const { count: bookableTutorCount } = await supabase
    .from('booking_settings')
    .select('tutor_user_id', { count: 'exact', head: true })
    .eq('workspace_id', context?.workspaceId)
    .eq('enabled', true)
  const canBook = (bookableTutorCount ?? 0) > 0
  const nowMs = new Date().getTime()
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

  const DAILY_GOAL = 10
  const weekStartDate = new Date(); weekStartDate.setDate(weekStartDate.getDate() - ((weekStartDate.getDay() + 6) % 7)); weekStartDate.setHours(0, 0, 0, 0)
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const todayCount = (streakData || []).filter(a => a.submitted_at && format(new Date(a.submitted_at), 'yyyy-MM-dd') === todayKey).length
  const activeDays = new Set((streakData || []).map(a => a.submitted_at ? format(new Date(a.submitted_at), 'yyyy-MM-dd') : '').filter(Boolean))
  const weekDots = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return { label: format(d, 'EEEEE'), active: activeDays.has(format(d, 'yyyy-MM-dd')), today: i === 6 }
  })
  // The next thing to do: first unfinished assignment (earliest due)
  const nextUpAssignment = displayAssignments.find(a => {
    const total = (a.children && a.children.length > 0)
      ? a.children.reduce((n, c) => n + ((c.assignment_items as { count: number }[])?.[0]?.count || 0), 0)
      : ((a.assignment_items as { count: number }[])?.[0]?.count || 0)
    const done = (a.children && a.children.length > 0)
      ? a.children.reduce((n, c) => n + (completedByAssignment.get(c.id) || 0), 0)
      : (completedByAssignment.get(a.id) || 0)
    return total > 0 && done < total
  })
  const nextUp = nextUpAssignment ? {
    title: nextUpAssignment.title,
    href: nextUpAssignment.children && nextUpAssignment.children.length > 0
      ? `/student/assignments/${(nextUpAssignment.children.find(c => (completedByAssignment.get(c.id) || 0) < ((c.assignment_items as { count: number }[])?.[0]?.count || 0)) || nextUpAssignment.children[0]).id}`
      : `/student/assignments/${nextUpAssignment.id}`,
    due: nextUpAssignment.due_at ? (isToday(new Date(nextUpAssignment.due_at)) ? 'today' : isTomorrow(new Date(nextUpAssignment.due_at)) ? 'tomorrow' : format(new Date(nextUpAssignment.due_at), 'd MMM')) : null,
  } : null
  
  const Practice = Icons.practice
  const Progress = Icons.progress
  const Clock = Icons.clock
  const Mail = Icons.mail
  const ArrowRight = Icons.arrowRight
  const Flame = Icons.flame

  return (
    <div className="space-y-8">
      {/* Hero: greeting + today's goal card */}
      <section className="bg-graph-fade -mx-4 -mt-6 px-4 pb-6 pt-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-stretch">
          <div className="animate-rise flex flex-col justify-between">
            <div>
              <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink sm:text-[2.125rem]">{greeting}, {firstName}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {profile?.study_programs && <span className="chip chip-brand">{profile.study_programs.name}</span>}
                {profile?.grade_levels && <span className="chip">{profile.grade_levels.name}</span>}
              </div>
              <p className="mt-4 max-w-md text-gray-600">
                {nextUp
                  ? <>Pick up <span className="font-bold text-ink">{nextUp.title}</span>{nextUp.due ? `, due ${nextUp.due}` : ''}.</>
                  : dueItems && dueItems.length > 0
                  ? <>{dueItems.length} question{dueItems.length === 1 ? '' : 's'} are ready to review before they fade.</>
                  : <>Nothing is due. A short practice keeps the streak alive.</>}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {nextUp ? (
                <Link href={nextUp.href} className="btn btn-primary btn-lg"><Practice className="h-5 w-5" /> Continue</Link>
              ) : (
                <Link href="/student/practice" className="btn btn-primary btn-lg"><Practice className="h-5 w-5" /> Practise</Link>
              )}
              {dueItems && dueItems.length > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Link href="/student/practice?mode=review" className="btn btn-spark btn-lg"><Clock className="h-5 w-5" /> Review {dueItems.length}</Link>
                  <InfoTip text="Questions you got wrong or answered a while ago come back on a schedule, so they stick." label="What is review?" className="text-gray-500" />
                </span>
              )}
            </div>
          </div>

          <GoalCard today={todayCount} goal={DAILY_GOAL} streak={currentStreak} week={weekDots} accuracy={accuracy} answered={totalAttempts || 0} />
        </div>
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
          {((upcomingSessions && upcomingSessions.length > 0) || canBook) && (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Upcoming sessions</h2>
                {canBook && <Link href="/student/book" className="btn btn-ghost btn-sm"><Icons.plus className="h-4 w-4" /> Book</Link>}
              </div>
              {(!upcomingSessions || upcomingSessions.length === 0) && (
                <div className="px-6 pb-6 text-sm text-gray-500">No sessions booked. <Link href="/student/book" className="font-semibold text-brand-700 hover:underline">Pick a time</Link></div>
              )}
              <ul className="divide-y divide-line">
                {(upcomingSessions ?? []).map(session => {
                  const start = new Date(session.scheduled_at)
                  const end = new Date(start.getTime() + (session.duration_minutes || 60) * 60000)
                  if (end.getTime() < nowMs) return null
                  // Live from 15 minutes before the start until the end
                  const live = nowMs >= start.getTime() - 15 * 60000 && nowMs <= end.getTime()
                  return (
                    <li key={session.id} className={`px-6 py-4 ${live ? 'bg-brand-50' : ''}`}>
                      <div className="flex items-center gap-2 font-bold text-ink">{format(start, 'EEEE d MMM')}{live && <span className="chip chip-brand !py-0">Now</span>}</div>
                      <div className="text-sm text-gray-500 tnum">{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/session/${session.id}`} className={`btn btn-sm ${live ? 'btn-primary' : 'btn-secondary'}`}><Icons.board className="h-4 w-4" /> Join room</Link>
                        {session.meet_link && (
                          <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Icons.video className="h-4 w-4" /> Video call</a>
                        )}
                        {!live && <CancelSessionButton sessionId={session.id} />}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section className="card p-6">
            <h2 className="card-title">This week</h2>
            {(recentAttempts || []).some(a => a.submitted_at && new Date(a.submitted_at) >= weekStartDate) ? (
              <div className="mt-4"><WeeklyProgressChart attempts={recentAttempts || []} /></div>
            ) : (
              <div className="mt-4 rounded-xl bg-paper px-4 py-5 text-center">
                <p className="text-sm font-bold text-ink">No practice yet this week</p>
                <p className="mt-1 text-xs text-gray-500">Ten questions a day keeps the streak.</p>
                <Link href="/student/practice" className="btn btn-secondary btn-sm mt-3">Start</Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function GoalCard({ today, goal, streak, week, accuracy, answered }: { today: number; goal: number; streak: number; week: { label: string; active: boolean; today: boolean }[]; accuracy: number; answered: number }) {
  const pct = Math.min(100, Math.round((today / goal) * 100))
  const r = 52
  const c = 2 * Math.PI * r
  const Flame = Icons.flame
  return (
    <div className="animate-rise-2 relative overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-600/30" aria-hidden="true" />
      <div className="relative flex items-center gap-5">
        <svg width="132" height="132" viewBox="0 0 132 132" aria-label={`${today} of ${goal} questions today`}>
          <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
          <circle cx="66" cy="66" r={r} fill="none" stroke="#f2a541" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 66 66)" />
          <text x="66" y="62" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff">{today}</text>
          <text x="66" y="84" textAnchor="middle" fontSize="12" fontWeight="600" fill="rgba(255,255,255,0.7)">of {goal} today</text>
        </svg>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70">Streak <InfoTip text="Days in a row with at least one question answered. Today counts once you answer one." label="What is a streak?" /></p>
          <p className="mt-0.5 flex items-center gap-2 text-3xl font-extrabold tnum"><Flame className={`h-7 w-7 ${streak > 0 ? 'text-spark-400' : 'text-white/30'}`} /> {streak} <span className="text-base font-semibold text-white/60">day{streak === 1 ? '' : 's'}</span></p>
          <ol className="mt-3 flex gap-1.5" aria-label="Last seven days">
            {week.map((d, i) => (
              <li key={i} className="flex flex-col items-center gap-1">
                <span className={`block h-3 w-3 rounded-full ${d.active ? 'bg-spark-400' : 'bg-white/15'} ${d.today ? 'ring-2 ring-white/60' : ''}`} title={d.active ? 'Practised' : 'No practice'} />
                <span className="text-[10px] font-semibold text-white/50">{d.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <dl className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
        <div><dt className="text-white/60">Accuracy</dt><dd className="text-xl font-extrabold tnum">{accuracy}%</dd></div>
        <div><dt className="text-white/60">Answered</dt><dd className="text-xl font-extrabold tnum">{answered}</dd></div>
      </dl>
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
