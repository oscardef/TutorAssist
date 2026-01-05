import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}

export default async function StudentsPage() {
  const context = await requireTutor()
  const supabase = await createServerClient()

  const { data: students, error: studentsError } = await supabase
    .from('student_profiles')
    .select(`
      *,
      study_programs!student_profiles_study_program_id_fkey (
        id,
        code,
        name,
        color
      ),
      grade_levels!student_profiles_grade_level_id_fkey (
        id,
        code,
        name
      )
    `)
    .eq('workspace_id', context.workspaceId)
    .order('name')
  
  if (studentsError) {
    console.error('Error loading students:', studentsError)
  }

  // Get tutor assignments - profiles table doesn't exist so we get names from workspace_members
  // For now we'll use a simple fallback since tutor names aren't stored separately
  const tutorIds = students?.filter(s => s.assigned_tutor_id).map(s => s.assigned_tutor_id) || []
  const { data: tutorMembers } = tutorIds.length > 0 
    ? await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', context.workspaceId)
        .in('user_id', tutorIds)
    : { data: [] }
  
  // Build a map of tutor info - names would need to come from a separate source
  const tutorMap = new Map<string, { user_id: string; name: string; email: string }>()
  tutorMembers?.forEach(t => {
    tutorMap.set(t.user_id, { user_id: t.user_id, name: 'Tutor', email: '' })
  })

  // Get all student user_ids for batch queries
  const studentUserIds = students?.filter(s => s.user_id).map(s => s.user_id) || []

  // Get attempt stats per student (includes both practice and assignment attempts)
  const { data: attempts } = studentUserIds.length > 0 
    ? await supabase
        .from('attempts')
        .select('student_user_id, is_correct, assignment_id, submitted_at')
        .eq('workspace_id', context.workspaceId)
        .in('student_user_id', studentUserIds)
    : { data: [] }

  // Get assignments assigned to students
  const { data: assignments } = studentUserIds.length > 0
    ? await supabase
        .from('assignments')
        .select('id, assigned_student_user_id, status')
        .eq('workspace_id', context.workspaceId)
        .in('assigned_student_user_id', studentUserIds)
    : { data: [] }

  // Calculate stats per student
  const studentStats = new Map<string, { correct: number; total: number; completed: number; assigned: number; lastActivity: string | null }>()
  
  // Process attempts for accuracy stats and last activity
  attempts?.forEach(attempt => {
    const existing = studentStats.get(attempt.student_user_id) || { correct: 0, total: 0, completed: 0, assigned: 0, lastActivity: null }
    existing.total++
    if (attempt.is_correct) existing.correct++
    // Track most recent activity
    if (attempt.submitted_at && (!existing.lastActivity || attempt.submitted_at > existing.lastActivity)) {
      existing.lastActivity = attempt.submitted_at
    }
    studentStats.set(attempt.student_user_id, existing)
  })

  // Process assignments for completion stats
  assignments?.forEach(assignment => {
    if (!assignment.assigned_student_user_id) return
    const existing = studentStats.get(assignment.assigned_student_user_id) || { correct: 0, total: 0, completed: 0, assigned: 0, lastActivity: null }
    existing.assigned++
    if (assignment.status === 'completed') existing.completed++
    studentStats.set(assignment.assigned_student_user_id, existing)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your students and track their progress
          </p>
        </div>
        <Link
          href="/tutor/students/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          Add Student
        </Link>
      </div>

      {students && students.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Program / Grade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Assigned Tutor
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Accuracy
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Assignments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Last Activity
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {students.map((student) => {
                const stats = student.user_id ? studentStats.get(student.user_id) : null
                const accuracy = stats && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null
                const studyProgram = student.study_programs as { id: string; code: string; name: string; color: string | null } | null
                const gradeLevel = student.grade_levels as { id: string; code: string; name: string } | null
                const assignedTutor = student.assigned_tutor_id ? tutorMap.get(student.assigned_tutor_id) : null
                
                return (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/tutor/students/${student.id}`} className="flex items-center group">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <span className="text-sm font-medium text-blue-600">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900 group-hover:text-blue-600">{student.name}</div>
                          {student.school && (
                            <div className="text-sm text-gray-500">{student.school}</div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {studyProgram ? (
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: studyProgram.color ? `${studyProgram.color}20` : '#e5e7eb',
                              color: studyProgram.color || '#374151'
                            }}
                          >
                            {studyProgram.code}
                          </span>
                        ) : null}
                        {gradeLevel ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {gradeLevel.code}
                          </span>
                        ) : null}
                        {!studyProgram && !gradeLevel && (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {assignedTutor ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                            {assignedTutor.name?.charAt(0).toUpperCase() || 'T'}
                          </div>
                          <span className="text-gray-700">{assignedTutor.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      {accuracy !== null ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          accuracy >= 70 ? 'bg-green-100 text-green-800' : 
                          accuracy >= 50 ? 'bg-amber-100 text-amber-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {accuracy}%
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500">
                      {stats && stats.assigned > 0 ? (
                        <span>{stats.completed}/{stats.assigned}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {student.user_id ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {stats?.lastActivity ? (
                        <span title={new Date(stats.lastActivity).toLocaleString()}>
                          {formatRelativeTime(stats.lastActivity)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <Link
                        href={`/tutor/students/${student.id}`}
                        className="text-blue-600 hover:text-blue-500"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
              d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No students</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first student.
          </p>
          <div className="mt-6">
            <Link
              href="/tutor/students/new"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              <svg className="-ml-0.5 mr-1.5 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Student
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
