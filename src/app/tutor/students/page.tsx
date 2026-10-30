import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { getUsersByIds } from '@/lib/users'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { formatDate } from '@/lib/dates'

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
  return formatDate(date)
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

  // Get tutor assignments - use admin client to get actual tutor names
  const tutorIds = students?.filter(s => s.assigned_tutor_id).map(s => s.assigned_tutor_id) || []
  const uniqueTutorIds = [...new Set(tutorIds)]
  
  const { data: tutorMembers } = uniqueTutorIds.length > 0 
    ? await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', context.workspaceId)
        .in('user_id', uniqueTutorIds)
    : { data: [] }
  
  // Build a map of tutor info using admin client to get actual names
  const tutorMap = new Map<string, { user_id: string; name: string; email: string }>()
  
  if (tutorMembers && tutorMembers.length > 0) {
    const tutorUsers = await getUsersByIds(tutorMembers.map(m => m.user_id))

    for (const tutorMember of tutorMembers) {
      const tutorUser = tutorUsers.get(tutorMember.user_id)

      if (tutorUser) {
        tutorMap.set(tutorMember.user_id, {
          user_id: tutorMember.user_id,
          name: tutorUser.name || tutorUser.email.split('@')[0] || 'Tutor',
          email: tutorUser.email
        })
      }
    }
  }

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

  const Plus = Icons.plus
  const Arrow = Icons.arrowRight
  const active = students?.filter(s => s.user_id).length || 0
  const pending = (students?.length || 0) - active

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle tnum">{students?.length || 0} student{students?.length === 1 ? '' : 's'}{pending > 0 ? ` · ${pending} not signed up yet` : ''}</p>
        </div>
        <Link href="/tutor/students/new" className="btn btn-primary"><Plus className="h-4 w-4" /> Add student</Link>
      </div>

      {students && students.length > 0 ? (
        <ul className="card divide-y divide-line">
          {students.map(student => {
            const stats = student.user_id ? studentStats.get(student.user_id) : null
            const accuracy = stats && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null
            const studyProgram = student.study_programs as { id: string; code: string; name: string; color: string | null } | null
            const gradeLevel = student.grade_levels as { id: string; code: string; name: string } | null
            const assignedTutor = student.assigned_tutor_id ? tutorMap.get(student.assigned_tutor_id) : null
            return (
              <li key={student.id}>
                <Link href={`/tutor/students/${student.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-paper sm:grid-cols-[auto_1.4fr_1fr_1fr_auto]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-spark-100 text-base font-extrabold text-spark-700">{student.name.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{student.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      {student.school && <span className="truncate">{student.school}</span>}
                      {studyProgram && <span className="chip chip-brand px-2 py-0 text-[11px]">{studyProgram.code}</span>}
                      {gradeLevel && <span className="chip px-2 py-0 text-[11px]">{gradeLevel.code}</span>}
                      {!student.user_id && <span className="chip chip-spark px-2 py-0 text-[11px]">Invite pending</span>}
                    </span>
                  </span>
                  <span className="hidden min-w-0 text-sm text-gray-600 sm:block">
                    {assignedTutor ? <span className="truncate">{assignedTutor.name}</span> : <span className="text-gray-400">No tutor assigned</span>}
                    <span className="block text-xs text-gray-400 tnum">{stats?.lastActivity ? `Active ${formatRelativeTime(stats.lastActivity)}` : 'No activity yet'}</span>
                  </span>
                  <span className="hidden items-center gap-3 text-sm sm:flex">
                    {accuracy !== null ? <span className={`chip tnum ${accuracy >= 70 ? 'chip-good' : accuracy >= 50 ? 'chip-spark' : 'chip-bad'}`}>{accuracy}%</span> : <span className="chip text-gray-500">No answers</span>}
                    {stats && stats.assigned > 0 && <span className="text-gray-500 tnum" title="Assignments completed">{stats.completed}/{stats.assigned}</span>}
                  </span>
                  <Arrow className="h-5 w-5 text-gray-300" />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="card px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Icons.students className="h-6 w-6" /></div>
          <p className="mt-4 font-bold text-ink">No students yet</p>
          <p className="mt-1 text-sm text-gray-500">Add a student and send them an invite link.</p>
          <Link href="/tutor/students/new" className="btn btn-primary mt-5"><Plus className="h-4 w-4" /> Add your first student</Link>
        </div>
      )}
    </div>
  )
}
