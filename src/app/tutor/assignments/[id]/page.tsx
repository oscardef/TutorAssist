'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id: string
  prompt_text: string
  difficulty: number
  topics?: { name: string }
}

interface AssignmentItem {
  id: string
  question_id: string
  order_index: number
  points: number
  question: Question
}

interface Attempt {
  id: string
  question_id: string
  student_user_id: string
  is_correct: boolean
  answer_raw: string
  time_spent_seconds?: number
  hints_viewed: number
  submitted_at: string
}

interface Assignment {
  id: string
  title: string
  description?: string
  status: string
  due_at?: string
  created_at: string
  student_profiles?: { id: string; name: string; user_id: string }
  settings_json: Record<string, unknown>
}

export default function TutorAssignmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const assignmentId = params.id as string

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [updating, setUpdating] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // Fetch assignment
      const response = await fetch(`/api/assignments?id=${assignmentId}`)
      const data = await response.json()
      
      if (data.assignment) {
        setAssignment(data.assignment)
        const sortedItems = (data.assignment.assignment_items || [])
          .sort((a: AssignmentItem, b: AssignmentItem) => a.order_index - b.order_index)
        setItems(sortedItems)

        // Fetch attempts for this assignment
        if (data.assignment.student_profiles?.user_id) {
          const attemptsRes = await fetch(`/api/attempts?assignmentId=${assignmentId}`)
          const attemptsData = await attemptsRes.json()
          setAttempts(attemptsData.attempts || [])
        }
      }
    } catch (err) {
      console.error('Failed to load assignment:', err)
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assignmentId, status: newStatus }),
      })
      setAssignment(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setUpdating(false)
    }
  }

  async function deleteAssignment() {
    if (!confirm('Are you sure you want to delete this assignment?')) return
    
    try {
      await fetch(`/api/assignments?id=${assignmentId}`, { method: 'DELETE' })
      router.push('/tutor/assignments')
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  // Calculate stats
  const questionAttempts = items.map(item => {
    const itemAttempts = attempts.filter(a => a.question_id === item.question_id)
    const latestAttempt = itemAttempts.sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    )[0]
    return {
      item,
      attempt: latestAttempt,
      totalAttempts: itemAttempts.length,
    }
  })

  const answeredCount = questionAttempts.filter(q => q.attempt).length
  const correctCount = questionAttempts.filter(q => q.attempt?.is_correct).length
  const totalTimeSpent = attempts.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0)
  const hintsUsed = attempts.reduce((sum, a) => sum + (a.hints_viewed || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Assignment not found.</p>
        <Link href="/tutor/assignments" className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Assignments
        </Link>
      </div>
    )
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/tutor/assignments" className="text-gray-600 hover:text-gray-900 text-sm">
          ← Back to Assignments
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            {assignment.description && (
              <p className="text-gray-600 mt-1">{assignment.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[assignment.status as keyof typeof statusColors]}`}>
                {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
              </span>
              {assignment.student_profiles ? (
                <span className="text-sm text-gray-600">
                  Assigned to: {assignment.student_profiles.name}
                </span>
              ) : (
                <span className="text-sm text-gray-500">All students</span>
              )}
              {assignment.due_at && (
                <span className="text-sm text-gray-500">
                  Due: {new Date(assignment.due_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {assignment.status === 'draft' && (
              <button
                onClick={() => updateStatus('active')}
                disabled={updating}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Activate
              </button>
            )}
            {assignment.status === 'active' && (
              <button
                onClick={() => updateStatus('completed')}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Mark Complete
              </button>
            )}
            <button
              onClick={deleteAssignment}
              className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      {assignment.student_profiles && (
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-500">Questions</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {answeredCount}/{items.length}
            </div>
            <div className="text-xs text-gray-500">answered</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-500">Correct</div>
            <div className="mt-1 text-2xl font-semibold text-green-600">
              {correctCount}/{answeredCount || 1}
            </div>
            <div className="text-xs text-gray-500">
              {answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}% accuracy
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-500">Time Spent</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {Math.round(totalTimeSpent / 60)}
            </div>
            <div className="text-xs text-gray-500">minutes</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-500">Hints Used</div>
            <div className="mt-1 text-2xl font-semibold text-yellow-600">{hintsUsed}</div>
            <div className="text-xs text-gray-500">total hints</div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {assignment.student_profiles && answeredCount > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-600">
              {Math.round((answeredCount / items.length) * 100)}% complete
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
              style={{ width: `${(answeredCount / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        <div className="p-4 bg-gray-50 flex justify-between items-center">
          <h3 className="font-medium text-gray-900">Questions ({items.length})</h3>
          <Link
            href={`/api/pdf?assignmentId=${assignmentId}`}
            target="_blank"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Generate PDF
          </Link>
        </div>
        {questionAttempts.map(({ item, attempt, totalAttempts }, idx) => (
          <div key={item.id} className="p-4">
            <div className="flex items-start gap-4">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                attempt 
                  ? attempt.is_correct 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {item.question.topics?.name && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                      {item.question.topics.name}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.question.difficulty <= 2 ? 'bg-green-100 text-green-700' :
                    item.question.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.question.difficulty <= 2 ? 'Easy' : 
                     item.question.difficulty <= 3 ? 'Medium' : 'Hard'}
                  </span>
                </div>
                <p className="text-gray-800 line-clamp-2">{item.question.prompt_text}</p>
                {attempt && (
                  <div className="mt-2 text-sm">
                    <span className={attempt.is_correct ? 'text-green-600' : 'text-red-600'}>
                      {attempt.is_correct ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                    <span className="text-gray-400 mx-2">•</span>
                    <span className="text-gray-500">
                      Answer: &quot;{attempt.answer_raw}&quot;
                    </span>
                    {attempt.hints_viewed > 0 && (
                      <>
                        <span className="text-gray-400 mx-2">•</span>
                        <span className="text-yellow-600">
                          {attempt.hints_viewed} hint(s) used
                        </span>
                      </>
                    )}
                    {totalAttempts > 1 && (
                      <>
                        <span className="text-gray-400 mx-2">•</span>
                        <span className="text-gray-500">
                          {totalAttempts} attempts
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
