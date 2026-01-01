import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

interface Assignment {
  id: string
  title: string
  description: string | null
  status: string
  due_at: string | null
  created_at: string
  parent_assignment_id: string | null
  settings_json: {
    isParent?: boolean
    partNumber?: number
    totalParts?: number
  } | null
  student_profiles: { id: string; name: string } | null
  assignment_items: { id: string }[] | null
}

interface AssignmentWithChildren extends Assignment {
  children: Assignment[]
}

interface StudentGroup {
  student: { id: string; name: string } | null
  assignments: AssignmentWithChildren[]
}

export default async function AssignmentsPage() {
  const context = await requireTutor()
  const supabase = await createServerClient()

  // Get assignments with student info
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      *,
      student_profiles(id, name),
      assignment_items(id)
    `)
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })

  // Get students for assignment creation
  const { data: students } = await supabase
    .from('student_profiles')
    .select('id, name')
    .eq('workspace_id', context.workspaceId)
    .order('name')

  // Get questions count
  const { count: questionCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', context.workspaceId)
    .eq('status', 'active')

  // Group assignments by student, nesting children under parents
  const groupByStudent = (assignmentList: Assignment[]): StudentGroup[] => {
    const groups = new Map<string, StudentGroup>()
    
    // First pass: identify parent and standalone assignments
    const parentMap = new Map<string, AssignmentWithChildren>()
    const childAssignments: Assignment[] = []
    
    for (const assignment of assignmentList) {
      if (assignment.parent_assignment_id) {
        childAssignments.push(assignment)
      } else {
        parentMap.set(assignment.id, { ...assignment, children: [] })
      }
    }
    
    // Second pass: attach children to parents
    for (const child of childAssignments) {
      const parent = parentMap.get(child.parent_assignment_id!)
      if (parent) {
        parent.children.push(child)
      } else {
        // Orphan child - treat as standalone
        parentMap.set(child.id, { ...child, children: [] })
      }
    }
    
    // Sort children by part number
    for (const parent of parentMap.values()) {
      parent.children.sort((a, b) => {
        const partA = a.settings_json?.partNumber || 0
        const partB = b.settings_json?.partNumber || 0
        return partA - partB
      })
    }
    
    // Group by student
    for (const assignment of parentMap.values()) {
      const studentId = assignment.student_profiles?.id || 'unassigned'
      
      if (!groups.has(studentId)) {
        groups.set(studentId, {
          student: assignment.student_profiles || null,
          assignments: []
        })
      }
      groups.get(studentId)!.assignments.push(assignment)
    }
    
    // Sort by student name, with unassigned at the end
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.student) return 1
      if (!b.student) return -1
      return a.student.name.localeCompare(b.student.name)
    })
  }

  // Filter out child assignments from the main count since they're grouped
  const allAssignments = assignments as Assignment[] || []
  const topLevelActive = allAssignments.filter(a => a.status === 'active' && !a.parent_assignment_id)
  const topLevelDraft = allAssignments.filter(a => a.status === 'draft' && !a.parent_assignment_id)
  const topLevelCompleted = allAssignments.filter(a => a.status === 'completed' && !a.parent_assignment_id)
  
  const activeAssignments = allAssignments.filter(a => a.status === 'active')
  const draftAssignments = allAssignments.filter(a => a.status === 'draft' && !a.parent_assignment_id)
  const completedAssignments = allAssignments.filter(a => a.status === 'completed')

  const activeByStudent = groupByStudent(activeAssignments)
  const completedByStudent = groupByStudent(completedAssignments)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage practice assignments for your students
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/tutor/assignments/new"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Manual Create
          </Link>
          <Link
            href="/tutor/assignments/ai"
            className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-purple-700 hover:to-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            AI Generate
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-500">Students</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{students?.length || 0}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-500">Active</div>
          <div className="mt-1 text-2xl font-semibold text-green-600">{topLevelActive.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-500">Drafts</div>
          <div className="mt-1 text-2xl font-semibold text-gray-600">{topLevelDraft.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-500">Completed</div>
          <div className="mt-1 text-2xl font-semibold text-blue-600">{topLevelCompleted.length}</div>
        </div>
      </div>

      {/* Assignments List */}
      {assignments && assignments.length > 0 ? (
        <div className="space-y-8">
          {/* Active Assignments - Grouped by Student */}
          {activeByStudent.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Active Assignments
              </h2>
              <div className="space-y-6">
                {activeByStudent.map((group) => (
                  <StudentAssignmentGroup 
                    key={group.student?.id || 'unassigned'} 
                    group={group} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Draft Assignments */}
          {draftAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                Drafts
              </h2>
              <div className="space-y-3">
                {draftAssignments.map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment as Assignment} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Assignments - Grouped by Student */}
          {completedByStudent.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Completed
              </h2>
              <div className="space-y-6">
                {completedByStudent.map((group) => (
                  <StudentAssignmentGroup 
                    key={group.student?.id || 'unassigned'} 
                    group={group}
                    collapsed 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No assignments yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            {questionCount && questionCount > 0
              ? 'Create an assignment to assign questions to your students.'
              : 'Add some questions first, then create assignments.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {questionCount && questionCount > 0 ? (
              <Link
                href="/tutor/assignments/new"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Create Assignment
              </Link>
            ) : (
              <>
                <Link
                  href="/tutor/questions/new"
                  className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Add Questions
                </Link>
                <Link
                  href="/tutor/generate"
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                  Generate with AI
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentAssignmentGroup({ group, collapsed = false }: { group: StudentGroup; collapsed?: boolean }) {
  const studentName = group.student?.name || 'Unassigned'
  const initials = studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Student Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
        <div className="flex-1">
          <span className="font-medium text-gray-900">{studentName}</span>
          <span className="text-sm text-gray-500 ml-2">
            ({group.assignments.length} assignment{group.assignments.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>
      
      {/* Assignments */}
      <div className={`divide-y divide-gray-100 ${collapsed ? 'max-h-60 overflow-auto' : ''}`}>
        {group.assignments.map((assignment) => (
          <AssignmentRow key={assignment.id} assignment={assignment} />
        ))}
      </div>
    </div>
  )
}

function AssignmentRow({ assignment }: { assignment: AssignmentWithChildren }) {
  const hasChildren = assignment.children && assignment.children.length > 0
  const totalQuestions = hasChildren 
    ? assignment.children.reduce((sum, c) => sum + (c.assignment_items?.length || 0), 0)
    : (assignment.assignment_items?.length || 0)

  if (hasChildren) {
    return (
      <div className="group">
        <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate flex items-center gap-2">
              {assignment.title}
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                {assignment.children.length} parts
              </span>
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-3">
              <span>{totalQuestions} questions total</span>
              {assignment.due_at && (
                <>
                  <span>•</span>
                  <span>Due {format(new Date(assignment.due_at), 'MMM d')}</span>
                </>
              )}
            </div>
          </div>
          <Link
            href={`/tutor/assignments/${assignment.id}`}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Overview
          </Link>
        </div>
        <div className="border-t border-gray-100 bg-gray-50/50">
          {assignment.children.map((child, idx) => (
            <Link
              key={child.id}
              href={`/tutor/assignments/${child.id}`}
              className="flex items-center gap-4 px-4 py-2.5 pl-12 hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">{child.title}</div>
                <div className="text-xs text-gray-500">
                  {child.assignment_items?.length || 0} questions
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Link
      href={`/tutor/assignments/${assignment.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{assignment.title}</div>
        <div className="text-sm text-gray-500 flex items-center gap-3">
          <span>{assignment.assignment_items?.length || 0} questions</span>
          {assignment.due_at && (
            <>
              <span>•</span>
              <span>Due {format(new Date(assignment.due_at), 'MMM d')}</span>
            </>
          )}
        </div>
      </div>
      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  )
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
  }

  const status = assignment.status as keyof typeof statusColors
  const studentProfile = assignment.student_profiles
  const items = assignment.assignment_items

  return (
    <Link
      href={`/tutor/assignments/${assignment.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{assignment.title}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status]}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span>{studentProfile?.name || 'All students'}</span>
            <span>•</span>
            <span>{items?.length || 0} questions</span>
            {assignment.due_at && (
              <>
                <span>•</span>
                <span>Due {format(new Date(assignment.due_at), 'MMM d, yyyy')}</span>
              </>
            )}
          </div>
        </div>
        <svg className="h-5 w-5 text-gray-400 ml-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  )
}
