'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Question {
  id: string
  prompt_text: string
  prompt_latex?: string
  difficulty: number
  answer_type: string
  correct_answer_json: {
    value: string | number
    tolerance?: number
    choices?: { text: string; latex?: string }[]
    correct?: number
  }
  hints_json: string[]
  solution_steps_json: { step: string; result: string }[]
  topics?: { name: string }
}

interface AssignmentItem {
  id: string
  question_id: string
  order_index: number
  question: Question
}

interface Assignment {
  id: string
  title: string
  description?: string
  status: string
  due_at?: string
  settings_json: {
    showHints?: boolean
    showSolutions?: boolean
    allowRetry?: boolean
  }
}

interface AttemptResult {
  questionId: string
  isCorrect: boolean
  answer: string
}

export default function StudentAssignmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const assignmentId = params.id as string

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [attempts, setAttempts] = useState<Record<string, AttemptResult>>({})
  
  // Current question state
  const [answer, setAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [hintIndex, setHintIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null)
  const [showSolution, setShowSolution] = useState(false)

  const fetchAssignment = useCallback(async () => {
    try {
      const response = await fetch(`/api/assignments?id=${assignmentId}`)
      const data = await response.json()
      
      if (data.assignment) {
        setAssignment(data.assignment)
        // Sort items by order_index
        const sortedItems = (data.assignment.assignment_items || [])
          .sort((a: AssignmentItem, b: AssignmentItem) => a.order_index - b.order_index)
        setItems(sortedItems)
        
        // Load existing attempts
        const existingAttempts: Record<string, AttemptResult> = {}
        for (const item of sortedItems) {
          const attemptRes = await fetch(`/api/attempts?questionId=${item.question_id}&assignmentId=${assignmentId}`)
          const attemptData = await attemptRes.json()
          if (attemptData.attempts && attemptData.attempts.length > 0) {
            const latest = attemptData.attempts[0]
            existingAttempts[item.question_id] = {
              questionId: item.question_id,
              isCorrect: latest.is_correct,
              answer: latest.answer_raw || '',
            }
          }
        }
        setAttempts(existingAttempts)
        
        // Find first unanswered question
        const firstUnanswered = sortedItems.findIndex(
          (item: AssignmentItem) => !existingAttempts[item.question_id]
        )
        setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0)
      }
    } catch (err) {
      console.error('Failed to load assignment:', err)
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    fetchAssignment()
  }, [fetchAssignment])

  const currentItem = items[currentIndex]
  const currentQuestion = currentItem?.question
  const currentAttempt = currentQuestion ? attempts[currentQuestion.id] : null

  // Reset state when changing questions
  useEffect(() => {
    setAnswer('')
    setSelectedChoice(null)
    setShowHint(false)
    setHintIndex(0)
    setFeedback(null)
    setShowSolution(false)
  }, [currentIndex])

  async function handleSubmit() {
    if (!currentQuestion) return
    
    setIsSubmitting(true)
    setFeedback(null)

    const correctAnswer = currentQuestion.correct_answer_json
    let isCorrect = false
    let userAnswer = answer

    if (currentQuestion.answer_type === 'multiple_choice') {
      userAnswer = String(selectedChoice)
      isCorrect = selectedChoice === correctAnswer.correct
    } else if (currentQuestion.answer_type === 'numeric') {
      const numAnswer = parseFloat(answer)
      const numCorrect = parseFloat(String(correctAnswer.value))
      const tolerance = correctAnswer.tolerance || 0.01
      isCorrect = Math.abs(numAnswer - numCorrect) <= tolerance
    } else {
      // Exact match (case insensitive, trim whitespace)
      isCorrect = answer.trim().toLowerCase() === String(correctAnswer.value).trim().toLowerCase()
    }

    try {
      await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          assignmentId,
          answerLatex: userAnswer,
          isCorrect,
          hintsUsed: showHint ? hintIndex + 1 : 0,
        }),
      })

      setAttempts(prev => ({
        ...prev,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          isCorrect,
          answer: userAnswer,
        },
      }))

      setFeedback({
        correct: isCorrect,
        message: isCorrect 
          ? getRandomCorrectMessage() 
          : getRandomIncorrectMessage(),
      })

      // Check if assignment is complete
      const newAttempts = {
        ...attempts,
        [currentQuestion.id]: { questionId: currentQuestion.id, isCorrect, answer: userAnswer },
      }
      const allAnswered = items.every(item => newAttempts[item.question_id])
      
      if (allAnswered && isCorrect) {
        // Mark assignment as complete
        await fetch('/api/assignments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: assignmentId,
            status: 'completed',
          }),
        })
      }
    } catch (err) {
      console.error('Failed to submit answer:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  function goToQuestion(index: number) {
    if (index >= 0 && index < items.length) {
      setCurrentIndex(index)
    }
  }

  function nextQuestion() {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  function getRandomCorrectMessage() {
    const messages = ['Correct! 🎉', 'Well done! ✨', 'Perfect! 💯', 'Great job! 🌟', 'Nailed it! 🎯']
    return messages[Math.floor(Math.random() * messages.length)]
  }

  function getRandomIncorrectMessage() {
    const messages = ["Not quite, try again!", "That's not right. Review the hint?", "Keep trying!", "Almost there!"]
    return messages[Math.floor(Math.random() * messages.length)]
  }

  const progress = items.length > 0 
    ? Math.round((Object.keys(attempts).length / items.length) * 100)
    : 0
  
  const correctCount = Object.values(attempts).filter(a => a.isCorrect).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!assignment || items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Assignment not found or has no questions.</p>
        <Link href="/student/assignments" className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Assignments
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/student/assignments" className="text-gray-600 hover:text-gray-900 text-sm">
          ← Back to Assignments
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{assignment.title}</h1>
        {assignment.description && (
          <p className="text-gray-600 mt-1">{assignment.description}</p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">
            {correctCount}/{items.length} correct ({progress}%)
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Question dots */}
        <div className="flex gap-1 mt-3 flex-wrap">
          {items.map((item, idx) => {
            const attempt = attempts[item.question_id]
            return (
              <button
                key={item.id}
                onClick={() => goToQuestion(idx)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                  idx === currentIndex
                    ? 'ring-2 ring-blue-500 ring-offset-2'
                    : ''
                } ${
                  attempt
                    ? attempt.isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Question Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-900">
              Question {currentIndex + 1}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              currentQuestion?.difficulty <= 2 ? 'bg-green-100 text-green-700' :
              currentQuestion?.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {currentQuestion?.difficulty <= 2 ? 'Easy' : 
               currentQuestion?.difficulty <= 3 ? 'Medium' : 'Hard'}
            </span>
            {currentQuestion?.topics?.name && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                {currentQuestion.topics.name}
              </span>
            )}
          </div>
          {currentAttempt && (
            <span className={`text-sm font-medium ${
              currentAttempt.isCorrect ? 'text-green-600' : 'text-red-600'
            }`}>
              {currentAttempt.isCorrect ? '✓ Answered correctly' : '✗ Incorrect'}
            </span>
          )}
        </div>

        {/* Question Content */}
        <div className="p-6">
          <div className="prose max-w-none mb-6">
            <p className="text-lg text-gray-800 whitespace-pre-wrap">
              {currentQuestion?.prompt_text}
            </p>
            {currentQuestion?.prompt_latex && (
              <div className="mt-2 p-4 bg-gray-50 rounded-lg font-mono text-sm">
                {currentQuestion.prompt_latex}
              </div>
            )}
          </div>

          {/* Answer Input */}
          {currentQuestion?.answer_type === 'multiple_choice' && currentQuestion.correct_answer_json.choices ? (
            <div className="space-y-3">
              {currentQuestion.correct_answer_json.choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => !currentAttempt && setSelectedChoice(idx)}
                  disabled={!!currentAttempt}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedChoice === idx
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${currentAttempt ? 'cursor-default' : 'cursor-pointer'} ${
                    currentAttempt && idx === currentQuestion.correct_answer_json.correct
                      ? 'border-green-500 bg-green-50'
                      : currentAttempt && idx === parseInt(currentAttempt.answer) && !currentAttempt.isCorrect
                      ? 'border-red-500 bg-red-50'
                      : ''
                  }`}
                >
                  <span className="font-medium mr-3">{String.fromCharCode(65 + idx)}.</span>
                  {choice.text}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Answer
              </label>
              <input
                type={currentQuestion?.answer_type === 'numeric' ? 'number' : 'text'}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!currentAttempt}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                placeholder={currentQuestion?.answer_type === 'numeric' ? 'Enter a number' : 'Type your answer'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !currentAttempt) {
                    handleSubmit()
                  }
                }}
              />
              {currentAttempt && (
                <p className="mt-2 text-sm text-gray-600">
                  Your answer: <span className="font-medium">{currentAttempt.answer}</span>
                  {!currentAttempt.isCorrect && (
                    <span className="ml-2">
                      | Correct: <span className="font-medium text-green-600">
                        {String(currentQuestion?.correct_answer_json.value)}
                      </span>
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`mt-4 p-4 rounded-lg ${
              feedback.correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              <p className="font-medium">{feedback.message}</p>
            </div>
          )}

          {/* Hints */}
          {currentQuestion?.hints_json && currentQuestion.hints_json.length > 0 && 
           assignment.settings_json.showHints !== false && (
            <div className="mt-6">
              {!showHint ? (
                <button
                  onClick={() => setShowHint(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  Show Hint
                </button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    Hint {hintIndex + 1} of {currentQuestion.hints_json.length}
                  </p>
                  <p className="text-yellow-800">{currentQuestion.hints_json[hintIndex]}</p>
                  {hintIndex < currentQuestion.hints_json.length - 1 && (
                    <button
                      onClick={() => setHintIndex(hintIndex + 1)}
                      className="mt-2 text-yellow-700 hover:text-yellow-900 text-sm font-medium"
                    >
                      Show next hint →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Solution */}
          {currentAttempt && currentQuestion?.solution_steps_json && 
           currentQuestion.solution_steps_json.length > 0 &&
           assignment.settings_json.showSolutions !== false && (
            <div className="mt-6">
              {!showSolution ? (
                <button
                  onClick={() => setShowSolution(true)}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  View Solution
                </button>
              ) : (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-purple-800 mb-3">Solution Steps</p>
                  <ol className="list-decimal list-inside space-y-2">
                    {currentQuestion.solution_steps_json.map((step, idx) => (
                      <li key={idx} className="text-purple-800">
                        <span className="font-medium">{step.step}</span>
                        {step.result && (
                          <span className="ml-2 text-purple-600">→ {step.result}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-4 flex justify-between items-center">
          <button
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          <div className="flex gap-3">
            {!currentAttempt ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (currentQuestion?.answer_type === 'multiple_choice' ? selectedChoice === null : !answer.trim())}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Checking...
                  </>
                ) : (
                  'Check Answer'
                )}
              </button>
            ) : currentIndex < items.length - 1 ? (
              <button
                onClick={nextQuestion}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                Next Question →
              </button>
            ) : (
              <button
                onClick={() => router.push('/student/assignments')}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
              >
                Complete Assignment ✓
              </button>
            )}
          </div>

          <button
            onClick={() => goToQuestion(currentIndex + 1)}
            disabled={currentIndex === items.length - 1}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
