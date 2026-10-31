import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { ExpandableTopics } from '@/components/expandable-topics'
import { formatDate } from '@/lib/dates'

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
  
  const Practice = Icons.practice
  const pendingQuestions = pendingAssignments.reduce((n, a) => n + Math.max(0, a.totalQuestions - a.completedQuestions), 0)

  return (
    <div className="space-y-8">
      <section className="bg-graph-fade -mx-4 -mt-6 px-4 pb-6 pt-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10">
        <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Assignments</h1>
            <p className="page-subtitle tnum">
              {pendingAssignments.length === 0
                ? 'All caught up.'
                : `${pendingAssignments.length} to do, ${pendingQuestions} question${pendingQuestions === 1 ? '' : 's'} left`}
            </p>
          </div>
          {pendingAssignments.length === 0 && (
            <Link href="/student/practice" className="btn btn-primary"><Practice className="h-5 w-5" /> Practise instead</Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-gray-500">To do</h2>
        {pendingAssignments.length > 0 ? (
          <div className="grid gap-4">
            {pendingAssignments.map((assignment, idx) => (
              <AssignmentCard key={assignment.id} assignment={assignment} featured={idx === 0} />
            ))}
          </div>
        ) : (
          <div className="card px-6 py-12 text-center">
            <p className="font-bold text-ink">Nothing waiting for you</p>
            <p className="mt-1 text-sm text-gray-500">New assignments from your tutor land here.</p>
          </div>
        )}
      </section>

      {completedAssignments.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-500">Done</h2>
          <div className="grid gap-3">
            {completedAssignments.map(assignment => (
              <CompletedAssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function dueLabel(due: Date | null) {
  if (!due) return null
  const now = new Date()
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  if (days < 0) return { text: 'Overdue', cls: 'chip-bad' }
  if (days === 0) return { text: 'Due today', cls: 'chip-spark' }
  if (days === 1) return { text: 'Due tomorrow', cls: 'chip-spark' }
  return { text: `Due ${formatDate(due)}`, cls: 'chip' }
}

function Ring({ value, size = 56, done }: { value: number; size?: number; done?: boolean }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" aria-label={`${value}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper-deep)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={done ? '#2e8b57' : 'var(--color-brand-500)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={size >= 56 ? 14 : 11} fontWeight="800" fill="var(--color-ink)">{done ? '✓' : `${value}`}</text>
    </svg>
  )
}

function AssignmentCard({ assignment, featured }: { assignment: AssignmentWithProgress; featured?: boolean }) {
  const hasChildren = assignment.children && assignment.children.length > 0
  const dueDate = assignment.due_at ? new Date(assignment.due_at) : null
  const due = dueLabel(dueDate)
  const { totalQuestions, completedQuestions, correctQuestions, topics } = assignment
  const progress = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0
  const firstIncompleteChild = hasChildren
    ? assignment.children.find(c => c.completedQuestions < c.totalQuestions) || assignment.children[0]
    : null
  const href = hasChildren && firstIncompleteChild ? `/student/assignments/${firstIncompleteChild.id}` : `/student/assignments/${assignment.id}`
  const Arrow = Icons.arrowRight
  const Check = Icons.check

  return (
    <article className={`card overflow-hidden ${featured ? 'border-brand-300 shadow-md' : ''}`}>
      <div className="flex items-center gap-4 p-5">
        <Ring value={progress} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-ink">{assignment.title}</h3>
            {hasChildren && <span className="chip">{assignment.children.length} parts</span>}
            {due && <span className={`chip ${due.cls}`}>{due.text}</span>}
          </div>
          {assignment.description && <p className="mt-0.5 text-sm text-gray-600">{assignment.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm text-gray-500 tnum">
            <span>{completedQuestions} of {totalQuestions} done</span>
            {completedQuestions > 0 && <span className="font-semibold text-[#1f6b43]">{correctQuestions} correct</span>}
          </div>
          {topics.length > 0 && <div className="mt-2"><ExpandableTopics topics={topics} maxVisible={featured ? 5 : 3} /></div>}
        </div>
        <Link href={href} className={`btn ${featured ? 'btn-primary' : 'btn-secondary'} flex-shrink-0`} aria-label={`Continue ${assignment.title}`}>
          {completedQuestions > 0 ? 'Continue' : 'Start'} <Arrow className="h-4 w-4" />
        </Link>
      </div>

      {hasChildren && (
        <ol className="divide-y divide-line border-t border-line bg-paper/60">
          {assignment.children.map((child, idx) => {
            const isComplete = child.completedQuestions >= child.totalQuestions
            const inProgress = !isComplete && child.completedQuestions > 0
            return (
              <li key={child.id}>
                <Link href={`/student/assignments/${child.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white">
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold tnum ${isComplete ? 'bg-[#e3f3ea] text-[#1f6b43]' : inProgress ? 'bg-brand-100 text-brand-800' : 'bg-paper-deep text-gray-500'}`}>
                    {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{child.title}</span>
                    <span className="block text-xs text-gray-500 tnum">{child.completedQuestions} of {child.totalQuestions}{child.completedQuestions > 0 ? `, ${child.correctQuestions} correct` : ''}</span>
                  </span>
                  <Arrow className="h-4 w-4 flex-shrink-0 text-gray-300" />
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </article>
  )
}

function CompletedAssignmentCard({ assignment }: { assignment: AssignmentWithProgress }) {
  const hasChildren = assignment.children && assignment.children.length > 0
  const { totalQuestions, correctQuestions, mostRecentScore } = assignment
  const score = mostRecentScore ?? (totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0)
  const when = assignment.completed_at ? formatDate(assignment.completed_at) : null
  const Redo = Icons.clock

  return (
    <article className="card">
      <div className="flex items-center gap-4 px-5 py-4">
        <Ring value={score} size={48} done={score >= 100} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-ink">{assignment.title}</h3>
          <p className="text-sm text-gray-500 tnum">{totalQuestions} question{totalQuestions === 1 ? '' : 's'}, {score}%{when ? `, ${when}` : ''}{hasChildren ? `, ${assignment.children.length} parts` : ''}</p>
        </div>
        {!hasChildren && (
          <div className="flex items-center gap-1.5">
            <Link href={`/student/assignments/${assignment.id}`} className="btn btn-ghost btn-sm">Review</Link>
            <Link href={`/student/assignments/${assignment.id}?retake=true`} className="btn btn-secondary btn-sm" title="Do it again"><Redo className="h-4 w-4" /> Redo</Link>
          </div>
        )}
      </div>
      {hasChildren && (
        <ul className="divide-y divide-line border-t border-line">
          {assignment.children.map(child => (
            <li key={child.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{child.title}</span>
                <span className="block text-xs text-gray-500 tnum">{child.correctQuestions}/{child.totalQuestions} correct</span>
              </span>
              <Link href={`/student/assignments/${child.id}`} className="btn btn-ghost btn-sm">Review</Link>
              <Link href={`/student/assignments/${child.id}?retake=true`} className="btn btn-secondary btn-sm"><Redo className="h-4 w-4" /> Redo</Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
