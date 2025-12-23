'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Student {
  id: string
  name: string
  email?: string
}

interface Question {
  id: string
  promptText: string
  promptLatex?: string
  difficulty: number
  topicName: string
  answerType: string
  correctAnswer: unknown
  hints?: string[]
  solutionSteps?: unknown[]
  isGenerated?: boolean
}

interface GeneratedAssignment {
  title: string
  description: string
  questions: Question[]
  suggestedDueDate: string
  estimatedMinutes: number
  topicsCovered: string[]
  difficultyBreakdown: { easy: number; medium: number; hard: number }
}

interface StudentHistory {
  totalAttempts: number
  overallAccuracy: number
  topicsStruggled: { topicId: string; topicName: string; errorRate: number }[]
}

export default function AIAssignmentPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [refining, setRefining] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedStudent, setSelectedStudent] = useState('')
  const [prompt, setPrompt] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive'>('adaptive')
  const [includeMarkscheme, setIncludeMarkscheme] = useState(true)
  const [includeSolutionSteps, setIncludeSolutionSteps] = useState(true)
  const [focusOnWeakAreas, setFocusOnWeakAreas] = useState(false)

  // Generated assignment state
  const [assignment, setAssignment] = useState<GeneratedAssignment | null>(null)
  const [studentHistory, setStudentHistory] = useState<StudentHistory | null>(null)
  const [refinementPrompt, setRefinementPrompt] = useState('')
  
  // Editing state
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    fetchStudents()
  }, [])

  // Update form when assignment is generated
  useEffect(() => {
    if (assignment) {
      setEditTitle(assignment.title)
      setEditDescription(assignment.description)
      setDueDate(assignment.suggestedDueDate)
    }
  }, [assignment])

  async function fetchStudents() {
    try {
      const response = await fetch('/api/students')
      const data = await response.json()
      setStudents(data.students || [])
    } catch {
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    
    if (!prompt.trim()) {
      setError('Please describe what kind of assignment you want to create')
      return
    }

    setGenerating(true)
    setError(null)
    setAssignment(null)

    try {
      const response = await fetch('/api/assignments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent || undefined,
          prompt,
          questionCount,
          difficulty,
          includeMarkscheme,
          includeSolutionSteps,
          focusOnWeakAreas,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate assignment')
      }

      setAssignment(data.assignment)
      setStudentHistory(data.studentHistory)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate assignment')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRefine() {
    if (!assignment || !refinementPrompt.trim()) return

    setRefining(true)
    setError(null)

    try {
      const response = await fetch('/api/assignments/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment,
          refinementPrompt,
          studentId: selectedStudent || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine assignment')
      }

      setAssignment(data.assignment)
      setRefinementPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine assignment')
    } finally {
      setRefining(false)
    }
  }

  function removeQuestion(questionId: string) {
    if (!assignment) return
    setAssignment({
      ...assignment,
      questions: assignment.questions.filter((q) => q.id !== questionId),
    })
  }

  function moveQuestion(questionId: string, direction: 'up' | 'down') {
    if (!assignment) return
    const idx = assignment.questions.findIndex((q) => q.id === questionId)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === assignment.questions.length - 1) return

    const newQuestions = [...assignment.questions]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newQuestions[idx], newQuestions[swapIdx]] = [newQuestions[swapIdx], newQuestions[idx]]
    
    setAssignment({ ...assignment, questions: newQuestions })
  }

  async function handleSaveAssignment(asDraft = false) {
    if (!assignment) return

    setSaving(true)
    setError(null)

    try {
      // First, create any generated questions
      const questionIds: string[] = []
      const topicCache: Record<string, string> = {}

      for (const q of assignment.questions) {
        if (q.isGenerated) {
          // Need to create this question first
          // First ensure topic exists
          let topicId = topicCache[q.topicName]
          if (!topicId) {
            // Try to find or create topic
            const topicRes = await fetch('/api/topics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: q.topicName }),
            })
            const topicData = await topicRes.json()
            topicId = topicData.topic?.id
            if (topicId) {
              topicCache[q.topicName] = topicId
            }
          }

          // Create the question
          const qRes = await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topicId,
              promptText: q.promptText,
              promptLatex: q.promptLatex,
              answerType: q.answerType,
              correctAnswerJson: q.correctAnswer,
              difficulty: q.difficulty,
              hints: q.hints || [],
              solutionSteps: q.solutionSteps || [],
            }),
          })
          const qData = await qRes.json()
          if (qData.question?.id) {
            questionIds.push(qData.question.id)
          }
        } else {
          questionIds.push(q.id)
        }
      }

      // Create the assignment
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle || assignment.title,
          description: editDescription || assignment.description,
          studentProfileId: selectedStudent || null,
          questionIds,
          dueAt: dueDate || null,
          settings: {
            showHints: true,
            showSolutions: includeMarkscheme,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save assignment')
      }

      // If not draft, activate it
      if (!asDraft && data.assignment?.id) {
        await fetch('/api/assignments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: data.assignment.id,
            status: 'active',
          }),
        })
      }

      router.push('/tutor/assignments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignment')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-6">
        <Link href="/tutor/assignments" className="text-gray-600 hover:text-gray-900 text-sm">
          ← Back to Assignments
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-2">
          <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            AI Assignment Generator
          </span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            Beta
          </span>
        </h1>
        <p className="text-gray-600 mt-1">
          Describe what you want and let AI create a personalized assignment
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {!assignment ? (
        // Generation Form
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                  </svg>
                  Describe Your Assignment
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student (Optional)
                  </label>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">General assignment (any student)</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Selecting a student enables personalization based on their learning history
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What kind of assignment do you want? *
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={4}
                    placeholder="E.g., 'Practice on quadratic equations and factoring, focus on word problems. Include some challenging questions that require combining multiple concepts.'"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Questions
                    </label>
                    <select
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value={5}>5 questions (~15 min)</option>
                      <option value={10}>10 questions (~30 min)</option>
                      <option value={15}>15 questions (~45 min)</option>
                      <option value={20}>20 questions (~60 min)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="adaptive">Adaptive (based on student)</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="mixed">Mixed (progressive)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMarkscheme}
                      onChange={(e) => setIncludeMarkscheme(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Include mark scheme / answers</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSolutionSteps}
                      onChange={(e) => setIncludeSolutionSteps(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Include step-by-step solutions</span>
                  </label>

                  {selectedStudent && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={focusOnWeakAreas}
                        onChange={(e) => setFocusOnWeakAreas(e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Focus on weak areas</span>
                    </label>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={generating || !prompt.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg shadow-sm hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    Generate Assignment
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Tips Sidebar */}
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-medium text-purple-900 mb-2">💡 Tips for great prompts</h3>
              <ul className="text-sm text-purple-800 space-y-2">
                <li>• Be specific about topics (e.g., &quot;quadratic equations&quot; vs &quot;algebra&quot;)</li>
                <li>• Mention desired question types (word problems, proofs, calculations)</li>
                <li>• Include context (exam prep, homework, review)</li>
                <li>• Specify if you want certain skills emphasized</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">🎯 Example prompts</h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="cursor-pointer hover:text-blue-600" onClick={() => setPrompt('Create a review assignment covering linear equations, graphing, and slope-intercept form. Include both calculation and word problems.')}>
                  &quot;Review assignment on linear equations...&quot;
                </li>
                <li className="cursor-pointer hover:text-blue-600" onClick={() => setPrompt('Challenge problems on polynomial factoring, including difference of squares, perfect square trinomials, and grouping methods.')}>
                  &quot;Challenge problems on polynomial factoring...&quot;
                </li>
                <li className="cursor-pointer hover:text-blue-600" onClick={() => setPrompt('Basic practice on fraction operations - adding, subtracting, multiplying and dividing fractions. Keep it simple for building confidence.')}>
                  &quot;Basic practice on fraction operations...&quot;
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        // Assignment Preview & Edit
        <div className="space-y-6">
          {/* Student Insights */}
          {studentHistory && studentHistory.totalAttempts > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">📊 Student Insights</h3>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <span className="text-blue-700">Total Practice:</span>
                  <span className="ml-2 font-medium">{studentHistory.totalAttempts} questions</span>
                </div>
                <div>
                  <span className="text-blue-700">Accuracy:</span>
                  <span className="ml-2 font-medium">{studentHistory.overallAccuracy}%</span>
                </div>
                {studentHistory.topicsStruggled.length > 0 && (
                  <div>
                    <span className="text-blue-700">Needs work on:</span>
                    <span className="ml-2 font-medium">
                      {studentHistory.topicsStruggled.slice(0, 2).map(t => t.topicName).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assignment Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-bold text-gray-900 w-full border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none pb-1"
                  placeholder="Assignment Title"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full text-gray-600 border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="Description..."
                />
              </div>
              <button
                onClick={() => setAssignment(null)}
                className="text-gray-400 hover:text-gray-600 ml-4"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-gray-600">~{assignment.estimatedMinutes} min</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
                <span className="text-gray-600">{assignment.questions.length} questions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">{assignment.difficultyBreakdown.easy} easy</span>
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">{assignment.difficultyBreakdown.medium} medium</span>
                <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">{assignment.difficultyBreakdown.hard} hard</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {assignment.topicsCovered.map((topic) => (
                <span key={topic} className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          {/* Questions List */}
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            <div className="p-4 bg-gray-50">
              <h3 className="font-medium text-gray-900">Questions</h3>
            </div>
            {assignment.questions.map((question, idx) => (
              <div key={question.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                      {idx + 1}
                    </span>
                    <button
                      onClick={() => moveQuestion(question.id, 'up')}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveQuestion(question.id, 'down')}
                      disabled={idx === assignment.questions.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {question.topicName}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        question.difficulty <= 2 ? 'bg-green-100 text-green-700' :
                        question.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {question.difficulty <= 2 ? 'Easy' : question.difficulty <= 3 ? 'Medium' : 'Hard'}
                      </span>
                      {question.isGenerated && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                          AI Generated
                        </span>
                      )}
                    </div>

                    {editingQuestion === question.id ? (
                      <textarea
                        value={question.promptText}
                        onChange={(e) => {
                          const newQuestions = assignment.questions.map((q) =>
                            q.id === question.id ? { ...q, promptText: e.target.value } : q
                          )
                          setAssignment({ ...assignment, questions: newQuestions })
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-800 whitespace-pre-wrap">{question.promptText}</p>
                    )}

                    {question.hints && question.hints.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                          {question.hints.length} hint(s)
                        </summary>
                        <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                          {question.hints.map((hint, i) => (
                            <li key={i}>{hint}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingQuestion(editingQuestion === question.id ? null : question.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Edit question"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeQuestion(question.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Remove question"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Refinement Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              Refine with AI
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={refinementPrompt}
                onChange={(e) => setRefinementPrompt(e.target.value)}
                placeholder="E.g., 'Add more word problems' or 'Make it easier' or 'Replace question 3 with something about graphing'"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleRefine}
                disabled={refining || !refinementPrompt.trim()}
                className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {refining ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Refining...
                  </>
                ) : (
                  'Refine'
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => handleSaveAssignment(true)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSaveAssignment(false)}
                  disabled={saving || assignment.questions.length === 0}
                  className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Assign to Student
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
