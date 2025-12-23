'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { MathfieldElement } from 'mathlive'
import LatexRenderer from '@/components/latex-renderer'

interface Question {
  id: string
  prompt_text: string
  prompt_latex: string | null
  answer_latex: string
  difficulty: 'easy' | 'medium' | 'hard'
  hints_json: string[] | null
  solution_steps_json: string[] | null
  topics: { id: string; name: string } | null
}

interface Topic {
  id: string
  name: string
}

export default function PracticePage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'practice'
  
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [question, setQuestion] = useState<Question | null>(null)
  const [answer, setAnswer] = useState('')
  const [showHints, setShowHints] = useState(false)
  const [currentHint, setCurrentHint] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [startTime, setStartTime] = useState<number>(0)
  const [streak, setStreak] = useState(0)
  const [mathLiveLoaded, setMathLiveLoaded] = useState(false)
  
  const mathFieldRef = useRef<MathfieldElement | null>(null)
  
  // Load MathLive
  useEffect(() => {
    const loadMathLive = async () => {
      if (typeof window !== 'undefined' && !customElements.get('math-field')) {
        await import('mathlive')
        setMathLiveLoaded(true)
      } else {
        setMathLiveLoaded(true)
      }
    }
    loadMathLive()
  }, [])
  
  // Fetch topics on mount
  useEffect(() => {
    async function fetchTopics() {
      try {
        const response = await fetch('/api/topics')
        const data = await response.json()
        setTopics(data.topics || [])
      } catch (error) {
        console.error('Failed to fetch topics:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTopics()
  }, [])
  
  // Fetch question when topic changes or after submit
  const fetchQuestion = useCallback(async () => {
    if (!selectedTopic && mode !== 'review') return
    
    setLoading(true)
    setSubmitted(false)
    setIsCorrect(null)
    setShowSolution(false)
    setShowHints(false)
    setCurrentHint(0)
    setAnswer('')
    
    try {
      const params = new URLSearchParams()
      if (selectedTopic) params.set('topicId', selectedTopic)
      params.set('limit', '1')
      
      // For review mode, we'd fetch from spaced_repetition
      // For now, just get random questions
      const response = await fetch(`/api/questions?${params}`)
      const data = await response.json()
      
      if (data.questions && data.questions.length > 0) {
        // Get a random question
        const randomIndex = Math.floor(Math.random() * data.questions.length)
        setQuestion(data.questions[randomIndex])
        setStartTime(Date.now())
      } else {
        setQuestion(null)
      }
    } catch (error) {
      console.error('Failed to fetch question:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedTopic, mode])
  
  useEffect(() => {
    if (selectedTopic || mode === 'review') {
      fetchQuestion()
    }
  }, [selectedTopic, mode, fetchQuestion])
  
  // Submit answer
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!question || !answer.trim()) return
    
    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    
    // Simple answer checking - in production, use more sophisticated comparison
    const normalizedAnswer = normalizeLatex(answer)
    const normalizedCorrect = normalizeLatex(question.answer_latex)
    const correct = normalizedAnswer === normalizedCorrect
    
    setIsCorrect(correct)
    setSubmitted(true)
    
    if (correct) {
      setStreak((s) => s + 1)
    } else {
      setStreak(0)
    }
    
    // Record attempt
    try {
      await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          answerLatex: answer,
          isCorrect: correct,
          timeSpentSeconds: timeSpent,
          hintsUsed: currentHint,
        }),
      })
    } catch (error) {
      console.error('Failed to record attempt:', error)
    }
  }
  
  function normalizeLatex(latex: string): string {
    return latex
      .replace(/\s+/g, '')
      .replace(/\\left|\\right/g, '')
      .replace(/\{|\}/g, '')
      .toLowerCase()
  }
  
  function handleNextQuestion() {
    fetchQuestion()
  }
  
  function showNextHint() {
    if (question?.hints_json && currentHint < question.hints_json.length) {
      setShowHints(true)
      setCurrentHint((c) => c + 1)
    }
  }
  
  if (loading && !question) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'review' ? 'Review Session' : 'Practice'}
          </h1>
          <p className="text-gray-600 mt-1">
            {streak > 0 && `🔥 ${streak} in a row!`}
          </p>
        </div>
        
        {mode !== 'review' && (
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Topics</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        )}
      </div>
      
      {!question ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {selectedTopic ? 'No questions available' : 'Select a topic to start'}
          </h3>
          <p className="text-gray-600 mb-4">
            {selectedTopic 
              ? 'Ask your tutor to add some questions to this topic.'
              : 'Choose a topic from the dropdown above to begin practicing.'}
          </p>
          <Link
            href="/student/dashboard"
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Question Card */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">
                {question.topics?.name || 'General'}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                question.difficulty === 'easy'
                  ? 'bg-green-100 text-green-700'
                  : question.difficulty === 'medium'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {question.difficulty}
              </span>
            </div>
            
            <div className="text-lg text-gray-900 mb-6">
              {/* Render LaTeX with KaTeX */}
              <div className="math-content">
                <LatexRenderer content={question.prompt_latex || question.prompt_text} />
              </div>
            </div>
            
            {/* Answer Input */}
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Answer
              </label>
              
              {mathLiveLoaded ? (
                <math-field
                  ref={mathFieldRef}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '18px',
                    minHeight: '50px',
                  }}
                  onInput={(e: React.FormEvent<HTMLElement>) => {
                    const target = e.target as unknown as { value: string }
                    setAnswer(target.value)
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Enter your answer (LaTeX supported)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submitted}
                />
              )}
              
              {!submitted && (
                <div className="flex gap-3 mt-4">
                  <button
                    type="submit"
                    disabled={!answer.trim()}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Check Answer
                  </button>
                  
                  {question.hints_json && question.hints_json.length > 0 && (
                    <button
                      type="button"
                      onClick={showNextHint}
                      disabled={currentHint >= question.hints_json.length}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      💡 Hint ({currentHint}/{question.hints_json.length})
                    </button>
                  )}
                </div>
              )}
            </form>
            
            {/* Hints */}
            {showHints && question.hints_json && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Hints</h4>
                <ul className="space-y-1">
                  {question.hints_json.slice(0, currentHint).map((hint, i) => (
                    <li key={i} className="text-sm text-yellow-700">
                      {i + 1}. {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Result */}
          {submitted && (
            <div className={`rounded-lg shadow-sm border p-6 ${
              isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {isCorrect ? '✓' : '✗'}
                </div>
                <div>
                  <h3 className={`font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                    {isCorrect ? 'Correct!' : 'Not quite right'}
                  </h3>
                  {isCorrect && streak > 1 && (
                    <p className="text-sm text-green-700">
                      {streak} correct in a row! Keep it up! 🔥
                    </p>
                  )}
                </div>
              </div>
              
              {!isCorrect && (
                <div className="mb-4">
                  <p className="text-sm text-red-700 mb-2">Correct answer:</p>
                  <div className="p-3 bg-white rounded border border-red-200">
                    {question.answer_latex}
                  </div>
                </div>
              )}
              
              {!showSolution && question.solution_steps_json && question.solution_steps_json.length > 0 && (
                <button
                  onClick={() => setShowSolution(true)}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Show solution steps
                </button>
              )}
              
              {showSolution && question.solution_steps_json && (
                <div className="mt-4 p-4 bg-white rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-2">Solution Steps</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    {question.solution_steps_json.map((step, i) => (
                      <li key={i} className="text-sm text-gray-700">{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleNextQuestion}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium"
                >
                  Next Question →
                </button>
                
                <Link
                  href="/student/dashboard"
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
                >
                  Done for now
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
