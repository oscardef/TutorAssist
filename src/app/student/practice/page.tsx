'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import LatexRenderer from '@/components/latex-renderer'
import MathSymbolsPanel from '@/components/math-symbols-panel'

interface Question {
  id: string
  prompt_text: string
  prompt_latex: string | null
  difficulty: number
  grade_level: number | null
  answer_type: string
  correct_answer_json: {
    value: string | number
    tolerance?: number
    choices?: { text: string; latex?: string }[]
    correct?: number
  }
  hints_json: string[] | null
  solution_steps_json: { step: string; result: string }[] | null
  topics: { id: string; name: string } | null
}

interface Topic {
  id: string
  name: string
  questions: { count: number }[]
}

interface TopicStats {
  topicId: string
  topicName: string
  total: number
  correct: number
  accuracy: number
}

type PracticeMode = 'select' | 'topic' | 'review' | 'weak' | 'browse'

// Normalize answer for comparison
function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
    .replace(/\\sqrt/g, 'sqrt')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\pi/g, 'pi')
    .replace(/\\/g, '')
    .replace(/[{}]/g, '')
}

// Format answer for display
function formatAnswerForDisplay(answer: string): string {
  if (!answer) return ''
  if (/\$|\\\(|\\\[/.test(answer)) return answer
  
  let latex = answer
    .replace(/√/g, '\\sqrt{')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/π/g, '\\pi ')
  
  const sqrtCount = (latex.match(/\\sqrt\{/g) || []).length
  const closeBraceCount = (latex.match(/\}/g) || []).length
  if (sqrtCount > closeBraceCount) {
    latex += '}'.repeat(sqrtCount - closeBraceCount)
  }
  
  if (/\\[a-zA-Z]+/.test(latex) || /[_^]/.test(latex) || /\d/.test(latex)) {
    return `$${latex}$`
  }
  return answer
}

function getGradeLevelLabel(level: number | null): string {
  if (!level) return ''
  if (level <= 12) return `Year ${level}`
  if (level === 13) return 'A-Level'
  if (level === 14) return 'University'
  return `Level ${level}`
}

export default function PracticePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode') as PracticeMode | null
  const topicParam = searchParams.get('topic')
  
  const [mode, setMode] = useState<PracticeMode>(modeParam || 'select')
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicStats, setTopicStats] = useState<TopicStats[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>(topicParam || '')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  
  // Question state
  const [answer, setAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [showHints, setShowHints] = useState(false)
  const [visibleHintCount, setVisibleHintCount] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [startTime, setStartTime] = useState<number>(0)
  const [streak, setStreak] = useState(0)
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 })

  // Fetch topics and stats on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Fetch topics
        const topicsRes = await fetch('/api/topics')
        const topicsData = await topicsRes.json()
        setTopics(topicsData.topics || [])
        
        // Fetch student's topic performance
        const statsRes = await fetch('/api/attempts?stats=byTopic')
        const statsData = await statsRes.json()
        if (statsData.topicStats) {
          setTopicStats(statsData.topicStats)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Fetch questions based on mode
  const fetchQuestions = useCallback(async (practiceMode: PracticeMode, topicId?: string) => {
    setLoading(true)
    setQuestions([])
    setQuestion(null)
    setCurrentQuestionIndex(0)
    
    try {
      const params = new URLSearchParams()
      params.set('limit', '20')
      
      if (practiceMode === 'topic' && topicId) {
        params.set('topicId', topicId)
      } else if (practiceMode === 'review') {
        params.set('mode', 'review') // Due for spaced repetition
      } else if (practiceMode === 'weak') {
        params.set('mode', 'weak') // Topics with low accuracy
      }
      
      const response = await fetch(`/api/questions?${params}`)
      const data = await response.json()
      
      if (data.questions && data.questions.length > 0) {
        // Shuffle questions for variety
        const shuffled = [...data.questions].sort(() => Math.random() - 0.5)
        setQuestions(shuffled)
        setQuestion(shuffled[0])
        setStartTime(Date.now())
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Start practice when mode/topic changes
  useEffect(() => {
    if (mode === 'topic' && selectedTopic) {
      fetchQuestions('topic', selectedTopic)
    } else if (mode === 'review') {
      fetchQuestions('review')
    } else if (mode === 'weak') {
      fetchQuestions('weak')
    }
  }, [mode, selectedTopic, fetchQuestions])

  function startPractice(practiceMode: PracticeMode, topicId?: string) {
    setMode(practiceMode)
    if (topicId) {
      setSelectedTopic(topicId)
    }
    setSessionStats({ total: 0, correct: 0 })
    setStreak(0)
    
    // Update URL
    const params = new URLSearchParams()
    params.set('mode', practiceMode)
    if (topicId) params.set('topic', topicId)
    router.push(`/student/practice?${params}`)
  }

  function resetState() {
    setAnswer('')
    setSelectedChoice(null)
    setShowHints(false)
    setVisibleHintCount(0)
    setSubmitted(false)
    setIsCorrect(null)
    setShowSolution(false)
    setStartTime(Date.now())
  }

  async function handleSubmit() {
    if (!question) return
    
    const correctAnswer = question.correct_answer_json
    let correct = false
    let userAnswer = answer

    if (question.answer_type === 'multiple_choice') {
      userAnswer = String(selectedChoice)
      correct = selectedChoice === correctAnswer.correct
    } else if (question.answer_type === 'numeric') {
      const numAnswer = parseFloat(answer)
      const numCorrect = parseFloat(String(correctAnswer.value))
      const tolerance = correctAnswer.tolerance || 0.01
      correct = Math.abs(numAnswer - numCorrect) <= tolerance
    } else {
      const normalizedUserAnswer = normalizeAnswer(answer)
      const normalizedCorrectAnswer = normalizeAnswer(String(correctAnswer.value))
      correct = normalizedUserAnswer === normalizedCorrectAnswer
    }

    setIsCorrect(correct)
    setSubmitted(true)
    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (correct ? 1 : 0)
    }))

    if (correct) {
      setStreak(s => s + 1)
    } else {
      setStreak(0)
    }

    // Record attempt
    try {
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          answerLatex: userAnswer,
          isCorrect: correct,
          timeSpentSeconds: timeSpent,
          hintsUsed: visibleHintCount,
        }),
      })
    } catch (error) {
      console.error('Failed to record attempt:', error)
    }
  }

  function nextQuestion() {
    resetState()
    
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIndex)
      setQuestion(questions[nextIndex])
    } else {
      // End of questions - show summary or fetch more
      setMode('select')
      router.push('/student/practice')
    }
  }

  function backToSelection() {
    setMode('select')
    setQuestion(null)
    setQuestions([])
    router.push('/student/practice')
  }

  // Loading state
  if (loading && mode === 'select') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Mode selection screen
  if (mode === 'select') {
    const weakTopics = topicStats.filter(s => s.total >= 3 && s.accuracy < 60)
    const hasWeakTopics = weakTopics.length > 0
    
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Practice</h1>
          <p className="text-gray-600 mt-1">Choose how you want to practice today.</p>
        </div>

        {/* Practice Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Review Due */}
          <button
            onClick={() => startPractice('review')}
            className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Spaced Review</h3>
                <p className="text-sm text-gray-600">
                  Review questions due for repetition to strengthen your memory.
                </p>
              </div>
            </div>
          </button>

          {/* Weak Areas */}
          <button
            onClick={() => hasWeakTopics && startPractice('weak')}
            disabled={!hasWeakTopics}
            className={`bg-white rounded-lg border border-gray-200 p-6 text-left transition-all group ${
              hasWeakTopics 
                ? 'hover:border-orange-300 hover:shadow-md' 
                : 'opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                hasWeakTopics ? 'bg-orange-100 group-hover:bg-orange-200' : 'bg-gray-100'
              }`}>
                <svg className={`w-6 h-6 ${hasWeakTopics ? 'text-orange-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Strengthen Weak Areas</h3>
                <p className="text-sm text-gray-600">
                  {hasWeakTopics 
                    ? `Focus on ${weakTopics.length} topic${weakTopics.length > 1 ? 's' : ''} where you need more practice.`
                    : 'Complete more questions to identify areas for improvement.'
                  }
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Topic Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Practice by Topic</h2>
          
          {topics.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topics.map((topic) => {
                const questionCount = topic.questions?.[0]?.count || 0
                const stats = topicStats.find(s => s.topicId === topic.id)
                
                return (
                  <button
                    key={topic.id}
                    onClick={() => questionCount > 0 && startPractice('topic', topic.id)}
                    disabled={questionCount === 0}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      questionCount > 0
                        ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-medium text-gray-900 mb-1">{topic.name}</div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{questionCount} questions</span>
                      {stats && stats.total > 0 && (
                        <span className={`font-medium ${
                          stats.accuracy >= 80 ? 'text-green-600' :
                          stats.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {stats.accuracy}%
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No topics available. Your tutor will add practice materials soon.
            </p>
          )}
        </div>

        {/* Topic Stats Summary */}
        {topicStats.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Your Progress</h2>
            <div className="space-y-3">
              {topicStats.slice(0, 5).map((stats) => (
                <div key={stats.topicId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{stats.topicName}</span>
                    <span className="text-gray-500">
                      {stats.correct}/{stats.total} ({stats.accuracy}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        stats.accuracy >= 80 ? 'bg-green-500' :
                        stats.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${stats.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link 
              href="/student/progress" 
              className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700"
            >
              View full progress →
            </Link>
          </div>
        )}
      </div>
    )
  }

  // Practice question view
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Questions Available</h2>
        <p className="text-gray-600 mb-6">
          {mode === 'review' 
            ? "You're all caught up! No questions due for review right now."
            : mode === 'weak'
            ? "Great job! You've been practicing well in all areas."
            : "No questions found for this topic yet."
          }
        </p>
        <button
          onClick={backToSelection}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Choose Another Practice Mode
        </button>
      </div>
    )
  }

  const topicName = topics.find(t => t.id === selectedTopic)?.name || question.topics?.name || 'Practice'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={backToSelection}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to selection
          </button>
          <h1 className="text-xl font-bold text-gray-900">{topicName}</h1>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          {streak > 1 && (
            <div className="text-sm font-medium text-green-600">
              {streak} in a row
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{sessionStats.correct} correct</span>
          <span>{sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}% accuracy</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Question Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              question.difficulty <= 2 ? 'bg-green-100 text-green-700' :
              question.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {question.difficulty <= 2 ? 'Easy' : question.difficulty <= 3 ? 'Medium' : 'Hard'}
            </span>
            {question.grade_level && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                {getGradeLevelLabel(question.grade_level)}
              </span>
            )}
          </div>
        </div>

        {/* Question Content */}
        <div className="p-6">
          <div className="prose max-w-none mb-6">
            <div className="text-lg text-gray-800">
              <LatexRenderer content={question.prompt_latex || question.prompt_text} />
            </div>
          </div>

          {/* Answer Input */}
          {question.answer_type === 'multiple_choice' && question.correct_answer_json.choices ? (
            <div className="space-y-3">
              {question.correct_answer_json.choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => !submitted && setSelectedChoice(idx)}
                  disabled={submitted}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedChoice === idx
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${submitted ? 'cursor-default' : 'cursor-pointer'} ${
                    submitted && idx === question.correct_answer_json.correct
                      ? 'border-green-500 bg-green-50'
                      : submitted && idx === selectedChoice && !isCorrect
                      ? 'border-red-500 bg-red-50'
                      : ''
                  }`}
                >
                  <span className="font-medium mr-3">{String.fromCharCode(65 + idx)}.</span>
                  <LatexRenderer content={choice.text} />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Answer
              </label>
              <div className="flex gap-2">
                <input
                  type={question.answer_type === 'numeric' ? 'number' : 'text'}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={submitted}
                  className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  placeholder={question.answer_type === 'numeric' ? 'Enter a number' : 'Type your answer'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !submitted) {
                      handleSubmit()
                    }
                  }}
                />
                {!submitted && (
                  <MathSymbolsPanel onInsert={(symbol) => setAnswer(prev => prev + symbol)} />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Use the math symbols button or type normally. Common notations: × ÷ √ π
              </p>
              {submitted && (
                <div className="mt-3 text-sm text-gray-600">
                  Your answer: <span className="font-medium"><LatexRenderer content={formatAnswerForDisplay(answer)} /></span>
                  {!isCorrect && question.correct_answer_json.value && (
                    <span className="ml-2">
                      | Correct: <span className="font-medium text-green-600">
                        <LatexRenderer content={formatAnswerForDisplay(String(question.correct_answer_json.value))} />
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {submitted && (
            <div className={`mt-4 p-4 rounded-lg ${
              isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                )}
                <span className="font-medium">{isCorrect ? 'Correct!' : 'Not quite right'}</span>
              </div>
            </div>
          )}

          {/* Hints */}
          {!submitted && question.hints_json && question.hints_json.length > 0 && (
            <div className="mt-6">
              {!showHints ? (
                <button
                  onClick={() => {
                    setShowHints(true)
                    setVisibleHintCount(1)
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  Show Hint ({question.hints_json.length} available)
                </button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-yellow-800">
                    Hints ({visibleHintCount} of {question.hints_json.length})
                  </p>
                  {question.hints_json.slice(0, visibleHintCount).map((hint, idx) => (
                    <div key={idx} className="pl-4 border-l-2 border-yellow-300">
                      <p className="text-xs text-yellow-600 mb-1">Hint {idx + 1}</p>
                      <p className="text-yellow-800">
                        <LatexRenderer content={hint} />
                      </p>
                    </div>
                  ))}
                  {visibleHintCount < question.hints_json.length && (
                    <button
                      onClick={() => setVisibleHintCount(prev => prev + 1)}
                      className="text-yellow-700 hover:text-yellow-900 text-sm font-medium"
                    >
                      Show next hint
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Solution */}
          {submitted && question.solution_steps_json && question.solution_steps_json.length > 0 && (
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
                    {question.solution_steps_json.map((step, idx) => (
                      <li key={idx} className="text-purple-800">
                        <span className="font-medium">
                          <LatexRenderer content={step.step} />
                        </span>
                        {step.result && (
                          <span className="ml-2 text-purple-600">
                            → <LatexRenderer content={step.result} />
                          </span>
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
            onClick={backToSelection}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            End Session
          </button>

          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={question.answer_type === 'multiple_choice' ? selectedChoice === null : !answer.trim()}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              {currentQuestionIndex < questions.length - 1 ? 'Next Question →' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
