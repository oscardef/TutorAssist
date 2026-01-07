import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ExpandableTopics } from '@/components/expandable-topics'

interface Assignment {
  id: string
  title: string
  description: string | null
  status: string
  due_at: string | null
  completed_at: string | null
  parent_assignment_id: string | null
  allow_repeat: boolean | null
  settings_json: {
    isParent?: boolean
    partNumber?: number
    totalParts?: number
  } | null
  assignment_items: { id: string; question_id: string }[]
}

interface AssignmentWithProgress extends Assignment {
  totalQuestions: number
  completedQuestions: number
  correctQuestions: number
  topics: string[]
  children: AssignmentWithProgress[]
  mostRecentScore?: number // For repeatable assignments: most recent attempt score
}

export default async function StudentAssignmentsPage() {
  const user = await requireUser()
  const context = await getUserContext()
  const supabase = await createServerClient()
  
  // Performance: Fetch assignments and attempts in parallel
  const [assignmentsResult, attemptsResult] = await Promise.all([
    // Get all assignments for student with items and topics
    supabase
      .from('assignments')
      .select(`
        *,
        assignment_items(
          id, 
          question_id,
          question:questions(
            id,
            topic_id,
            topics(id, name)
          )
        )
      `)
      .eq('assigned_student_user_id', user?.id)
      .eq('workspace_id', context?.workspaceId)
      .order('created_at', { ascending: false }),
    // Get ALL attempts for this student (we'll filter client-side)
    supabase
      .from('attempts')
      .select('question_id, is_correct, created_at, assignment_id')
      .eq('student_user_id', user?.id)
      .not('assignment_id', 'is', null)
      .order('created_at', { ascending: false })
  ])
  
  const assignments = assignmentsResult.data
  const allAttempts = attemptsResult.data
  
  // Get ALL question IDs across all assignments in one go
  const assignmentQuestionMap = new Map<string, string[]>()
  
  ;(assignments || []).forEach(assignment => {
    const items = assignment.assignment_items as { id: string; question_id: string; question?: { id: string; topics?: { name: string } | null } }[] || []
    const questionIds = items.map(item => item.question_id)
    assignmentQuestionMap.set(assignment.id, questionIds)
  })
  
  // Group attempts by assignment_id
  const attemptsByAssignment = new Map<string, { question_id: string; is_correct: boolean; created_at: string }[]>()
  allAttempts?.forEach(attempt => {
    if (attempt.assignment_id) {
      const existing = attemptsByAssignment.get(attempt.assignment_id) || []
      existing.push({
        question_id: attempt.question_id,
        is_correct: attempt.is_correct || false,
        created_at: attempt.created_at
      })
      attemptsByAssignment.set(attempt.assignment_id, existing)
    }
  })
  
  // Process all assignments with pre-fetched attempts (no additional queries)
  const assignmentsWithProgress = (assignments || []).map(assignment => {
    const items = assignment.assignment_items as { id: string; question_id: string; question?: { id: string; topics?: { name: string } | null } }[] || []
    const questionIds = assignmentQuestionMap.get(assignment.id) || []
    
    // Extract unique topic names from questions
    const topicNames = new Set<string>()
    items.forEach(item => {
      if (item.question?.topics?.name) {
        topicNames.add(item.question.topics.name)
      }
    })
    
    // Get attempts for this assignment from our pre-fetched data
    const attemptedQuestions = attemptsByAssignment.get(assignment.id) || []
    
    // Track most recent attempt per question (first one we see since ordered desc)
    const latestAttemptByQuestion = new Map<string, boolean>()
    attemptedQuestions.forEach(a => {
      // Only keep the first (most recent) attempt for each question that's in this assignment
      if (questionIds.includes(a.question_id) && !latestAttemptByQuestion.has(a.question_id)) {
        latestAttemptByQuestion.set(a.question_id, a.is_correct || false)
      }
    })
    
    const uniqueAttempted = latestAttemptByQuestion.size
    const correctCount = Array.from(latestAttemptByQuestion.values()).filter(v => v).length
    
    return {
      ...assignment,
      totalQuestions: items.length,
      completedQuestions: Math.min(uniqueAttempted, items.length),
      correctQuestions: correctCount,
      topics: Array.from(topicNames),
      children: [] as AssignmentWithProgress[],
      mostRecentScore: uniqueAttempted > 0 ? Math.round((correctCount / uniqueAttempted) * 100) : undefined,
    } as AssignmentWithProgress
  })
  
  // Auto-complete assignments where all questions have been answered
  // Performance: Batch all updates into a single operation instead of sequential awaits
  const assignmentsToComplete: string[] = []
  const parentAssignmentsToComplete: string[] = []
  
  for (const assignment of assignmentsWithProgress) {
    // Skip parent assignments - they complete based on children
    if (assignment.settings_json?.isParent) continue
    
    if (assignment.status === 'active' && 
        assignment.totalQuestions > 0 && 
        assignment.completedQuestions >= assignment.totalQuestions) {
      assignmentsToComplete.push(assignment.id)
      assignment.status = 'completed'
      assignment.completed_at = new Date().toISOString()
    }
  }
  
  // Check parent assignments - complete if all children are complete
  for (const assignment of assignmentsWithProgress) {
    if (assignment.settings_json?.isParent && assignment.status === 'active') {
      // Get all child assignments
      const childAssignments = assignmentsWithProgress.filter(
        a => a.parent_assignment_id === assignment.id
      )
      const allChildrenComplete = childAssignments.length > 0 && 
        childAssignments.every(c => c.status === 'completed')
      
      if (allChildrenComplete) {
        parentAssignmentsToComplete.push(assignment.id)
        assignment.status = 'completed'
        assignment.completed_at = new Date().toISOString()
      }
    }
  }
  
  // Execute batch updates in parallel (non-blocking, fire-and-forget for UI responsiveness)
  const allToComplete = [...assignmentsToComplete, ...parentAssignmentsToComplete]
  if (allToComplete.length > 0) {
    // Don't await - let it run in background to avoid blocking render
    // Wrap in Promise.resolve() for proper error handling
    void Promise.resolve(
      supabase
        .from('assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .in('id', allToComplete)
    ).catch(err => console.error('Error auto-completing assignments:', err))
  }
  
  // Group children under parents
  const groupAssignments = (list: AssignmentWithProgress[]): AssignmentWithProgress[] => {
    const parentMap = new Map<string, AssignmentWithProgress>()
    const childAssignments: AssignmentWithProgress[] = []
    const standalone: AssignmentWithProgress[] = []
    
    for (const assignment of list) {
      if (assignment.parent_assignment_id) {
        childAssignments.push(assignment)
      } else if (assignment.settings_json?.isParent) {
        parentMap.set(assignment.id, { ...assignment, children: [] })
      } else {
        standalone.push(assignment)
      }
    }
    
    // Attach children to parents
    for (const child of childAssignments) {
      const parent = parentMap.get(child.parent_assignment_id!)
      if (parent) {
        parent.children.push(child)
      } else {
        // Orphan child, show as standalone
        standalone.push(child)
      }
    }
    
    // Sort children by partNumber
    for (const parent of parentMap.values()) {
      parent.children.sort((a, b) => {
        const partA = a.settings_json?.partNumber || 0
        const partB = b.settings_json?.partNumber || 0
        return partA - partB
      })
      // Calculate parent totals from children
      parent.totalQuestions = parent.children.reduce((sum, c) => sum + c.totalQuestions, 0)
      parent.completedQuestions = parent.children.reduce((sum, c) => sum + c.completedQuestions, 0)
      parent.correctQuestions = parent.children.reduce((sum, c) => sum + c.correctQuestions, 0)
      // Aggregate unique topics from all children
      const allTopics = new Set<string>()
      parent.children.forEach(c => c.topics.forEach(t => allTopics.add(t)))
      parent.topics = Array.from(allTopics)
    }
    
    return [...parentMap.values(), ...standalone]
  }
  
  const grouped = groupAssignments(assignmentsWithProgress)
  const pendingAssignments = grouped.filter((a) => a.status === 'active')
  const completedAssignments = grouped.filter((a) => a.status === 'completed')
  
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
            {pendingAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
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
            {completedAssignments.map((assignment) => (
              <CompletedAssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AssignmentCard({ assignment }: { assignment: AssignmentWithProgress }) {
  const hasChildren = assignment.children && assignment.children.length > 0
  const dueDate = assignment.due_at ? new Date(assignment.due_at) : null
  const isOverdue = dueDate && dueDate < new Date()
  const { totalQuestions, completedQuestions, correctQuestions, topics } = assignment
  const progress = totalQuestions > 0 
    ? Math.round((completedQuestions / totalQuestions) * 100) 
    : 0
  
  // Find the first incomplete child to continue with
  const firstIncompleteChild = hasChildren 
    ? assignment.children.find(c => c.completedQuestions < c.totalQuestions) || assignment.children[0]
    : null

  if (hasChildren) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${isOverdue ? 'border-red-300' : ''}`}>
        {/* Header section */}
        <div className="p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {assignment.title}
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  {assignment.children.length} parts
                </span>
              </h3>
              {assignment.description && (
                <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>
              )}
              {/* Topics badges - expandable */}
              <ExpandableTopics topics={topics} maxVisible={4} />
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
                <span>
                  {completedQuestions} of {totalQuestions} completed
                  {completedQuestions > 0 && (
                    <span className={`ml-2 font-medium ${correctQuestions === completedQuestions ? 'text-green-600' : 'text-blue-600'}`}>
                      • ✓ {correctQuestions} correct
                    </span>
                  )}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {firstIncompleteChild && (
              <Link 
                href={`/student/assignments/${firstIncompleteChild.id}`}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue →
              </Link>
            )}
          </div>
        </div>
        
        {/* Sub-assignments list */}
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {assignment.children.map((child, idx) => {
            const isComplete = child.completedQuestions >= child.totalQuestions
            
            return (
              <Link
                key={child.id}
                href={`/student/assignments/${child.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {isComplete ? '✓' : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{child.title}</div>
                  <div className="text-sm text-gray-500">
                    {child.completedQuestions} of {child.totalQuestions} questions
                    {child.completedQuestions > 0 && (
                      <span className={`ml-1 ${child.correctQuestions === child.completedQuestions ? 'text-green-600' : ''}`}>
                        • ✓ {child.correctQuestions} correct
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Link
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
          {/* Topics badges - expandable */}
          <ExpandableTopics topics={topics} maxVisible={3} />
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
            <span>
              {completedQuestions} of {totalQuestions} completed
              {completedQuestions > 0 && (
                <span className={`ml-2 font-medium ${correctQuestions === completedQuestions ? 'text-green-600' : 'text-blue-600'}`}>
                  • ✓ {correctQuestions} correct
                </span>
              )}
            </span>
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
}

function CompletedAssignmentCard({ assignment }: { assignment: AssignmentWithProgress }) {
  const hasChildren = assignment.children && assignment.children.length > 0
  const { totalQuestions, correctQuestions, mostRecentScore } = assignment

  if (hasChildren) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                {assignment.children.length} parts
              </span>
            </div>
            {mostRecentScore !== undefined && (
              <span className="text-sm font-medium text-gray-600">
                Score: {mostRecentScore}%
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {totalQuestions} questions • Completed {assignment.completed_at ? new Date(assignment.completed_at).toLocaleDateString('en-GB') : ''}
          </p>
        </div>
        
        {/* Sub-assignments list */}
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {assignment.children.map((child) => (
            <div
              key={child.id}
              className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs text-green-700">
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">{child.title}</div>
                <div className="text-xs text-gray-500">
                  {child.totalQuestions} questions • {child.correctQuestions}/{child.totalQuestions} correct
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/student/assignments/${child.id}`}
                  className="text-gray-500 text-sm hover:text-gray-700"
                >
                  View
                </Link>
                <Link
                  href={`/student/assignments/${child.id}?retake=true`}
                  className="text-blue-600 text-sm font-medium hover:text-blue-700"
                >
                  Redo
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {totalQuestions} questions • {correctQuestions}/{totalQuestions} correct
            {mostRecentScore !== undefined && ` (${mostRecentScore}%)`}
            {assignment.completed_at && ` • Completed ${new Date(assignment.completed_at).toLocaleDateString('en-GB')}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href={`/student/assignments/${assignment.id}`}
            className="text-gray-500 text-sm hover:text-gray-700"
          >
            View
          </Link>
          <Link 
            href={`/student/assignments/${assignment.id}?retake=true`}
            className="text-blue-600 text-sm font-medium hover:text-blue-700"
          >
            Redo
          </Link>
        </div>
      </div>
    </div>
  )
}
