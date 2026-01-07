import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
    authResult,
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
    // Get user metadata for name
    supabase.auth.getUser(),
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
  const authUser = authResult.data?.user
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
  
  const metadata = authUser?.user_metadata || {}
  const firstName = 
    profile?.name?.split(' ')[0] ||
    metadata.first_name ||
    metadata.name?.split(' ')[0] ||
    metadata.full_name?.split(' ')[0] ||
    metadata.given_name ||
    authUser?.email?.split('@')[0] ||
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
  
  return (
    <div className="max-w-5xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {greeting}, {firstName}! 👋
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {profile?.study_programs && (
            <span 
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: profile.study_programs.color ? `${profile.study_programs.color}20` : '#e5e7eb',
                color: profile.study_programs.color || '#374151'
              }}
            >
              {profile.study_programs.name}
            </span>
          )}
          {profile?.grade_levels && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {profile.grade_levels.name}
            </span>
          )}
        </div>
      </div>

      {/* Assigned Tutor Banner */}
      {assignedTutor && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white font-semibold text-xl shadow-lg">
              {assignedTutor.name?.charAt(0).toUpperCase() || 'T'}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Your Tutor</p>
              <p className="text-lg font-semibold text-gray-900">{assignedTutor.name}</p>
            </div>
            {assignedTutor.email && (
              <a 
                href={`mailto:${assignedTutor.email}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-indigo-600 bg-white rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                Contact
              </a>
            )}
          </div>
        </div>
      )}
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Questions" value={totalAttempts || 0} icon="📝" color="blue" />
        <StatCard label="Accuracy" value={`${accuracy}%`} icon="🎯" color="green" />
        <StatCard label="Streak" value={`${currentStreak} day${currentStreak !== 1 ? 's' : ''}`} icon="🔥" color="orange" />
        <StatCard label="To Review" value={dueItems?.length || 0} icon="📚" color="purple" />
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {dueItems && dueItems.length > 0 ? (
          <Link
            href="/student/practice?mode=review"
            className="flex items-center gap-4 p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="flex-shrink-0 w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">
              ⏰
            </div>
            <div>
              <div className="font-bold text-amber-900 text-lg">Review Due Items</div>
              <div className="text-sm text-amber-700">
                {dueItems.length} question{dueItems.length !== 1 ? 's' : ''} ready for review
              </div>
            </div>
          </Link>
        ) : (
          <Link
            href="/student/practice"
            className="flex items-center gap-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl hover:shadow-lg hover:scale-[1.02] transition-all group"
          >
            <div className="flex-shrink-0 w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">
              ✏️
            </div>
            <div>
              <div className="font-bold text-blue-900 text-lg">Start Practicing</div>
              <div className="text-sm text-blue-700">Choose a topic to practice</div>
            </div>
          </Link>
        )}
        
        <Link
          href="/student/progress"
          className="flex items-center gap-4 p-5 bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl hover:shadow-lg hover:scale-[1.02] transition-all group"
        >
          <div className="flex-shrink-0 w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">
            📊
          </div>
          <div>
            <div className="font-bold text-purple-900 text-lg">View Progress</div>
            <div className="text-sm text-purple-700">Track your learning journey</div>
          </div>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Assignments */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">My Assignments</h2>
              <Link href="/student/assignments" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View all →
              </Link>
            </div>
            
            {displayAssignments.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {displayAssignments.slice(0, 5).map((assignment) => {
                  const hasChildren = assignment.children && assignment.children.length > 0
                  
                  let totalQuestions = 0
                  let completedQuestions = 0
                  let correctQuestions = 0
                  
                  if (hasChildren) {
                    assignment.children!.forEach(child => {
                      const childTotal = (child.assignment_items as { count: number }[])?.[0]?.count || 0
                      totalQuestions += childTotal
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
                  
                  const isOverdue = dueDate && isPast(dueDate)
                  const isDueToday = dueDate && isToday(dueDate)
                  const isDueTomorrow = dueDate && isTomorrow(dueDate)
                  
                  const targetLink = hasChildren 
                    ? `/student/assignments/${assignment.children![0].id}`
                    : `/student/assignments/${assignment.id}`
                  
                  return (
                    <li key={assignment.id}>
                      <Link href={targetLink} className="flex items-center gap-4 px-6 py-5 hover:bg-gray-50 transition-colors">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                          progress === 100 ? 'bg-green-100 text-green-600'
                            : isOverdue ? 'bg-red-100 text-red-600' 
                            : isDueToday ? 'bg-amber-100 text-amber-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {progress === 100 ? '✓' : hasChildren ? `${assignment.children!.length}` : '📄'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 truncate">{assignment.title}</span>
                            {hasChildren && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                {assignment.children!.length} parts
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-sm text-gray-500">{completedQuestions}/{totalQuestions} completed</span>
                            {completedQuestions > 0 && (
                              <span className={`text-sm font-medium ${correctQuestions === completedQuestions ? 'text-green-600' : 'text-blue-600'}`}>
                                ✓ {correctQuestions}/{completedQuestions} correct
                              </span>
                            )}
                            {dueDate && (
                              <span className={`text-sm font-medium ${
                                isOverdue ? 'text-red-600' : isDueToday ? 'text-amber-600' : isDueTomorrow ? 'text-blue-600' : 'text-gray-500'
                              }`}>
                                {isOverdue ? 'Overdue' : isDueToday ? 'Due today' : isDueTomorrow ? 'Due tomorrow' : `Due ${format(dueDate, 'MMM d')}`}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="text-5xl mb-4">✨</div>
                <div className="text-gray-600 font-medium">No pending assignments</div>
                <div className="text-sm text-gray-400 mt-1">Great work staying on top of things!</div>
              </div>
            )}
          </div>
          
          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
            </div>
            
            {recentAttempts && recentAttempts.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {recentAttempts.slice(0, 5).map((attempt) => {
                  const question = attempt.questions as { prompt_latex: string | null; prompt_text: string; difficulty: number | null; topics: { name: string } | null } | null
                  
                  return (
                    <li key={attempt.id} className="flex items-center gap-4 px-6 py-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${attempt.is_correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {attempt.is_correct ? '✓' : '✗'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{question?.topics?.name || 'Practice Question'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {format(new Date(attempt.submitted_at!), 'MMM d, h:mm a')}
                          {attempt.time_spent_seconds && <span className="ml-2">• {formatTime(attempt.time_spent_seconds)}</span>}
                        </div>
                      </div>
                      {question?.difficulty && (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={`w-1.5 h-4 rounded-full ${i < question.difficulty! ? 'bg-blue-500' : 'bg-gray-200'}`} />
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="text-5xl mb-4">📖</div>
                <div className="text-gray-600 font-medium">No activity yet</div>
                <div className="text-sm text-gray-400 mt-1">Start practicing to track your progress!</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          {upcomingSessions && upcomingSessions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Upcoming Sessions</h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {upcomingSessions.map((session) => (
                  <li key={session.id} className="px-6 py-4">
                    <div className="font-medium text-gray-900">Tutoring Session</div>
                    <div className="text-sm text-gray-500 mt-1">{format(new Date(session.scheduled_at), 'EEEE, MMM d')}</div>
                    <div className="text-sm text-gray-500">{format(new Date(session.scheduled_at), 'h:mm a')} - {format(new Date(new Date(session.scheduled_at).getTime() + (session.duration_minutes || 60) * 60000), 'h:mm a')}</div>
                    {session.meet_link && (
                      <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                        <span>Join Meeting</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Weekly Progress */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">This Week</h3>
            <WeeklyProgressChart attempts={recentAttempts || []} />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: 'blue' | 'green' | 'orange' | 'purple' }) {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200',
    green: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
    orange: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200',
    purple: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200',
  }
  const textClasses = { blue: 'text-blue-700', green: 'text-green-700', orange: 'text-orange-700', purple: 'text-purple-700' }
  
  return (
    <div className={`rounded-2xl border-2 p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2"><span className="text-2xl">{icon}</span></div>
      <div className={`text-2xl font-bold ${textClasses[color]}`}>{value}</div>
      <div className="text-sm text-gray-600 mt-0.5">{label}</div>
    </div>
  )
}

function WeeklyProgressChart({ attempts }: { attempts: { submitted_at: string | null; is_correct: boolean | null }[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  
  const dailyCounts = days.map((_, index) => {
    const dayDate = new Date(weekStart)
    dayDate.setDate(weekStart.getDate() + index)
    const dayStr = format(dayDate, 'yyyy-MM-dd')
    const dayAttempts = attempts.filter(a => a.submitted_at && format(new Date(a.submitted_at), 'yyyy-MM-dd') === dayStr)
    return { day: days[index], total: dayAttempts.length, correct: dayAttempts.filter(a => a.is_correct).length, isToday: format(today, 'yyyy-MM-dd') === dayStr }
  })
  
  const maxCount = Math.max(...dailyCounts.map(d => d.total), 5)
  
  return (
    <div className="flex items-end justify-between gap-2 h-28">
      {dailyCounts.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col items-center justify-end h-20">
            {day.total > 0 ? (
              <div className={`w-full rounded-t-lg transition-all ${day.isToday ? 'bg-blue-500' : 'bg-blue-300'}`} style={{ height: `${(day.total / maxCount) * 100}%`, minHeight: '8px' }} />
            ) : (
              <div className="w-full h-1 bg-gray-100 rounded" />
            )}
          </div>
          <span className={`text-xs ${day.isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>{day.day}</span>
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
