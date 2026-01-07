import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function TutorDashboard() {
  const context = await requireTutor()
  const supabase = await createServerClient()

  // Performance: Fetch all independent data in parallel
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [
    authResult,
    sessionsResult,
    studentsResult,
    flagCountResult,
    assignmentsResult,
    attemptStatsResult,
  ] = await Promise.all([
    // Get user metadata for name
    supabase.auth.getUser(),
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
  const authUser = authResult.data?.user
  const metadata = authUser?.user_metadata || {}
  const firstName = 
    metadata.first_name ||                           // Direct first_name field
    metadata.name?.split(' ')[0] ||                  // name field (first word)
    metadata.full_name?.split(' ')[0] ||             // full_name field (first word)
    metadata.given_name ||                           // OAuth common field
    authUser?.email?.split('@')[0] ||                // Fall back to email prefix
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}, {firstName}!</h1>
        <p className="mt-1 text-sm text-gray-500">
          {hasActionItems ? "Here's what needs your attention" : "Everything looks good!"}
        </p>
      </div>

      {/* Action Items - Only show if there's something to do */}
      {hasActionItems && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hasFlags && (
            <Link
              href="/tutor/flags"
              className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-200">
                  <svg className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-semibold text-amber-800">{flagCount} Flags</div>
                  <div className="text-sm text-amber-600">Questions need review</div>
                </div>
              </div>
            </Link>
          )}

          {hasOverdue && (
            <Link
              href="/tutor/assignments"
              className="rounded-xl border-2 border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-200">
                  <svg className="h-5 w-5 text-red-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-800">{overdueAssignments.length} Overdue</div>
                  <div className="text-sm text-red-600">Assignments past due</div>
                </div>
              </div>
            </Link>
          )}

          {hasStruggling && (
            <Link
              href="/tutor/students"
              className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4 hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-200">
                  <svg className="h-5 w-5 text-orange-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-semibold text-orange-800">{studentsNeedingAttention.length} Struggling</div>
                  <div className="text-sm text-orange-600">Students need help</div>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Today&apos;s Schedule</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {todaySessions.length > 0 ? (
              todaySessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="font-medium text-gray-900">
                      {session.student_profiles?.name || 'Session'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(session.scheduled_at), 'h:mm a')}
                    </div>
                  </div>
                  {session.meet_link && (
                    <a
                      href={session.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Join
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-500">
                No sessions scheduled for today
              </div>
            )}
          </div>
          {tomorrowSessions.length > 0 && (
            <>
              <div className="border-t border-gray-100 bg-gray-50 px-5 py-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Tomorrow</span>
              </div>
              <div className="divide-y divide-gray-50">
                {tomorrowSessions.slice(0, 2).map((session) => (
                  <div key={session.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        {session.student_profiles?.name || 'Session'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {format(new Date(session.scheduled_at), 'h:mm a')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="border-t border-gray-100 px-5 py-3">
            <Link href="/tutor/sessions" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View full calendar →
            </Link>
          </div>
        </div>

        {/* Assignments Due Soon */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Assignments Due Soon</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {dueSoonAssignments.length > 0 ? (
              dueSoonAssignments.slice(0, 5).map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/tutor/assignments/${assignment.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-gray-900">{assignment.title}</div>
                    <div className="text-sm text-gray-500">
                      {assignment.student_profiles?.name || 'All students'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      isToday(new Date(assignment.due_at)) ? 'text-red-600' : 
                      isTomorrow(new Date(assignment.due_at)) ? 'text-orange-600' : 'text-gray-600'
                    }`}>
                      {isToday(new Date(assignment.due_at)) ? 'Today' :
                       isTomorrow(new Date(assignment.due_at)) ? 'Tomorrow' :
                       format(new Date(assignment.due_at), 'MMM d')}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-500">
                No assignments due soon
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 px-5 py-3">
            <Link href="/tutor/assignments" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View all assignments →
            </Link>
          </div>
        </div>
      </div>

      {/* Students Overview */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Students ({students?.length || 0})</h2>
          <Link
            href="/tutor/students/new"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            + Add student
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {students && students.length > 0 ? (
            students.slice(0, 5).map((student) => {
              const stats = student.user_id ? studentStats.get(student.user_id) : null
              const accuracy = stats && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null
              
              return (
                <Link
                  key={student.id}
                  href={`/tutor/students/${student.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{student.name}</div>
                      <div className="text-sm text-gray-500">
                        {student.grade_current ? `Grade ${student.grade_current}` : ''}
                        {student.school && student.grade_current ? ' • ' : ''}
                        {student.school || ''}
                      </div>
                    </div>
                  </div>
                  {accuracy !== null && (
                    <div className={`text-sm font-medium ${
                      accuracy >= 70 ? 'text-green-600' : 
                      accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {accuracy}%
                    </div>
                  )}
                </Link>
              )
            })
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-500 mb-3">No students yet</p>
              <Link
                href="/tutor/students/new"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Add your first student
              </Link>
            </div>
          )}
        </div>
        {students && students.length > 5 && (
          <div className="border-t border-gray-100 px-5 py-3">
            <Link href="/tutor/students" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View all {students.length} students →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
