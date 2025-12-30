import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function StudentsPage() {
  const context = await requireTutor()
  const supabase = await createServerClient()

  const { data: students } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .order('name')

  // Get all student user_ids for batch queries
  const studentUserIds = students?.filter(s => s.user_id).map(s => s.user_id) || []

  // Get attempt stats per student
  const { data: attempts } = studentUserIds.length > 0 
    ? await supabase
        .from('attempts')
        .select('student_user_id, is_correct')
        .eq('workspace_id', context.workspaceId)
        .in('student_user_id', studentUserIds)
    : { data: [] }

  // Get assignment completion per student
  const { data: assignmentAttempts } = studentUserIds.length > 0
    ? await supabase
        .from('assignment_attempts')
        .select('student_user_id, status')
        .eq('workspace_id', context.workspaceId)
        .in('student_user_id', studentUserIds)
    : { data: [] }

  // Calculate stats per student
  const studentStats = new Map<string, { correct: number; total: number; completed: number; assigned: number }>()
  
  attempts?.forEach(attempt => {
    const existing = studentStats.get(attempt.student_user_id) || { correct: 0, total: 0, completed: 0, assigned: 0 }
    existing.total++
    if (attempt.is_correct) existing.correct++
    studentStats.set(attempt.student_user_id, existing)
  })

  assignmentAttempts?.forEach(aa => {
    const existing = studentStats.get(aa.student_user_id) || { correct: 0, total: 0, completed: 0, assigned: 0 }
    existing.assigned++
    if (aa.status === 'completed') existing.completed++
    studentStats.set(aa.student_user_id, existing)
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
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Grade
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
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {students.map((student) => {
                const stats = student.user_id ? studentStats.get(student.user_id) : null
                const accuracy = stats && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null
                
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
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
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {student.grade_current ? `Grade ${student.grade_current}` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      {accuracy !== null ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          accuracy >= 70 ? 'bg-green-100 text-green-800' : 
                          accuracy >= 50 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {accuracy}%
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-500">
                      {stats && stats.assigned > 0 ? (
                        <span>{stats.completed}/{stats.assigned}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {student.user_id ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          Pending
                        </span>
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
