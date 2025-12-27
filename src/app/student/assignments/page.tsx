import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function StudentAssignmentsPage() {
  const user = await requireUser()
  const context = await getUserContext()
  const supabase = await createServerClient()
  
  // Get all assignments for student with items
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      *,
      assignment_items(id, question_id)
    `)
    .eq('assigned_student_user_id', user?.id)
    .eq('workspace_id', context?.workspaceId)
    .order('created_at', { ascending: false })
  
  // For each assignment, get unique questions that have been attempted
  const assignmentsWithProgress = await Promise.all(
    (assignments || []).map(async (assignment) => {
      const items = assignment.assignment_items as { id: string; question_id: string }[] || []
      const questionIds = items.map(item => item.question_id)
      
      // Get distinct question_ids that have attempts for this assignment
      const { data: attemptedQuestions } = questionIds.length > 0 
        ? await supabase
            .from('attempts')
            .select('question_id')
            .eq('assignment_id', assignment.id)
            .eq('student_user_id', user?.id)
            .in('question_id', questionIds)
        : { data: [] }
      
      // Count unique questions attempted
      const uniqueAttempted = new Set(attemptedQuestions?.map(a => a.question_id) || []).size
      
      return {
        ...assignment,
        totalQuestions: items.length,
        completedQuestions: Math.min(uniqueAttempted, items.length), // Cap at total
      }
    })
  )
  
  const pendingAssignments = assignmentsWithProgress.filter((a) => a.status === 'active')
  const completedAssignments = assignmentsWithProgress.filter((a) => a.status === 'completed')
  
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
        <p className="text-gray-600 mt-1">
          Complete your assignments to track your progress.
        </p>
      </div>
      
      {/* Pending Assignments */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Pending ({pendingAssignments.length})
        </h2>
        
        {pendingAssignments.length > 0 ? (
          <div className="grid gap-4">
            {pendingAssignments.map((assignment) => {
              const dueDate = assignment.due_at ? new Date(assignment.due_at) : null
              const isOverdue = dueDate && dueDate < new Date()
              const { totalQuestions, completedQuestions } = assignment
              const progress = totalQuestions > 0 
                ? Math.round((completedQuestions / totalQuestions) * 100) 
                : 0
              
              return (
                <Link
                  key={assignment.id}
                  href={`/student/assignments/${assignment.id}`}
                  className={`bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow ${
                    isOverdue ? 'border-red-300' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                      {assignment.description && (
                        <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>
                      )}
                    </div>
                    {dueDate && (
                      <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {isOverdue ? 'Overdue' : `Due ${dueDate.toLocaleDateString('en-GB')}`}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>{completedQuestions} of {totalQuestions} completed</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-blue-600 text-sm font-medium">
                      Continue →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
            No pending assignments.
          </div>
        )}
      </div>
      
      {/* Completed Assignments */}
      {completedAssignments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Completed ({completedAssignments.length})
          </h2>
          
          <div className="grid gap-4">
            {completedAssignments.map((assignment) => {
              const { totalQuestions } = assignment
              
              return (
                <Link
                  key={assignment.id}
                  href={`/student/assignments/${assignment.id}`}
                  className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow opacity-75"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {totalQuestions} questions • Completed {new Date(assignment.completed_at!).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <span className="text-gray-400 text-sm">
                      View Results →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
