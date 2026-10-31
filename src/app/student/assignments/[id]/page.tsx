'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { QuestionMedia } from '@/components/question-media'
import { PartsAnswerBlock } from '@/components/question-player/parts'
import { parseParts, gradeParts, type PartResult } from '@/lib/parts'
import { IconButton, DifficultyDots, ProgressTrail, ProgressBar, ChoiceList, FeedbackBanner, HintsPanel, SolutionPanel, YourAnswerCard, FlagModal, CompletionModal } from '@/components/question-player'
import LatexRenderer from '@/components/latex-renderer'
import MathInput from '@/components/math-input'
import { AnswerDisplay } from '@/components/answer-display'
import { compareMathAnswers, compareNumericAnswers, formatMathForDisplay } from '@/lib/math-utils'
import { useSounds } from '@/lib/sounds'
import { useConfetti } from '@/lib/confetti'

interface Question {
  parts_json?: unknown[] | null
  prompt_image_r2_key?: string | null
  figure_json?: Record<string, unknown> | null
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
  partResults?: PartResult[]
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
  const [partAnswers, setPartAnswers] = useState<string[]>([])
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
                attemptId: latest.id,
                partResults: latest.context_json?.validation?.parts,
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
    setPartAnswers([])
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

    const qParts = parseParts(currentQuestion.parts_json)
    if (qParts) {
      isCorrect = gradeParts(qParts, partAnswers).allCorrect
      userAnswer = JSON.stringify(partAnswers)
    } else if (currentQuestion.answer_type === 'multiple_choice') {
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

    try {
      const response = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          assignmentId,
          answerLatex: userAnswer,
          partAnswers: qParts ? partAnswers : undefined,
          isCorrect: usedHints ? false : isCorrect,
          hintsUsed: usedHints ? visibleHintCount : 0,
        }),
      })
      // The server's verdict is authoritative (it also recognises equivalent forms)
      const data: { attempt?: { id?: string; is_correct?: boolean; context_json?: { validation?: { parts?: PartResult[] } } } } = await response.json().catch(() => ({}))
      if (typeof data.attempt?.is_correct === 'boolean') isCorrect = data.attempt.is_correct
      const finalIsCorrect = usedHints ? false : isCorrect

      setAttempts(prev => ({
        ...prev,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          isCorrect: finalIsCorrect,
          answer: userAnswer,
          usedHints,
          attemptId: data.attempt?.id,
          partResults: data.attempt?.context_json?.validation?.parts,
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
    const messages = ['Correct! ', 'Well done! ⭐', 'Perfect! ', 'Great job! ', 'Excellent! ']
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
                <p className="text-gray-600 text-lg">Assignment not found or has no questions.</p>
        <Link href="/student/assignments" className="text-blue-600 hover:underline mt-4 inline-block font-medium">
          ← Back to Assignments
        </Link>
      </div>
    )
  }

  const Back = Icons.chevronLeft
  const Flame = Icons.flame
  const Flag = Icons.flag
  const Arrow = Icons.arrowRight
  const Check = Icons.check
  const results = items.map(item => attempts[item.question_id] ? attempts[item.question_id].isCorrect : undefined)
  const questionParts = parseParts(currentQuestion?.parts_json)
  const shownPartAnswers: string[] = (() => {
    if (!currentAttempt) return partAnswers
    try { const v = JSON.parse(currentAttempt.answer); return Array.isArray(v) ? v.map(x => (x == null ? '' : String(x))) : [] } catch { return [] }
  })()
  const shownPartResults = currentAttempt && questionParts ? (currentAttempt.partResults ?? gradeParts(questionParts, shownPartAnswers).results) : null
  const answered = Object.keys(attempts).length

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <Link href="/student/assignments" className="btn btn-secondary btn-sm mt-0.5 !h-10 !w-10 !px-0" aria-label="Back to assignments" title="Back to assignments">
          <Back className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{assignment.title}</h1>
          {assignment.description && <p className="mt-1 text-gray-600">{assignment.description}</p>}
        </div>
        {streak > 1 && (
          <span className="chip chip-spark"><Flame className="h-3.5 w-3.5" /> {streak}</span>
        )}
      </div>

      {/* Progress */}
      <div className="card mb-5 p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-bold text-ink tnum">Question {currentIndex + 1} of {items.length}</span>
          {answered > 0 && <span className="text-gray-600 tnum">{correctCount} of {answered} right</span>}
        </div>
        <ProgressBar value={progress} tone={progress >= 100 ? 'good' : 'brand'} label="Assignment progress" />
        <div className="mt-4">
          <ProgressTrail total={items.length} current={currentIndex} results={results} />
        </div>
      </div>

      {/* Question */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <DifficultyDots level={currentQuestion?.difficulty} />
            {currentQuestion?.topics?.name && <span className="chip chip-brand">{currentQuestion.topics.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {currentAttempt && (
              <span className={`chip ${currentAttempt.isCorrect ? 'chip-good' : 'chip-bad'}`}>{currentAttempt.isCorrect ? 'Correct' : 'Incorrect'}</span>
            )}
            <IconButton label={flagSubmitted ? 'Reported' : 'Report a problem with this question'} onClick={() => setShowFlagModal(true)} active={flagSubmitted} disabled={flagSubmitted}>
              <Flag className="h-5 w-5" />
            </IconButton>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-6 text-xl leading-relaxed text-ink">
            <LatexRenderer content={currentQuestion?.prompt_latex || currentQuestion?.prompt_text || ''} />
          </div>
          <QuestionMedia imageKey={currentQuestion?.prompt_image_r2_key} figure={currentQuestion?.figure_json} className="mb-6" />

          {questionParts ? (
            <PartsAnswerBlock
              parts={questionParts}
              answers={shownPartAnswers}
              onAnswer={(idx, v) => setPartAnswers(prev => { const next = [...prev]; next[idx] = v; return next })}
              submitted={!!currentAttempt}
              results={shownPartResults}
              onSubmitLast={() => { if (!currentAttempt) handleSubmit() }}
            />
          ) : currentQuestion?.answer_type === 'multiple_choice' && currentQuestion.correct_answer_json.choices ? (
            <ChoiceList
              choices={currentQuestion.correct_answer_json.choices}
              selected={selectedChoice}
              onSelect={setSelectedChoice}
              disabled={!!currentAttempt}
              correctIndex={currentQuestion.correct_answer_json.correct}
              answeredIndex={currentAttempt ? parseInt(currentAttempt.answer) : null}
            />
          ) : (
            <div>
              <MathInput
                value={answer}
                onChange={setAnswer}
                disabled={!!currentAttempt}
                placeholder={currentQuestion?.answer_type === 'numeric' ? 'Enter a number…' : 'Type your answer…'}
                onSubmit={() => { if (!currentAttempt) handleSubmit() }}
                status={currentAttempt ? (currentAttempt.isCorrect ? 'correct' : 'incorrect') : undefined}
              />
              {currentAttempt && (
                <YourAnswerCard
                  answer={<LatexRenderer content={formatMathForDisplay(currentAttempt.answer)} />}
                  correct={currentAttempt.isCorrect}
                  correctAnswer={currentQuestion?.correct_answer_json.value ? <LatexRenderer content={formatMathForDisplay(String(currentQuestion.correct_answer_json.value))} /> : undefined}
                />
              )}
            </div>
          )}

          {feedback && (
            <FeedbackBanner
              correct={feedback.correct}
              message={feedback.message}
              claimed={claimedCorrect}
              claiming={flagSubmitting}
              onClaim={handleClaimCorrect}
              correctAnswer={currentQuestion && !questionParts ? <AnswerDisplay answerType={currentQuestion.answer_type} correctAnswer={currentQuestion.correct_answer_json} /> : undefined}
            />
          )}

          {currentQuestion?.hints_json && assignment.settings_json.showHints !== false && (
            <HintsPanel
              hints={currentQuestion.hints_json}
              visible={showHints ? visibleHintCount : 0}
              onReveal={() => { setShowHints(true); setVisibleHintCount(1) }}
              onShowNext={() => setVisibleHintCount(prev => prev + 1)}
            />
          )}

          {currentAttempt && currentQuestion?.solution_steps_json && assignment.settings_json.showSolutions !== false && (
            <SolutionPanel steps={currentQuestion.solution_steps_json} open={showSolution} onOpen={() => setShowSolution(true)} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-paper px-5 py-4">
          {!currentAttempt ? (
            <button type="button" onClick={handleSubmit} disabled={isSubmitting || (questionParts ? !partAnswers.some(a => a && a.trim()) : currentQuestion?.answer_type === 'multiple_choice' ? selectedChoice === null : !answer.trim())} className="btn btn-primary btn-lg">
              {isSubmitting ? 'Checking…' : <>Check answer <Check className="h-5 w-5" /></>}
            </button>
          ) : currentIndex < items.length - 1 ? (
            <button type="button" onClick={nextQuestion} className="btn btn-primary btn-lg">Next <Arrow className="h-5 w-5" /></button>
          ) : (
            <button type="button" onClick={handleCompleteAssignment} className="btn btn-spark btn-lg">Finish assignment <Check className="h-5 w-5" /></button>
          )}
        </div>
      </div>

      <CompletionModal
        open={showCompletionModal}
        correct={correctCount}
        total={items.length}
        onBack={() => { setShowCompletionModal(false); router.push('/student/assignments') }}
        onRedo={handleRedoAssignment}
        onReview={() => setShowCompletionModal(false)}
      />

      <FlagModal
        open={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        flagType={flagType}
        setFlagType={setFlagType}
        comment={flagComment}
        setComment={setFlagComment}
        onSubmit={handleSubmitFlag}
        submitting={flagSubmitting}
      />
    </div>
  )
}
