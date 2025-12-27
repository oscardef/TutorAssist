import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function TutorDashboard() {
  const context = await requireTutor()
  const supabase = await createServerClient()

  // Get user metadata for name
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const firstName = authUser?.user_metadata?.full_name?.split(' ')[0]
    || authUser?.email?.split('@')[0]
    || 'Tutor'

  // Get workspace info
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', context.workspaceId)
    .single()

  // Get upcoming sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, student_profiles(name)')
    .eq('workspace_id', context.workspaceId)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(5)

  // Get student profiles
  const { data: students } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .order('name')

  // Get pending flags count
  const { count: flagCount } = await supabase
    .from('question_flags')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', context.workspaceId)
    .eq('status', 'pending')

  // Get recent attempts (for activity monitoring)
  const { data: recentAttempts } = await supabase
    .from('attempts')
    .select('*, questions(prompt_text), student_profiles:student_user_id(name)')
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get question count
  const { count: questionCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', context.workspaceId)
    .eq('status', 'active')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}, {firstName}! 👋</h1>
        <p className="mt-1 text-sm text-gray-500">
          Managing {workspace?.name || 'your workspace'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Students</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{students?.length || 0}</div>
          <Link href="/tutor/students" className="mt-2 text-sm text-blue-600 hover:text-blue-500">
            View all →
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Questions</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{questionCount || 0}</div>
          <Link href="/tutor/questions" className="mt-2 text-sm text-blue-600 hover:text-blue-500">
            Question bank →
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Pending Flags</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{flagCount || 0}</div>
          <Link href="/tutor/flags" className="mt-2 text-sm text-blue-600 hover:text-blue-500">
            Review flags →
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Upcoming Sessions</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{sessions?.length || 0}</div>
          <Link href="/tutor/sessions" className="mt-2 text-sm text-blue-600 hover:text-blue-500">
            View calendar →
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Upcoming Sessions */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Upcoming Sessions</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {sessions && sessions.length > 0 ? (
              sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900">{session.title}</div>
                    <div className="text-sm text-gray-500">
                      {session.student_profiles?.name || 'No student'} • {format(new Date(session.starts_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                  {session.meet_link && (
                    <a
                      href={session.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
                    >
                      Join Meet
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                No upcoming sessions
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 px-6 py-4">
            <Link href="/tutor/sessions" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View all sessions →
            </Link>
          </div>
        </div>

        {/* Students */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Students</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {students && students.length > 0 ? (
              students.slice(0, 5).map((student) => (
                <Link
                  key={student.id}
                  href={`/tutor/students/${student.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-500">
                      {student.grade_current ? `Grade ${student.grade_current}` : 'No grade set'}
                      {student.school && ` • ${student.school}`}
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                No students yet. Create a student profile to get started.
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 px-6 py-4">
            <Link href="/tutor/students" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Manage students →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentAttempts && recentAttempts.length > 0 ? (
            recentAttempts.map((attempt) => (
              <div key={attempt.id} className="flex items-center gap-4 px-6 py-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  attempt.is_correct ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {attempt.is_correct ? (
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {attempt.questions?.prompt_text?.slice(0, 60)}...
                  </div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(attempt.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No recent activity
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/tutor/students/new"
          className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-900">Add Student</div>
            <div className="text-sm text-gray-500">Create a new student profile</div>
          </div>
        </Link>

        <Link
          href="/tutor/generate"
          className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 hover:border-green-300 hover:bg-green-50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-900">Generate Questions</div>
            <div className="text-sm text-gray-500">Create questions with AI</div>
          </div>
        </Link>

        <Link
          href="/tutor/assignments/new"
          className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 hover:border-purple-300 hover:bg-purple-50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-900">Create Assignment</div>
            <div className="text-sm text-gray-500">Assign questions to students</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
