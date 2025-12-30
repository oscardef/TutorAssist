import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

export default async function StudentDashboard() {
  const user = await requireUser()
  const context = await getUserContext()
  const supabase = await createServerClient()
  
  // Get student profile
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', user?.id)
    .eq('workspace_id', context?.workspaceId)
    .single()
  
  // Get user metadata for name - check multiple common metadata fields
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const metadata = authUser?.user_metadata || {}
  const firstName = 
    profile?.name?.split(' ')[0] ||                  // Student profile name (first word)
    metadata.first_name ||                           // Direct first_name field
    metadata.name?.split(' ')[0] ||                  // name field (first word)
    metadata.full_name?.split(' ')[0] ||             // full_name field (first word)
    metadata.given_name ||                           // OAuth common field
    authUser?.email?.split('@')[0] ||                // Fall back to email prefix
    'Student'
  
  // Get recent attempts with questions
  const { data: recentAttempts } = await supabase
    .from('attempts')
    .select('*, questions(prompt_latex, prompt_text, difficulty, topics(name))')
    .eq('student_user_id', user?.id)
    .order('submitted_at', { ascending: false })
    .limit(10)
  
  // Get pending assignments
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      *,
      assignment_items(count)
    `)
    .eq('assigned_student_user_id', user?.id)
    .eq('status', 'active')
    .order('due_at', { ascending: true })
    .limit(5)
  
  // Get count of completed assignment questions for each assignment
  const assignmentIds = assignments?.map(a => a.id) || []
  const { data: completedCounts } = assignmentIds.length > 0 
    ? await supabase
        .from('attempts')
        .select('assignment_id')
        .eq('student_user_id', user?.id)
        .in('assignment_id', assignmentIds)
    : { data: [] }
  
  // Count completed per assignment
  const completedByAssignment = new Map<string, number>()
  completedCounts?.forEach(a => {
    if (a.assignment_id) {
      completedByAssignment.set(
        a.assignment_id, 
        (completedByAssignment.get(a.assignment_id) || 0) + 1
      )
    }
  })
  
  // Get spaced repetition items due
  const { data: dueItems } = await supabase
    .from('spaced_repetition')
    .select('*, questions(prompt_latex, topics(name))')
    .eq('student_user_id', user?.id)
    .lte('next_due', new Date().toISOString())
    .order('next_due')
    .limit(10)
  
  // Get upcoming sessions
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_user_id', user?.id)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(3)
  
  // Calculate stats
  const { count: totalAttempts } = await supabase
    .from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_user_id', user?.id)
  
  const { count: correctAttempts } = await supabase
    .from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_user_id', user?.id)
    .eq('is_correct', true)
  
  // Calculate streak (consecutive days with attempts)
  const { data: streakData } = await supabase
    .from('attempts')
    .select('submitted_at')
    .eq('student_user_id', user?.id)
    .order('submitted_at', { ascending: false })
    .limit(100)
  
  let currentStreak = 0
  if (streakData && streakData.length > 0) {
    const dates = new Set(
      streakData.map(a => format(new Date(a.submitted_at!), 'yyyy-MM-dd'))
    )
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
    
    if (dates.has(today) || dates.has(yesterday)) {
      let checkDate = dates.has(today) ? new Date() : new Date(Date.now() - 86400000)
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
    <div className="max-w-6xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {greeting}, {firstName}! 👋
        </h1>
        <p className="text-gray-500 mt-2">
          {getMotivationalMessage(accuracy, currentStreak, dueItems?.length || 0)}
        </p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Questions Practiced"
          value={totalAttempts || 0}
          icon="📝"
          color="blue"
        />
        <StatCard 
          label="Accuracy"
          value={`${accuracy}%`}
          icon="🎯"
          color="green"
          subtext={accuracy >= 80 ? "Excellent!" : accuracy >= 60 ? "Good progress" : "Keep practicing"}
        />
        <StatCard 
          label="Current Streak"
          value={`${currentStreak} day${currentStreak !== 1 ? 's' : ''}`}
          icon="🔥"
          color="orange"
          subtext={currentStreak > 0 ? "Keep it up!" : "Start today!"}
        />
        <StatCard 
          label="Due for Review"
          value={dueItems?.length || 0}
          icon="📚"
          color="purple"
          subtext={dueItems?.length ? "Ready to review" : "All caught up!"}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dueItems && dueItems.length > 0 ? (
                <Link
                  href="/student/practice?mode=review"
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl hover:shadow-md transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    ⏰
                  </div>
                  <div>
                    <div className="font-semibold text-amber-900">Review Due Items</div>
                    <div className="text-sm text-amber-700">
                      {dueItems.length} question{dueItems.length !== 1 ? 's' : ''} ready
                    </div>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/student/practice"
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl hover:shadow-md transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    ✏️
                  </div>
                  <div>
                    <div className="font-semibold text-blue-900">Start Practicing</div>
                    <div className="text-sm text-blue-700">Choose a topic to practice</div>
                  </div>
                </Link>
              )}
              
              {assignments && assignments.length > 0 ? (
                <Link
                  href={`/student/assignments/${assignments[0].id}`}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl hover:shadow-md transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    📋
                  </div>
                  <div>
                    <div className="font-semibold text-green-900">Continue Assignment</div>
                    <div className="text-sm text-green-700">{assignments[0].title}</div>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/student/progress"
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl hover:shadow-md transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    📊
                  </div>
                  <div>
                    <div className="font-semibold text-purple-900">View Progress</div>
                    <div className="text-sm text-purple-700">Check your performance</div>
                  </div>
                </Link>
              )}
            </div>
          </div>
          
          {/* Pending Assignments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">My Assignments</h2>
              <Link
                href="/student/assignments"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all →
              </Link>
            </div>
            
            {assignments && assignments.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {assignments.map((assignment) => {
                  const dueDate = assignment.due_at ? new Date(assignment.due_at) : null
                  const isOverdue = dueDate && isPast(dueDate)
                  const isDueToday = dueDate && isToday(dueDate)
                  const isDueTomorrow = dueDate && isTomorrow(dueDate)
                  const totalQuestions = (assignment.assignment_items as { count: number }[])?.[0]?.count || 0
                  const completedQuestions = completedByAssignment.get(assignment.id) || 0
                  const progress = totalQuestions > 0 
                    ? Math.round((completedQuestions / totalQuestions) * 100) 
                    : 0
                  
                  return (
                    <li key={assignment.id}>
                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                          isOverdue 
                            ? 'bg-red-100 text-red-600' 
                            : isDueToday
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {isOverdue ? '⚠️' : '📄'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {assignment.title}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-gray-500">
                              {completedQuestions}/{totalQuestions} completed
                            </span>
                            {dueDate && (
                              <span className={`text-sm ${
                                isOverdue ? 'text-red-600 font-medium' : 
                                isDueToday ? 'text-amber-600 font-medium' :
                                isDueTomorrow ? 'text-blue-600' : 'text-gray-500'
                              }`}>
                                {isOverdue ? 'Overdue' : 
                                 isDueToday ? 'Due today' :
                                 isDueTomorrow ? 'Due tomorrow' :
                                 `Due ${format(dueDate, 'MMM d')}`}
                              </span>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">✨</div>
                <div className="text-gray-500">No pending assignments</div>
                <div className="text-sm text-gray-400 mt-1">Great work staying on top of things!</div>
              </div>
            )}
          </div>
          
          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            
            {recentAttempts && recentAttempts.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {recentAttempts.slice(0, 5).map((attempt) => {
                  const question = attempt.questions as {
                    prompt_latex: string | null
                    prompt_text: string
                    difficulty: number | null
                    topics: { name: string } | null
                  } | null
                  
                  return (
                    <li key={attempt.id} className="flex items-center gap-4 px-6 py-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        attempt.is_correct 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {attempt.is_correct ? '✓' : '✗'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {question?.topics?.name || 'Practice Question'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {format(new Date(attempt.submitted_at!), 'MMM d, h:mm a')}
                          {attempt.time_spent_seconds && (
                            <span className="ml-2">• {formatTime(attempt.time_spent_seconds)}</span>
                          )}
                        </div>
                      </div>
                      {question?.difficulty && (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div 
                              key={i}
                              className={`w-1.5 h-3 rounded-full ${
                                i < question.difficulty! ? 'bg-blue-500' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">📖</div>
                <div className="text-gray-500">No activity yet</div>
                <div className="text-sm text-gray-400 mt-1">Start practicing to track your progress!</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar - Right 1/3 */}
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          {upcomingSessions && upcomingSessions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Sessions</h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {upcomingSessions.map((session) => (
                  <li key={session.id} className="px-6 py-4">
                    <div className="font-medium text-gray-900">{session.title}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {format(new Date(session.starts_at), 'EEEE, MMM d')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(session.starts_at), 'h:mm a')} - {format(new Date(session.ends_at), 'h:mm a')}
                    </div>
                    {session.meet_link && (
                      <a
                        href={session.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
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
          
          {/* Performance Tips */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">💡</span>
              <h3 className="font-semibold text-gray-900">Study Tip</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {getStudyTip(accuracy, currentStreak, dueItems?.length || 0)}
            </p>
          </div>
          
          {/* Weekly Goal Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Weekly Progress</h3>
            <WeeklyProgressChart attempts={recentAttempts || []} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper Components
function StatCard({ 
  label, 
  value, 
  icon, 
  color, 
  subtext 
}: { 
  label: string
  value: string | number
  icon: string
  color: 'blue' | 'green' | 'orange' | 'purple'
  subtext?: string
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    orange: 'bg-orange-50 border-orange-100',
    purple: 'bg-purple-50 border-purple-100',
  }
  
  const textClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    orange: 'text-orange-700',
    purple: 'text-purple-700',
  }
  
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textClasses[color]}`}>{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  )
}

function WeeklyProgressChart({ attempts }: { attempts: { submitted_at: string | null; is_correct: boolean | null }[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1) // Monday
  
  const dailyCounts = days.map((_, index) => {
    const dayDate = new Date(weekStart)
    dayDate.setDate(weekStart.getDate() + index)
    const dayStr = format(dayDate, 'yyyy-MM-dd')
    
    const dayAttempts = attempts.filter(a => 
      a.submitted_at && format(new Date(a.submitted_at), 'yyyy-MM-dd') === dayStr
    )
    
    return {
      day: days[index],
      total: dayAttempts.length,
      correct: dayAttempts.filter(a => a.is_correct).length,
      isToday: format(today, 'yyyy-MM-dd') === dayStr,
    }
  })
  
  const maxCount = Math.max(...dailyCounts.map(d => d.total), 5)
  
  return (
    <div className="flex items-end justify-between gap-2 h-24">
      {dailyCounts.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col items-center justify-end h-16">
            {day.total > 0 ? (
              <div 
                className={`w-full rounded-t transition-all ${
                  day.isToday ? 'bg-blue-500' : 'bg-blue-200'
                }`}
                style={{ height: `${(day.total / maxCount) * 100}%`, minHeight: '4px' }}
              />
            ) : (
              <div className="w-full h-1 bg-gray-100 rounded" />
            )}
          </div>
          <span className={`text-xs ${day.isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
            {day.day}
          </span>
        </div>
      ))}
    </div>
  )
}

// Helper functions
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getMotivationalMessage(accuracy: number, streak: number, dueItems: number): string {
  if (dueItems > 5) {
    return "You have some review items waiting! Reviewing helps reinforce what you've learned."
  }
  if (streak >= 7) {
    return `Amazing! You're on a ${streak}-day streak! Keep up the incredible consistency! 🌟`
  }
  if (streak >= 3) {
    return `Great job maintaining your ${streak}-day streak! Consistency is key to mastery.`
  }
  if (accuracy >= 90) {
    return "Outstanding accuracy! You're mastering these concepts brilliantly! 🎉"
  }
  if (accuracy >= 75) {
    return "Great progress! Your hard work is paying off. Keep it up!"
  }
  if (accuracy >= 50) {
    return "You're making good progress! Practice makes perfect - keep going!"
  }
  return "Ready to learn something new today? Let's get started!"
}

function getStudyTip(accuracy: number, streak: number, dueItems: number): string {
  if (dueItems > 3) {
    return "Spaced repetition is proven to improve long-term memory. Try to review your due items regularly to lock in what you've learned!"
  }
  if (accuracy < 60) {
    return "Don't worry about mistakes - they're part of learning! Focus on understanding the solution steps when you get something wrong."
  }
  if (streak === 0) {
    return "Even 10-15 minutes of daily practice can make a huge difference. Try to build a consistent study habit!"
  }
  if (accuracy >= 85) {
    return "You're doing great! Challenge yourself with harder difficulty questions to keep growing."
  }
  return "Break complex problems into smaller steps. Write down your working to avoid mistakes!"
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}
