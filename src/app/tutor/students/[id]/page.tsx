import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const context = await requireTutor()
  const supabase = await createServerClient()

  // Get student profile
  const { data: student } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', context.workspaceId)
    .single()

  if (!student) {
    notFound()
  }

  // Get recent attempts
  const { data: attempts } = await supabase
    .from('attempts')
    .select('*, questions(prompt_text, topic_id, topics(name))')
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
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Students
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{student.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {student.grade_current && `Grade ${student.grade_current}`}
            {student.grade_current && student.school && ' • '}
            {student.school}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/tutor/students/${id}/edit`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>
          <Link
            href={`/tutor/assignments/new?student=${id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Create Assignment
          </Link>
        </div>
      </div>

      {/* Status Banner */}
      {!student.user_id && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Pending Invite</h3>
              <p className="mt-1 text-sm text-yellow-700">
                This student hasn&apos;t joined yet. They need to sign up using their invite link.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Total Attempts</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{totalAttempts}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Accuracy</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{accuracy}%</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Items Due</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{dueItems}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">In Rotation</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{srStats?.length || 0}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Topic Breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white">
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
                      <div className="mt-2 h-2 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
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
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Private Notes</h2>
            <p className="text-xs text-gray-500">Only visible to you</p>
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
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Recent Attempts</h2>
        </div>
        {attempts && attempts.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="flex items-center gap-4 px-6 py-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
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
                  <div className="truncate text-sm font-medium text-gray-900">
                    {attempt.questions?.prompt_text?.slice(0, 80)}...
                  </div>
                  <div className="text-sm text-gray-500">
                    {attempt.questions?.topics?.name || 'Uncategorized'} • {format(new Date(attempt.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Answer: {attempt.answer_raw || '-'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-500">
            No attempts recorded yet
          </div>
        )}
      </div>
    </div>
  )
}
