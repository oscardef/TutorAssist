import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const context = await requireTutor()
  const supabase = await createServerClient()

  // Get student profile with program and grade info
  const { data: student } = await supabase
    .from('student_profiles')
    .select(`
      *,
      study_programs (
        id,
        code,
        name,
        color
      ),
      grade_levels (
        id,
        code,
        name,
        year_number
      )
    `)
    .eq('id', id)
    .eq('workspace_id', context.workspaceId)
    .single()

  if (!student) {
    notFound()
  }

  // Get assigned tutor info if set
  let assignedTutor = null
  if (student.assigned_tutor_id) {
    const { data: tutorProfile } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .eq('user_id', student.assigned_tutor_id)
      .single()
    assignedTutor = tutorProfile
  }

  // Get student's assignments with progress
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      id,
      title,
      due_date,
      created_at,
      assignment_questions (
        id,
        question_id
      )
    `)
    .eq('workspace_id', context.workspaceId)
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  // Get assignment attempts to calculate progress
  const assignmentIds = assignments?.map(a => a.id) || []
  const { data: assignmentAttempts } = await supabase
    .from('assignment_attempts')
    .select('assignment_id, assignment_question_id, is_correct, answer_raw, created_at')
    .in('assignment_id', assignmentIds.length > 0 ? assignmentIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('student_user_id', student.user_id || '')
    .order('created_at', { ascending: false })

  // Build assignment progress data
  const assignmentProgress = assignments?.map(assignment => {
    const totalQuestions = assignment.assignment_questions?.length || 0
    const attempts = assignmentAttempts?.filter(a => a.assignment_id === assignment.id) || []
    const completedQuestionIds = new Set(attempts.map(a => a.assignment_question_id))
    const correctQuestionIds = new Set(
      attempts.filter(a => a.is_correct).map(a => a.assignment_question_id)
    )
    const completedCount = completedQuestionIds.size
    const correctCount = correctQuestionIds.size

    return {
      ...assignment,
      totalQuestions,
      completedCount,
      correctCount,
      isComplete: completedCount >= totalQuestions && totalQuestions > 0,
      accuracy: completedCount > 0 ? Math.round((correctCount / completedCount) * 100) : 0,
      lastAttempt: attempts[0]?.created_at,
    }
  }) || []

  // Get recent attempts (not from assignments)
  const { data: attempts } = await supabase
    .from('attempts')
    .select('*, questions(prompt_text, topic_id, topics(name), correct_answer)')
    .eq('workspace_id', context.workspaceId)
    .eq('student_user_id', student.user_id || '')
    .order('created_at', { ascending: false })
    .limit(20)

  // Get spaced repetition stats
  const { data: srStats } = await supabase
    .from('spaced_repetition')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .eq('student_user_id', student.user_id || '')

  // Calculate stats
  const totalAttempts = attempts?.length || 0
  const correctAttempts = attempts?.filter(a => a.is_correct).length || 0
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

  // Get topic breakdown
  const topicStats: Record<string, { total: number; correct: number }> = {}
  attempts?.forEach(attempt => {
    const topicName = attempt.questions?.topics?.name || 'Uncategorized'
    if (!topicStats[topicName]) {
      topicStats[topicName] = { total: 0, correct: 0 }
    }
    topicStats[topicName].total++
    if (attempt.is_correct) {
      topicStats[topicName].correct++
    }
  })

  // Get upcoming items due
  const dueItems = srStats?.filter(sr => new Date(sr.next_due) <= new Date()).length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/tutor/students"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Students
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{student.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {student.study_programs && (
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: student.study_programs.color ? `${student.study_programs.color}20` : '#e5e7eb',
                  color: student.study_programs.color || '#374151'
                }}
              >
                {student.study_programs.name}
              </span>
            )}
            {student.grade_levels && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {student.grade_levels.name}
              </span>
            )}
            {student.school && (
              <span className="text-gray-500">• {student.school}</span>
            )}
            {student.age && (
              <span className="text-gray-500">• Age {student.age}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/tutor/students/${id}/edit`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <Link
            href={`/tutor/assignments/new?student=${id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Create Assignment
          </Link>
        </div>
      </div>

      {/* Assigned Tutor Banner */}
      {assignedTutor && (
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
              {assignedTutor.name?.charAt(0).toUpperCase() || 'T'}
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Assigned Tutor</p>
              <p className="text-sm font-semibold text-gray-900">{assignedTutor.name}</p>
              <p className="text-xs text-gray-500">{assignedTutor.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {!student.user_id && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-amber-800">Pending Invite</h3>
              <p className="mt-1 text-sm text-amber-700">
                This student hasn&apos;t joined yet. They need to sign up using their invite link.
              </p>
            </div>
            <Link
              href={`/tutor/students/${id}/edit`}
              className="ml-4 shrink-0 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors"
            >
              Resend Invite
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Total Attempts</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{totalAttempts}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Accuracy</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{accuracy}%</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Items Due</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{dueItems}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-500">Assignments</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{assignmentProgress.length}</div>
        </div>
      </div>

      {/* Assignments Progress */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Assignments</h2>
            <p className="text-xs text-gray-500 mt-0.5">Track student progress on assigned work</p>
          </div>
          <Link
            href={`/tutor/assignments/new?student=${id}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            + New Assignment
          </Link>
        </div>
        {assignmentProgress.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {assignmentProgress.map((assignment) => {
              const progressPercent = assignment.totalQuestions > 0 
                ? Math.round((assignment.completedCount / assignment.totalQuestions) * 100) 
                : 0
              const isDue = assignment.due_date && new Date(assignment.due_date) < new Date()
              
              return (
                <div key={assignment.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={`/tutor/assignments/${assignment.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {assignment.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span>{assignment.totalQuestions} questions</span>
                        {assignment.due_date && (
                          <span className={isDue && !assignment.isComplete ? 'text-red-600 font-medium' : ''}>
                            Due {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                        {assignment.lastAttempt && (
                          <span>
                            Last activity {formatDistanceToNow(new Date(assignment.lastAttempt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-4">
                      {assignment.isComplete ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Complete
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-gray-700">
                          {assignment.completedCount}/{assignment.totalQuestions}
                        </span>
                      )}
                      {assignment.completedCount > 0 && (
                        <span className={`text-sm font-semibold ${
                          assignment.accuracy >= 70 ? 'text-green-600' : 
                          assignment.accuracy >= 40 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {assignment.accuracy}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        assignment.isComplete ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">No assignments yet</p>
            <Link
              href={`/tutor/assignments/new?student=${id}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create first assignment
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Topic Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Performance by Topic</h2>
          </div>
          <div className="p-6">
            {Object.keys(topicStats).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(topicStats).map(([topic, stats]) => {
                  const pct = Math.round((stats.correct / stats.total) * 100)
                  return (
                    <div key={topic}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">{topic}</span>
                        <span className="text-gray-500">{pct}% ({stats.correct}/{stats.total})</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No attempts yet</p>
            )}
          </div>
        </div>

        {/* Private Notes */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Private Notes</h2>
                <p className="text-xs text-gray-500">Only visible to tutors</p>
              </div>
              <Link
                href={`/tutor/students/${id}/edit`}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Edit
              </Link>
            </div>
          </div>
          <div className="p-6">
            {student.private_notes ? (
              <p className="whitespace-pre-wrap text-sm text-gray-700">{student.private_notes}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">No notes yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Attempts */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recent Practice Attempts</h2>
          <p className="text-xs text-gray-500 mt-0.5">Review what the student got right and wrong</p>
        </div>
        {attempts && attempts.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
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
                    <div className="text-sm font-medium text-gray-900 line-clamp-2">
                      {attempt.questions?.prompt_text}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {attempt.questions?.topics?.name || 'Uncategorized'} • {format(new Date(attempt.created_at), 'MMM d, h:mm a')}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Student answered:</span>
                        <span className={`font-medium ${attempt.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                          {attempt.answer_raw || '-'}
                        </span>
                      </div>
                      {!attempt.is_correct && attempt.questions?.correct_answer && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">Correct:</span>
                          <span className="font-medium text-green-700">{attempt.questions.correct_answer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">No practice attempts recorded yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
