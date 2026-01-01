'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LatexRenderer } from '@/components/latex-renderer'

interface Question {
  id: string
  prompt_text: string
  prompt_latex?: string
  difficulty: number
  hints_json?: string[]
  solution_steps_json?: Array<string | { step: string; latex?: string; result?: string }>
  correct_answer_json?: Record<string, unknown>
  topics?: { name: string }
}

interface AssignmentItem {
  id: string
  question_id: string
  order_index: number
  points: number
  question: Question
  partNumber?: number
  partTitle?: string
}

interface ChildAssignment {
  id: string
  title: string
  settings_json: Record<string, unknown>
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
  const [isParent, setIsParent] = useState(false)
  const [childAssignments, setChildAssignments] = useState<ChildAssignment[]>([])
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [updating, setUpdating] = useState(false)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const toggleExpanded = (questionId: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  const fetchData = useCallback(async () => {
    try {
      // Fetch assignment
      const response = await fetch(`/api/assignments?id=${assignmentId}`)
      const data = await response.json()
      
      if (data.assignment) {
        setAssignment(data.assignment)
        setIsParent(data.isParent || false)
        setChildAssignments(data.childAssignments || [])
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

  async function handleGeneratePdf() {
    if (items.length === 0) return
    
    setGeneratingPdf(true)
    try {
      const questionIds = items.map(item => item.question_id)
      
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: assignment?.title || 'Assignment',
          questionIds,
          includeAnswers: false,
          includeHints: false,
          assignmentId,
          immediate: true, // Generate immediately for small PDFs
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate PDF')
      }
      
      // Download the PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${assignment?.title || 'assignment'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
              {isParent && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  Parent Assignment
                </span>
              )}
            </div>
            {assignment.description && (
              <p className="text-gray-600 mt-1">{assignment.description}</p>
            )}
            {isParent && childAssignments.length > 0 && (
              <p className="text-sm text-purple-600 mt-1">
                Contains {childAssignments.length} parts with {items.length} total questions
              </p>
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
                  Due: {new Date(assignment.due_at).toLocaleDateString('en-GB')}
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
          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
          >
            {generatingPdf ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                Generate PDF
              </>
            )}
          </button>
        </div>
        {questionAttempts.map(({ item, attempt, totalAttempts }, idx) => {
          const isExpanded = expandedQuestions.has(item.question.id)
          const hints = item.question.hints_json || []
          const solutionSteps = item.question.solution_steps_json || []
          const correctAnswer = item.question.correct_answer_json
          
          // Check if we need to show a part header (for parent assignments)
          const prevItem = idx > 0 ? questionAttempts[idx - 1].item : null
          const showPartHeader = isParent && item.partNumber && 
            (!prevItem || prevItem.partNumber !== item.partNumber)
          
          return (
            <div key={item.id}>
              {/* Part Header for Parent Assignments */}
              {showPartHeader && (
                <div className="bg-purple-50 px-4 py-2 border-b border-purple-100">
                  <span className="text-sm font-medium text-purple-700">
                    Part {item.partNumber}: {item.partTitle || `Section ${item.partNumber}`}
                  </span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                    attempt 
                      ? attempt.is_correct 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
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
                      <button
                        onClick={() => toggleExpanded(item.question.id)}
                        className="ml-auto text-xs text-blue-600 hover:text-blue-800"
                      >
                        {isExpanded ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>
                    
                    {/* Question Text with LaTeX */}
                    <div className="text-gray-800 mb-2">
                      <LatexRenderer content={item.question.prompt_latex || item.question.prompt_text} />
                    </div>
                    
                    {/* Student Attempt Info */}
                    {attempt && (
                      <div className="mt-2 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={attempt.is_correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {attempt.is_correct ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">
                        Answer: <LatexRenderer content={attempt.answer_raw} className="inline" />
                      </span>
                      {attempt.hints_viewed > 0 && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-yellow-600">
                            {attempt.hints_viewed} hint(s) used
                          </span>
                        </>
                      )}
                      {totalAttempts > 1 && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">
                            {totalAttempts} attempts
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Expanded Section */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* Correct Answer */}
                      {correctAnswer && (
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-xs font-medium text-green-800 mb-1">Correct Answer</div>
                          <div className="text-green-900">
                            <LatexRenderer content={
                              typeof correctAnswer === 'object' && 'value' in correctAnswer 
                                ? String(correctAnswer.value) 
                                : JSON.stringify(correctAnswer)
                            } />
                          </div>
                        </div>
                      )}
                      
                      {/* Hints */}
                      {hints.length > 0 && (
                        <div className="bg-yellow-50 p-3 rounded-lg">
                          <div className="text-xs font-medium text-yellow-800 mb-2">Hints ({hints.length})</div>
                          <ol className="space-y-2">
                            {hints.map((hint, hintIdx) => (
                              <li key={hintIdx} className="text-sm text-yellow-900 flex gap-2">
                                <span className="font-medium text-yellow-700">{hintIdx + 1}.</span>
                                <LatexRenderer content={hint} />
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {/* Solution Steps */}
                      {solutionSteps.length > 0 && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-xs font-medium text-blue-800 mb-2">Solution Steps</div>
                          <ol className="space-y-2">
                            {solutionSteps.map((step, stepIdx) => {
                              // Handle both string and object formats
                              const stepText = typeof step === 'string' 
                                ? step 
                                : (step as { step?: string; latex?: string; result?: string })?.step || '';
                              const stepLatex = typeof step === 'object' 
                                ? (step as { latex?: string })?.latex 
                                : undefined;
                              const stepResult = typeof step === 'object' 
                                ? (step as { result?: string })?.result 
                                : undefined;
                              
                              return (
                                <li key={stepIdx} className="text-sm text-blue-900">
                                  <span className="font-medium text-blue-700">{stepIdx + 1}.</span>{' '}
                                  <LatexRenderer content={stepText} />
                                  {stepLatex && (
                                    <span className="ml-2"><LatexRenderer content={stepLatex} /></span>
                                  )}
                                  {stepResult && (
                                    <span className="ml-2 text-blue-600">→ <LatexRenderer content={stepResult} /></span>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      )}
                      
                      {!correctAnswer && hints.length === 0 && solutionSteps.length === 0 && (
                        <div className="text-sm text-gray-500 italic">
                          No hints or solution available for this question.
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
