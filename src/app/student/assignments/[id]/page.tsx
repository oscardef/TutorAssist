'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LatexRenderer from '@/components/latex-renderer'
import MathInput from '@/components/math-input'
import { AnswerDisplay } from '@/components/answer-display'
import { compareMathAnswers, compareNumericAnswers, formatMathForDisplay } from '@/lib/math-utils'
import { useSounds } from '@/lib/sounds'
import { useConfetti } from '@/lib/confetti'

interface Question {
  id: string
  prompt_text: string
  prompt_latex?: string
  difficulty: number
  answer_type: string
  correct_answer_json: {
    value: string | number
    tolerance?: number
    choices?: Array<string | { text: string; latex?: string }>
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
  allow_repeat?: boolean
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
  usedHints?: boolean
  attemptId?: string
}

export default function StudentAssignmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const assignmentId = params.id as string
  const isRetakeMode = searchParams.get('retake') === 'true'
  const sounds = useSounds()
  const confetti = useConfetti()

  // Preload sounds on mount for faster playback
  useEffect(() => {
    sounds.preload()
  }, [sounds])

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [attempts, setAttempts] = useState<Record<string, AttemptResult>>({})
  
  // Current question state
  const [answer, setAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [showHints, setShowHints] = useState(false)
  const [visibleHintCount, setVisibleHintCount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [streak, setStreak] = useState(0)
  const [attemptNumber, setAttemptNumber] = useState(1)

  // Flagging state
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagType, setFlagType] = useState<string>('')
  const [flagComment, setFlagComment] = useState('')
  const [flagSubmitting, setFlagSubmitting] = useState(false)
  const [flagSubmitted, setFlagSubmitted] = useState(false)
  const [claimedCorrect, setClaimedCorrect] = useState(false)

  const fetchAssignment = useCallback(async () => {
    try {
      const response = await fetch(`/api/assignments?id=${assignmentId}`)
      const data = await response.json()
      
      if (data.assignment) {
        setAssignment(data.assignment)
        const sortedItems = (data.assignment.assignment_items || [])
          .sort((a: AssignmentItem, b: AssignmentItem) => a.order_index - b.order_index)
        setItems(sortedItems)
        
        // In retake mode, don't load existing attempts - start fresh
        if (isRetakeMode) {
          setAttempts({})
          setCurrentIndex(0)
          // Increment attempt number for tracking
          setAttemptNumber(prev => prev + 1)
        } else {
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
      }
    } catch (err) {
      console.error('Failed to load assignment:', err)
    } finally {
      setLoading(false)
    }
  }, [assignmentId, isRetakeMode])

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
    setShowHints(false)
    setVisibleHintCount(0)
    setFeedback(null)
    setShowSolution(false)
    setFlagSubmitted(false)
    setClaimedCorrect(false)
    setFlagType('')
    setFlagComment('')
  }, [currentIndex])

  async function handleClaimCorrect() {
    if (!currentQuestion || claimedCorrect) return
    
    setFlagSubmitting(true)
    try {
      const response = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          flagType: 'claim_correct',
          comment: 'Student claims their answer was marked incorrectly',
          studentAnswer: currentAttempt?.answer || answer,
          attemptId: currentAttempt?.attemptId || null,
        }),
      })
      
      if (response.ok) {
        setClaimedCorrect(true)
        // Update the local attempt state to show as correct immediately
        if (currentAttempt) {
          setAttempts(prev => ({
            ...prev,
            [currentQuestion.id]: {
              ...prev[currentQuestion.id],
              isCorrect: true, // Mark as correct in UI
            },
          }))
        }
      }
    } catch (error) {
      console.error('Failed to claim correct:', error)
    } finally {
      setFlagSubmitting(false)
    }
  }
  
  async function handleSubmitFlag() {
    if (!currentQuestion || !flagType) return
    
    setFlagSubmitting(true)
    try {
      const response = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          flagType: flagType,
          comment: flagComment || null,
          studentAnswer: currentAttempt?.answer || answer || null,
          attemptId: currentAttempt?.attemptId || null,
        }),
      })
      
      if (response.ok) {
        setFlagSubmitted(true)
        setShowFlagModal(false)
      }
    } catch (error) {
      console.error('Failed to submit flag:', error)
    } finally {
      setFlagSubmitting(false)
    }
  }

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
    } else if (currentQuestion.answer_type === 'true_false') {
      // STRICT validation: only accept exactly "true" or "false"
      const normalizedAnswer = answer.toLowerCase().trim()
      // Handle various storage formats: string "true"/"false", boolean, or number 1/0
      const correctBool = String(correctAnswer.value).toLowerCase() === 'true' || correctAnswer.value === 1
      if (normalizedAnswer === 'true') {
        isCorrect = correctBool === true
      } else if (normalizedAnswer === 'false') {
        isCorrect = correctBool === false
      } else {
        // Anything other than "true" or "false" is incorrect
        isCorrect = false
      }
    } else if (currentQuestion.answer_type === 'numeric') {
      isCorrect = compareNumericAnswers(
        answer, 
        parseFloat(String(correctAnswer.value))
      )
    } else {
      const alternates = (correctAnswer as { alternates?: string[] }).alternates
      isCorrect = compareMathAnswers(answer, String(correctAnswer.value), alternates)
    }

    const usedHints = showHints && visibleHintCount > 0
    const finalIsCorrect = usedHints ? false : isCorrect

    try {
      await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          assignmentId,
          answerLatex: userAnswer,
          isCorrect: finalIsCorrect,
          hintsUsed: usedHints ? visibleHintCount : 0,
        }),
      })

      setAttempts(prev => ({
        ...prev,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          isCorrect: finalIsCorrect,
          answer: userAnswer,
          usedHints,
        },
      }))

      setFeedback({
        correct: isCorrect,
        message: usedHints 
          ? (isCorrect ? 'Correct answer, but no credit for using hints.' : getRandomIncorrectMessage())
          : (isCorrect ? getRandomCorrectMessage() : getRandomIncorrectMessage()),
      })

      // Play sound effects and confetti after feedback is shown
      if (finalIsCorrect) {
        sounds.playCorrect()
        confetti.fireCorrect()
        setStreak(s => s + 1)
        if (streak >= 2) {
          confetti.fireStreak(streak + 1)
          sounds.playStreak(streak + 1)
        }
      } else {
        sounds.playIncorrect()
        setStreak(0)
      }
    } catch (err) {
      console.error('Failed to submit answer:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  function nextQuestion() {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  async function handleCompleteAssignment() {
    sounds.playCompletion()
    confetti.fireCompletion()
    
    try {
      await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assignmentId,
          status: 'completed',
        }),
      })
      setShowCompletionModal(true)
    } catch (err) {
      console.error('Failed to complete assignment:', err)
    }
  }

  async function handleRedoAssignment() {
    setAttempts({})
    setCurrentIndex(0)
    setShowCompletionModal(false)
    setStreak(0)
    
    try {
      await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assignmentId,
          status: 'active',
        }),
      })
    } catch (err) {
      console.error('Failed to reset assignment:', err)
    }
  }

  function getRandomCorrectMessage() {
    const messages = ['Correct! 🎉', 'Well done! ⭐', 'Perfect! 💯', 'Great job! 🌟', 'Excellent! ✨']
    return messages[Math.floor(Math.random() * messages.length)]
  }

  function getRandomIncorrectMessage() {
    const messages = ['Not quite right.', 'Try again next time!', 'Keep going!', 'Almost there!']
    return messages[Math.floor(Math.random() * messages.length)]
  }

  const progress = items.length > 0 
    ? Math.round((Object.keys(attempts).length / items.length) * 100)
    : 0
  
  const correctCount = Object.values(attempts).filter(a => a.isCorrect).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!assignment || items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📋</div>
        <p className="text-gray-600 text-lg">Assignment not found or has no questions.</p>
        <Link href="/student/assignments" className="text-blue-600 hover:underline mt-4 inline-block font-medium">
          ← Back to Assignments
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/student/assignments" className="text-gray-500 hover:text-gray-700 text-sm font-medium inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Assignments
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{assignment.title}</h1>
        {assignment.description && (
          <p className="text-gray-600 mt-1">{assignment.description}</p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-gray-700">Progress</span>
          <div className="flex items-center gap-4">
            {streak > 1 && (
              <span className="text-sm font-semibold text-orange-600 flex items-center gap-1">
                🔥 {streak} streak
              </span>
            )}
            <span className="text-sm text-gray-600">
              {correctCount}/{items.length} correct
            </span>
          </div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Question dots - READ ONLY, no clicking */}
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {items.map((item, idx) => {
            const attempt = attempts[item.question_id]
            const isCurrent = idx === currentIndex
            const isAccessible = idx <= currentIndex || attempt
            
            return (
              <div
                key={item.id}
                className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 scale-110' : ''
                } ${
                  attempt
                    ? attempt.isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : isAccessible
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {attempt ? (attempt.isCorrect ? '✓' : '✗') : idx + 1}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">Complete each question in order to proceed.</p>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Question Header */}
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-900">
              Question {currentIndex + 1}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              currentQuestion?.difficulty <= 2 ? 'bg-green-100 text-green-700' :
              currentQuestion?.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {currentQuestion?.difficulty <= 2 ? 'Easy' : 
               currentQuestion?.difficulty <= 3 ? 'Medium' : 'Hard'}
            </span>
            {currentQuestion?.topics?.name && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                {currentQuestion.topics.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentAttempt && (
              <span className={`text-sm font-semibold ${
                currentAttempt.isCorrect ? 'text-green-600' : 'text-red-600'
              }`}>
                {currentAttempt.isCorrect ? '✓ Correct' : '✗ Incorrect'}
              </span>
            )}
            <button
              onClick={() => setShowFlagModal(true)}
              disabled={flagSubmitted}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                flagSubmitted 
                  ? 'bg-orange-50 border-orange-200 text-orange-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
              {flagSubmitted ? 'Flagged' : 'Flag'}
            </button>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-6">
          <div className="prose max-w-none mb-8">
            <div className="text-xl text-gray-800 leading-relaxed">
              <LatexRenderer content={currentQuestion?.prompt_latex || currentQuestion?.prompt_text || ''} />
            </div>
          </div>

          {/* Answer Input */}
          {currentQuestion?.answer_type === 'multiple_choice' && currentQuestion.correct_answer_json.choices ? (
            <div className="space-y-3">
              {currentQuestion.correct_answer_json.choices.map((rawChoice, idx) => {
                // Handle both string and object choice formats
                const choice = typeof rawChoice === 'string' ? { text: rawChoice } : rawChoice
                return (
                  <button
                    key={idx}
                    onClick={() => !currentAttempt && setSelectedChoice(idx)}
                    disabled={!!currentAttempt}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                      selectedChoice === idx
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${currentAttempt ? 'cursor-default' : 'cursor-pointer'} ${
                      currentAttempt && idx === currentQuestion.correct_answer_json.correct
                        ? 'border-green-500 bg-green-50'
                        : currentAttempt && idx === parseInt(currentAttempt.answer) && !currentAttempt.isCorrect
                        ? 'border-red-500 bg-red-50'
                        : ''
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold mr-4">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-gray-800">
                      <LatexRenderer content={choice.latex || choice.text} />
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div>
              <MathInput
                value={answer}
                onChange={setAnswer}
                disabled={!!currentAttempt}
                placeholder={currentQuestion?.answer_type === 'numeric' ? 'Enter a number' : 'Type your answer'}
                onSubmit={() => {
                  if (!currentAttempt) handleSubmit()
                }}
                status={currentAttempt ? (currentAttempt.isCorrect ? 'correct' : 'incorrect') : undefined}
              />
              {currentAttempt && (
                <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-sm text-gray-600">
                    Your answer: <span className="font-semibold text-gray-900"><LatexRenderer content={formatMathForDisplay(currentAttempt.answer)} /></span>
                  </p>
                  {!currentAttempt.isCorrect && currentQuestion?.correct_answer_json.value && (
                    <p className="text-sm text-gray-600 mt-1">
                      Correct answer: <span className="font-semibold text-green-600">
                        <LatexRenderer content={formatMathForDisplay(String(currentQuestion.correct_answer_json.value))} />
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className={`mt-6 p-5 rounded-xl ${
              feedback.correct || claimedCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {feedback.correct || claimedCorrect ? (
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  <span className={`text-lg font-bold ${feedback.correct || claimedCorrect ? 'text-green-800' : 'text-red-800'}`}>
                    {claimedCorrect ? 'Marked correct!' : feedback.message}
                  </span>
                </div>
                
                {!feedback.correct && !claimedCorrect && (
                  <button
                    onClick={handleClaimCorrect}
                    disabled={flagSubmitting}
                    className="text-sm px-4 py-2 border-2 border-gray-300 rounded-xl hover:bg-white text-gray-700 hover:text-gray-900 disabled:opacity-50 font-medium"
                  >
                    {flagSubmitting ? 'Submitting...' : 'I was right'}
                  </button>
                )}
              </div>
              
              {/* Always show correct answer when wrong */}
              {!feedback.correct && !claimedCorrect && currentQuestion && (
                <div className="mt-4 pt-4 border-t border-red-200">
                  <p className="text-sm font-medium text-red-800 mb-2">Correct answer:</p>
                  <div className="text-red-900 bg-red-100/50 px-3 py-2 rounded-lg inline-block">
                    <AnswerDisplay 
                      answerType={currentQuestion.answer_type}
                      correctAnswer={currentQuestion.correct_answer_json}
                      className="font-medium"
                    />
                  </div>
                </div>
              )}
              
              {claimedCorrect && (
                <p className="mt-3 text-sm text-green-700">
                  ✓ This question has been marked correct. Your tutor will review the answer.
                </p>
              )}
            </div>
          )}

          {/* Hints */}
          {currentQuestion?.hints_json && currentQuestion.hints_json.length > 0 && 
           assignment.settings_json.showHints !== false && (
            <div className="mt-6">
              {!showHints ? (
                <button
                  onClick={() => { setShowHints(true); setVisibleHintCount(1) }}
                  className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  Show Hint ({currentQuestion.hints_json.length} available)
                </button>
              ) : (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
                  <p className="text-sm font-semibold text-amber-800 mb-3">
                    💡 Hints ({visibleHintCount} of {currentQuestion.hints_json.length})
                  </p>
                  {currentQuestion.hints_json.slice(0, visibleHintCount).map((hint, idx) => (
                    <div key={idx} className="pl-4 border-l-4 border-amber-400 mb-3">
                      <p className="text-xs text-amber-600 mb-1 font-medium">Hint {idx + 1}</p>
                      <p className="text-amber-900"><LatexRenderer content={hint} /></p>
                    </div>
                  ))}
                  {visibleHintCount < currentQuestion.hints_json.length && (
                    <button
                      onClick={() => setVisibleHintCount(prev => prev + 1)}
                      className="text-amber-700 hover:text-amber-900 text-sm font-medium flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Show next hint
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
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  View Solution
                </button>
              ) : (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5">
                  <p className="text-sm font-semibold text-purple-800 mb-3">📝 Solution Steps</p>
                  <ol className="list-decimal list-inside space-y-2">
                    {currentQuestion.solution_steps_json.map((step, idx) => (
                      <li key={idx} className="text-purple-900">
                        <span className="font-medium"><LatexRenderer content={step.step} /></span>
                        {step.result && (
                          <span className="ml-2 text-purple-600">→ <LatexRenderer content={step.result} /></span>
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
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end">
          {!currentAttempt ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (currentQuestion?.answer_type === 'multiple_choice' ? selectedChoice === null : !answer.trim())}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all hover:scale-105"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Checking...
                </>
              ) : (
                <>
                  Check Answer
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          ) : currentIndex < items.length - 1 ? (
            <button
              onClick={nextQuestion}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 flex items-center gap-2 transition-all hover:scale-105"
            >
              Next Question
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleCompleteAssignment}
              className="px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 flex items-center gap-2 transition-all hover:scale-105"
            >
              Complete Assignment
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 p-8 animate-in zoom-in-95">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Assignment Complete! 🎉
              </h3>
              <p className="text-gray-600 mb-6">
                You scored {correctCount} out of {items.length} ({Math.round((correctCount / items.length) * 100)}%)
              </p>
              
              <div className="bg-gray-50 rounded-2xl p-5 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{correctCount}</p>
                    <p className="text-sm text-gray-500">Correct</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-500">{items.length - correctCount}</p>
                    <p className="text-sm text-gray-500">Incorrect</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowCompletionModal(false); router.push('/student/assignments') }}
                  className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
                >
                  Back to Assignments
                </button>
                <button
                  onClick={handleRedoAssignment}
                  className="w-full px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Redo Assignment
                </button>
                <button
                  onClick={() => setShowCompletionModal(false)}
                  className="w-full px-6 py-3 text-gray-500 hover:text-gray-700 font-medium"
                >
                  Review Answers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Report an Issue</h3>
              <button onClick={() => setShowFlagModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-2 mb-4">
              <label className="block text-sm font-medium text-gray-700">What&apos;s the issue?</label>
              <div className="grid gap-2">
                {[
                  { type: 'incorrect_answer', label: 'The correct answer is wrong' },
                  { type: 'unclear', label: 'The question is confusing' },
                  { type: 'typo', label: 'There is a typo' },
                  { type: 'too_hard', label: 'Too difficult for this level' },
                  { type: 'other', label: 'Other issue' },
                ].map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => setFlagType(type)}
                    className={`text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors ${
                      flagType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional details (optional)</label>
              <textarea
                value={flagComment}
                onChange={(e) => setFlagComment(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                placeholder="Describe the issue..."
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowFlagModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">
                Cancel
              </button>
              <button
                onClick={handleSubmitFlag}
                disabled={!flagType || flagSubmitting}
                className="px-6 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 font-medium"
              >
                {flagSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
