import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
  
  // Get recent attempts
  const { data: recentAttempts } = await supabase
    .from('attempts')
    .select('*, questions(question_latex, topics(name))')
    .eq('student_id', user?.id)
    .order('submitted_at', { ascending: false })
    .limit(5)
  
  // Get pending assignments
  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, assignment_items(count)')
    .eq('student_id', user?.id)
    .eq('status', 'assigned')
    .order('due_date', { ascending: true })
    .limit(5)
  
  // Get spaced repetition items due
  const { data: dueItems } = await supabase
    .from('spaced_repetition')
    .select('*, questions(question_latex, topics(name))')
    .eq('student_id', user?.id)
    .lte('next_review_date', new Date().toISOString())
    .order('next_review_date')
    .limit(10)
  
  // Calculate stats
  const { count: totalAttempts } = await supabase
    .from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user?.id)
  
  const { count: correctAttempts } = await supabase
    .from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user?.id)
    .eq('is_correct', true)
  
  const accuracy = totalAttempts && totalAttempts > 0
    ? Math.round((correctAttempts || 0) / totalAttempts * 100)
    : 0
  
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.display_name || user?.email?.split('@')[0]}! 👋
        </h1>
        <p className="text-gray-600 mt-1">
          Ready to practice? Let&apos;s improve your math skills today.
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-3xl font-bold text-blue-600">{totalAttempts || 0}</div>
          <div className="text-gray-600 text-sm">Questions Practiced</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-3xl font-bold text-green-600">{accuracy}%</div>
          <div className="text-gray-600 text-sm">Accuracy</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-3xl font-bold text-purple-600">{dueItems?.length || 0}</div>
          <div className="text-gray-600 text-sm">Due for Review</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-3xl font-bold text-orange-600">{assignments?.length || 0}</div>
          <div className="text-gray-600 text-sm">Pending Assignments</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Practice */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Practice</h2>
          
          {dueItems && dueItems.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="font-medium text-yellow-800">
                  {dueItems.length} question{dueItems.length !== 1 ? 's' : ''} due for review!
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  Reviewing questions helps reinforce your learning.
                </p>
              </div>
              
              <Link
                href="/student/practice?mode=review"
                className="block w-full text-center bg-yellow-600 text-white py-3 px-4 rounded-lg hover:bg-yellow-700 font-medium"
              >
                Start Review Session
              </Link>
            </div>
          ) : (
            <Link
              href="/student/practice"
              className="block w-full text-center bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium"
            >
              Start Practice
            </Link>
          )}
        </div>
        
        {/* Pending Assignments */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
            <Link
              href="/student/assignments"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>
          
          {assignments && assignments.length > 0 ? (
            <ul className="space-y-3">
              {assignments.map((assignment) => {
                const dueDate = assignment.due_date ? new Date(assignment.due_date) : null
                const isOverdue = dueDate && dueDate < new Date()
                
                return (
                  <li key={assignment.id}>
                    <Link
                      href={`/student/assignments/${assignment.id}`}
                      className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">
                        {assignment.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500">
                          {(assignment.assignment_items as { count: number }[])?.[0]?.count || 0} questions
                        </span>
                        {dueDate && (
                          <span className={`text-sm ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                            • Due {dueDate.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No pending assignments 🎉
            </p>
          )}
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        
        {recentAttempts && recentAttempts.length > 0 ? (
          <ul className="space-y-3">
            {recentAttempts.map((attempt) => {
              const question = attempt.questions as {
                question_latex: string
                topics: { name: string } | null
              } | null
              
              return (
                <li key={attempt.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    attempt.is_correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {attempt.is_correct ? '✓' : '✗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {question?.topics?.name || 'Question'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(attempt.submitted_at!).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {attempt.time_spent_seconds ? `${Math.round(attempt.time_spent_seconds / 60)}m` : ''}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No activity yet. Start practicing to see your progress!
          </p>
        )}
      </div>
    </div>
  )
}
