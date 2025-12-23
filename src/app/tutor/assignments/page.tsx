import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

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

  const activeAssignments = assignments?.filter(a => a.status === 'active') || []
  const draftAssignments = assignments?.filter(a => a.status === 'draft') || []
  const completedAssignments = assignments?.filter(a => a.status === 'completed') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage practice assignments for your students
          </p>
        </div>
        <Link
          href="/tutor/assignments/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          Create Assignment
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-500">Active</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{activeAssignments.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-500">Draft</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{draftAssignments.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-500">Completed</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{completedAssignments.length}</div>
        </div>
      </div>

      {/* Assignments List */}
      {assignments && assignments.length > 0 ? (
        <div className="space-y-6">
          {/* Active Assignments */}
          {activeAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Assignments</h2>
              <div className="space-y-3">
                {activeAssignments.map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment} />
                ))}
              </div>
            </div>
          )}

          {/* Draft Assignments */}
          {draftAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Drafts</h2>
              <div className="space-y-3">
                {draftAssignments.map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Assignments */}
          {completedAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Completed</h2>
              <div className="space-y-3">
                {completedAssignments.map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
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

function AssignmentCard({ assignment }: { assignment: Record<string, unknown> }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
  }

  const status = assignment.status as keyof typeof statusColors
  const studentProfile = assignment.student_profiles as { name: string } | null
  const items = assignment.assignment_items as { id: string }[] | null

  return (
    <Link
      href={`/tutor/assignments/${assignment.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{String(assignment.title)}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status]}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span>
              {studentProfile?.name || 'All students'}
            </span>
            <span>•</span>
            <span>{items?.length || 0} questions</span>
            {assignment.due_at ? (
              <>
                <span>•</span>
                <span>Due {format(new Date(String(assignment.due_at)), 'MMM d, yyyy')}</span>
              </>
            ) : null}
          </div>
          {assignment.description ? (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{String(assignment.description)}</p>
          ) : null}
        </div>
        <svg className="h-5 w-5 text-gray-400 ml-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  )
}
