'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import LatexRenderer from '@/components/latex-renderer'
import MathInput from '@/components/math-input'
import { compareMathAnswers, compareNumericAnswers, formatMathForDisplay } from '@/lib/math-utils'
import { useSounds } from '@/lib/sounds'
import { useConfetti } from '@/lib/confetti'

interface Question {
  id: string
  prompt_text: string
  prompt_latex: string | null
  difficulty: number
  grade_level: number | null
  answer_type: string
  correct_answer_json: {
    value: string | number
    latex?: string
    tolerance?: number
    choices?: { text: string; latex?: string }[]
    correct?: number
    alternates?: string[]
  }
  hints_json: string[] | null
  solution_steps_json: { step: string; result: string }[] | null
  topics: { id: string; name: string } | null
  primary_program?: { code: string; name: string; color: string | null } | null
  primary_grade_level?: { code: string; name: string } | null
}

interface StudyProgram {
  id: string
  code: string
  name: string
  color: string | null
  grade_levels?: { id: string; code: string; name: string }[]
}

interface Topic {
  id: string
  name: string
  program_id: string | null
  grade_level_id: string | null
  questions: { count: number }[]
  program?: { code: string; name: string; color: string | null } | null
  grade_level?: { code: string; name: string } | null
}

interface TopicStats {
  topicId: string
  topicName: string
  total: number
  correct: number
  accuracy: number
}

interface StudentProfile {
  study_program_id: string | null
  grade_level_id: string | null
  study_program?: { id: string; code: string; name: string } | null
  grade_level?: { id: string; code: string; name: string } | null
}

type PracticeMode = 'select' | 'topic' | 'review' | 'weak' | 'browse' | 'custom'

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
  const sounds = useSounds()
  const confetti = useConfetti()
  const topicParam = searchParams.get('topic')
  
  const [mode, setMode] = useState<PracticeMode>(modeParam || 'select')
  const [loading, setLoading] = useState(true)
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicStats, setTopicStats] = useState<TopicStats[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>(topicParam || '')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  
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
  
  // Flagging state
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagType, setFlagType] = useState<string>('')
  const [flagComment, setFlagComment] = useState('')
  const [flagSubmitting, setFlagSubmitting] = useState(false)
  const [flagSubmitted, setFlagSubmitted] = useState(false)
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null)
  const [claimedCorrect, setClaimedCorrect] = useState(false)
  
  // Browse/select questions state
  const [browseQuestions, setBrowseQuestions] = useState<Question[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseSearch, setBrowseSearch] = useState('')
  const [browseTopicFilter, setBrowseTopicFilter] = useState<string>('')
  const [browseDifficulties, setBrowseDifficulties] = useState<number[]>([])
  const [browseSortBy, setBrowseSortBy] = useState<'newest' | 'easiest' | 'hardest' | 'topic'>('newest')

  // Fetch topics and stats on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Fetch student profile to get their program/grade
        const profileRes = await fetch('/api/students/profile')
        const profileData = await profileRes.json()
        if (profileData.profile) {
          setStudentProfile(profileData.profile)
          // Auto-select student's program if they have one
          if (profileData.profile.study_program_id) {
            setSelectedProgram(profileData.profile.study_program_id)
          }
          if (profileData.profile.grade_level_id) {
            setSelectedGradeLevel(profileData.profile.grade_level_id)
          }
        }
        
        // Fetch programs
        const programsRes = await fetch('/api/programs')
        const programsData = await programsRes.json()
        setPrograms(programsData.programs || [])
        
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
      
      // Filter by student's program and grade level
      if (studentProfile?.study_program_id) {
        params.set('programId', studentProfile.study_program_id)
      }
      if (studentProfile?.grade_level_id) {
        params.set('gradeLevelId', studentProfile.grade_level_id)
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
  }, [studentProfile])

  // Start practice when mode/topic changes
  useEffect(() => {
    if (mode === 'topic' && selectedTopic) {
      fetchQuestions('topic', selectedTopic)
    } else if (mode === 'review') {
      fetchQuestions('review')
    } else if (mode === 'weak') {
      fetchQuestions('weak')
    }
    // Note: 'custom' mode is handled in startCustomPractice which sets questions directly
  }, [mode, selectedTopic, fetchQuestions])
  
  // Fetch questions for browsing - always filtered by student's program
  async function fetchBrowseQuestions(topicId?: string) {
    setBrowseLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      
      // ALWAYS filter by student's program - this is mandatory for students
      if (studentProfile?.study_program_id) {
        params.set('programId', studentProfile.study_program_id)
      }
      
      if (topicId) {
        params.set('topicId', topicId)
      }
      
      const response = await fetch(`/api/questions?${params}`)
      const data = await response.json()
      setBrowseQuestions(data.questions || [])
    } catch (error) {
      console.error('Failed to fetch browse questions:', error)
    } finally {
      setBrowseLoading(false)
    }
  }
  
  // Get filtered/sorted questions for display
  const filteredBrowseQuestions = useMemo(() => {
    let result = [...browseQuestions]
    
    // Text search across question text, topic name, and tags
    if (browseSearch.trim()) {
      const query = browseSearch.toLowerCase()
      result = result.filter(q => 
        q.prompt_text.toLowerCase().includes(query) ||
        q.prompt_latex?.toLowerCase().includes(query) ||
        q.topics?.name.toLowerCase().includes(query)
      )
    }
    
    // Topic filter
    if (browseTopicFilter) {
      result = result.filter(q => q.topics?.id === browseTopicFilter)
    }
    
    // Multi-difficulty filter
    if (browseDifficulties.length > 0) {
      result = result.filter(q => browseDifficulties.includes(q.difficulty))
    }
    
    // Sorting
    switch (browseSortBy) {
      case 'easiest':
        result.sort((a, b) => a.difficulty - b.difficulty)
        break
      case 'hardest':
        result.sort((a, b) => b.difficulty - a.difficulty)
        break
      case 'topic':
        result.sort((a, b) => (a.topics?.name || '').localeCompare(b.topics?.name || ''))
        break
      case 'newest':
      default:
        // Keep original order (newest first from API)
        break
    }
    
    return result
  }, [browseQuestions, browseSearch, browseTopicFilter, browseDifficulties, browseSortBy])
  
  // Toggle question selection
  function toggleQuestionSelection(questionId: string) {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }
  
  // Select/deselect all questions
  function toggleSelectAll() {
    // Use filteredBrowseQuestions for selection
    if (selectedQuestionIds.size === filteredBrowseQuestions.length && filteredBrowseQuestions.length > 0) {
      setSelectedQuestionIds(new Set())
    } else {
      setSelectedQuestionIds(new Set(filteredBrowseQuestions.map(q => q.id)))
    }
  }
  
  // Start practice with selected questions
  function startCustomPractice() {
    if (selectedQuestionIds.size === 0) return
    
    const selected = browseQuestions.filter(q => selectedQuestionIds.has(q.id))
    const shuffled = [...selected].sort(() => Math.random() - 0.5)
    setQuestions(shuffled)
    setQuestion(shuffled[0])
    setCurrentQuestionIndex(0)
    setSessionStats({ total: 0, correct: 0 })
    setStreak(0)
    setStartTime(Date.now())
    setMode('custom')
    
    router.push('/student/practice?mode=custom')
  }

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
    setShowFlagModal(false)
    setFlagType('')
    setFlagComment('')
    setFlagSubmitted(false)
    setCurrentAttemptId(null)
    setClaimedCorrect(false)
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
      // Use robust numeric comparison
      correct = compareNumericAnswers(
        answer,
        parseFloat(String(correctAnswer.value)),
        correctAnswer.tolerance || 0.01
      )
    } else {
      // Use robust math answer comparison (handles LaTeX, Unicode, alternates)
      correct = compareMathAnswers(
        answer,
        String(correctAnswer.value),
        correctAnswer.alternates
      )
    }

    setIsCorrect(correct)
    setSubmitted(true)
    setSessionStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (correct ? 1 : 0)
    }))

    // Record attempt
    try {
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      const response = await fetch('/api/attempts', {
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
      const data = await response.json()
      if (data.attempt?.id) {
        setCurrentAttemptId(data.attempt.id)
      }
      
      // Play sound effects and confetti after state is updated
      if (correct) {
        sounds.playCorrect()
        confetti.fireCorrect()
        const newStreak = streak + 1
        setStreak(newStreak)
        if (newStreak >= 3) {
          confetti.fireStreak(newStreak)
          sounds.playStreak(newStreak)
        }
      } else {
        sounds.playIncorrect()
        setStreak(0)
      }
    } catch (error) {
      console.error('Failed to record attempt:', error)
      // Still play sounds even if API fails
      if (correct) {
        sounds.playCorrect()
        confetti.fireCorrect()
      } else {
        sounds.playIncorrect()
      }
    }
  }
  
  // Handle "I was right" claim
  async function handleClaimCorrect() {
    if (!question || !currentAttemptId || claimedCorrect) return
    
    setFlagSubmitting(true)
    try {
      const response = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          flagType: 'claim_correct',
          comment: 'Student claims their answer was marked incorrectly',
          studentAnswer: answer,
          attemptId: currentAttemptId,
        }),
      })
      
      if (response.ok) {
        setClaimedCorrect(true)
        // Update local state to show as "pending review"
      }
    } catch (error) {
      console.error('Failed to claim correct:', error)
    } finally {
      setFlagSubmitting(false)
    }
  }
  
  // Handle flagging question
  async function handleSubmitFlag() {
    if (!question || !flagType) return
    
    setFlagSubmitting(true)
    try {
      const response = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          flagType: flagType,
          comment: flagComment || null,
          studentAnswer: answer || null,
          attemptId: currentAttemptId || null,
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
    const totalPracticed = topicStats.reduce((sum, s) => sum + s.total, 0)
    
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
                  {totalPracticed > 0 
                    ? "Review questions due for repetition to strengthen your memory."
                    : "Practice some questions first to build your review schedule."
                  }
                </p>
                {totalPracticed === 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    Start by practicing questions from a topic below
                  </p>
                )}
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
                    : totalPracticed >= 3 
                      ? "Great job! You're doing well in all topics you've practiced."
                      : 'Complete more questions to identify areas for improvement.'
                  }
                </p>
                {!hasWeakTopics && totalPracticed > 0 && totalPracticed < 10 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Keep practicing to build more statistics
                  </p>
                )}
              </div>
            </div>
          </button>
          
          {/* Browse & Pick Questions */}
          <button
            onClick={() => {
              setMode('browse')
              fetchBrowseQuestions()
            }}
            className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-green-300 hover:shadow-md transition-all group md:col-span-2"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Browse & Pick Questions</h3>
                <p className="text-sm text-gray-600">
                  View all available questions and select specific ones you want to practice.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Topic Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Practice by Topic</h2>
          
          {/* Program Filter */}
          {programs.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedProgram('')
                  setSelectedGradeLevel('')
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  !selectedProgram
                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Programs
              </button>
              {programs.map(program => (
                <button
                  key={program.id}
                  onClick={() => {
                    setSelectedProgram(program.id)
                    setSelectedGradeLevel('')
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                    selectedProgram === program.id
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: program.color || '#6366f1' }}
                  />
                  {program.name}
                </button>
              ))}
            </div>
          )}
          
          {/* Grade Level Filter */}
          {selectedProgram && (() => {
            const program = programs.find(p => p.id === selectedProgram)
            const gradeLevels = program?.grade_levels || []
            if (gradeLevels.length === 0) return null
            return (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGradeLevel('')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    !selectedGradeLevel
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-500'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Grades
                </button>
                {gradeLevels.map(grade => (
                  <button
                    key={grade.id}
                    onClick={() => setSelectedGradeLevel(grade.id)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      selectedGradeLevel === grade.id
                        ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {grade.code}
                  </button>
                ))}
              </div>
            )
          })()}
          
          {(() => {
            // Filter topics based on selected program/grade
            const filteredTopics = topics.filter(topic => {
              if (selectedProgram && topic.program_id !== selectedProgram) return false
              if (selectedGradeLevel && topic.grade_level_id !== selectedGradeLevel) return false
              return true
            })
            
            return filteredTopics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTopics.map((topic) => {
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
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-medium text-gray-900">{topic.name}</span>
                        {topic.program && (
                          <span 
                            className="px-1.5 py-0.5 text-xs rounded text-white ml-2 shrink-0"
                            style={{ backgroundColor: topic.program.color || '#6366f1' }}
                          >
                            {topic.program.code}
                          </span>
                        )}
                      </div>
                      {topic.grade_level && (
                        <div className="text-xs text-indigo-600 mb-1">{topic.grade_level.code}</div>
                      )}
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
                {selectedProgram || selectedGradeLevel 
                  ? 'No topics found for the selected filters.'
                  : 'No topics available. Your tutor will add practice materials soon.'
                }
              </p>
            )
          })()}
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
  
  // Browse mode - select specific questions
  if (mode === 'browse') {
    // Get topics that are available for student's program
    const availableTopics = topics.filter(t => 
      !studentProfile?.study_program_id || t.program_id === studentProfile.study_program_id
    )
    
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={backToSelection}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Browse & Pick Questions</h1>
            <p className="text-gray-600 mt-1">
              {studentProfile?.study_program?.name 
                ? `Showing questions from ${studentProfile.study_program.name}`
                : 'Select the questions you want to practice.'
              }
            </p>
          </div>
          {selectedQuestionIds.size > 0 && (
            <button
              onClick={startCustomPractice}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Start Practice ({selectedQuestionIds.size} selected)
            </button>
          )}
        </div>
        
        {/* Search and Filters - Similar to QB */}
        <div className="mb-6 bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={browseSearch}
              onChange={(e) => setBrowseSearch(e.target.value)}
              placeholder="Search questions by text or topic..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {browseSearch && (
              <button
                onClick={() => setBrowseSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Topic Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Topic</label>
              <select
                value={browseTopicFilter}
                onChange={(e) => setBrowseTopicFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Topics</option>
                {availableTopics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </div>
            
            {/* Sort By */}
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
              <select
                value={browseSortBy}
                onChange={(e) => setBrowseSortBy(e.target.value as typeof browseSortBy)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="newest">Newest</option>
                <option value="easiest">Easiest First</option>
                <option value="hardest">Hardest First</option>
                <option value="topic">By Topic</option>
              </select>
            </div>
          </div>
          
          {/* Difficulty Filter Pills */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Difficulty</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 1, label: 'Easy', color: 'green' },
                { value: 2, label: 'Medium-Easy', color: 'lime' },
                { value: 3, label: 'Medium', color: 'yellow' },
                { value: 4, label: 'Medium-Hard', color: 'orange' },
                { value: 5, label: 'Hard', color: 'red' },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => {
                    setBrowseDifficulties(prev => 
                      prev.includes(value) 
                        ? prev.filter(d => d !== value)
                        : [...prev, value]
                    )
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    browseDifficulties.includes(value)
                      ? color === 'green' ? 'bg-green-500 text-white ring-2 ring-green-300' :
                        color === 'lime' ? 'bg-lime-500 text-white ring-2 ring-lime-300' :
                        color === 'yellow' ? 'bg-yellow-500 text-white ring-2 ring-yellow-300' :
                        color === 'orange' ? 'bg-orange-500 text-white ring-2 ring-orange-300' :
                        'bg-red-500 text-white ring-2 ring-red-300'
                      : color === 'green' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                        color === 'lime' ? 'bg-lime-100 text-lime-700 hover:bg-lime-200' :
                        color === 'yellow' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                        color === 'orange' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                        'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {label}
                </button>
              ))}
              {browseDifficulties.length > 0 && (
                <button
                  onClick={() => setBrowseDifficulties([])}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Selection controls */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={toggleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {selectedQuestionIds.size === filteredBrowseQuestions.length && filteredBrowseQuestions.length > 0
              ? 'Deselect All'
              : 'Select All'
            }
          </button>
          <span className="text-sm text-gray-500">
            {filteredBrowseQuestions.length} questions
            {browseSearch || browseTopicFilter || browseDifficulties.length > 0 
              ? ` (filtered from ${browseQuestions.length})`
              : ' available'
            }
          </span>
        </div>
        
        {/* Questions list */}
        {browseLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredBrowseQuestions.length > 0 ? (
          <div className="space-y-3">
            {filteredBrowseQuestions.map((q, index) => (
              <div
                key={q.id}
                onClick={() => toggleQuestionSelection(q.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedQuestionIds.has(q.id)
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 ${
                    selectedQuestionIds.has(q.id)
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300'
                  }`}>
                    {selectedQuestionIds.has(q.id) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-gray-400">#{index + 1}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        q.difficulty <= 2 ? 'bg-green-100 text-green-700' :
                        q.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {q.difficulty <= 2 ? 'Easy' : q.difficulty <= 3 ? 'Medium' : 'Hard'}
                      </span>
                      {q.topics && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {q.topics.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 line-clamp-2">
                      <LatexRenderer content={q.prompt_latex || q.prompt_text} />
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-gray-500">No questions found. Try selecting a different topic.</p>
          </div>
        )}
        
        {/* Floating action button */}
        {selectedQuestionIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={startCustomPractice}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-full shadow-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              Start Practice with {selectedQuestionIds.size} Question{selectedQuestionIds.size !== 1 ? 's' : ''}
            </button>
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
          {mode === 'review' ? (
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : mode === 'weak' ? (
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
          )}
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {mode === 'review' 
            ? "You're All Caught Up!" 
            : mode === 'weak'
            ? "Great Work!"
            : "No Questions Available"
          }
        </h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {mode === 'review' 
            ? "You've completed all your scheduled reviews. Questions will appear here after you practice more - they're scheduled based on how well you remember them."
            : mode === 'weak'
            ? "You're performing well in all topics! Keep practicing to maintain your skills. Weak areas are identified after you've attempted at least 3 questions per topic."
            : "No questions found for this topic yet. Try selecting a different topic or checking back later."
          }
        </p>
        
        {mode === 'review' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
            <h3 className="text-sm font-medium text-blue-800 mb-1">How Spaced Review Works:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Practice questions to add them to your review schedule</li>
              <li>• Questions you get right appear less often</li>
              <li>• Questions you struggle with appear more frequently</li>
              <li>• Check back later for new reviews</li>
            </ul>
          </div>
        )}
        
        {mode === 'weak' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
            <h3 className="text-sm font-medium text-green-800 mb-1">Weak Areas Detection:</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Topics with less than 60% accuracy are flagged</li>
              <li>• Requires at least 3 attempts per topic</li>
              <li>• Practice more questions to build your statistics</li>
            </ul>
          </div>
        )}
        
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
          
          {/* Flag button */}
          <button
            onClick={() => setShowFlagModal(true)}
            disabled={flagSubmitted}
            className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
              flagSubmitted 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
            }`}
            title={flagSubmitted ? 'Flag submitted' : 'Report an issue'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            {flagSubmitted ? 'Flagged' : 'Flag'}
          </button>
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
                  <LatexRenderer content={choice.latex || choice.text} />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <MathInput
                value={answer}
                onChange={setAnswer}
                disabled={submitted}
                placeholder={question.answer_type === 'numeric' ? 'Enter a number (e.g., 3.14, 1/2)' : 'Type your answer (e.g., 2x+1, √2)'}
                onSubmit={() => {
                  if (!submitted && answer.trim()) {
                    handleSubmit()
                  }
                }}
                status={submitted ? (isCorrect ? 'correct' : 'incorrect') : undefined}
              />
              
              {submitted && (
                <div className={`mt-4 p-3 rounded-lg ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600">
                        Your answer: <span className="font-semibold"><LatexRenderer content={formatMathForDisplay(answer)} /></span>
                      </p>
                      {!isCorrect && (
                        <p className="text-sm mt-1">
                          Correct answer: <span className="font-semibold text-green-700">
                            <LatexRenderer content={
                              question.correct_answer_json.latex || 
                              formatMathForDisplay(String(question.correct_answer_json.value || ''))
                            } />
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {submitted && (
            <div className={`mt-4 p-4 rounded-lg ${
              isCorrect ? 'bg-green-50 text-green-800' : claimedCorrect ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : claimedCorrect ? (
                    <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="font-medium">
                    {isCorrect ? 'Correct!' : claimedCorrect ? 'Under review' : 'Not quite right'}
                  </span>
                </div>
                
                {/* "I was right" button - only show when marked incorrect */}
                {!isCorrect && !claimedCorrect && (
                  <button
                    onClick={handleClaimCorrect}
                    disabled={flagSubmitting}
                    className="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                  >
                    {flagSubmitting ? 'Submitting...' : 'I was right'}
                  </button>
                )}
              </div>
              
              {claimedCorrect && (
                <p className="mt-2 text-sm text-yellow-700">
                  Your claim has been submitted for review. Your tutor will check if your answer should be accepted.
                </p>
              )}
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
      
      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Report an Issue</h3>
              <button
                onClick={() => setShowFlagModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Help us improve by reporting any issues with this question.
            </p>
            
            {/* Flag Type Selection */}
            <div className="space-y-2 mb-4">
              <label className="block text-sm font-medium text-gray-700">What&apos;s the issue?</label>
              <div className="grid gap-2">
                {[
                  { type: 'incorrect_answer', label: 'The correct answer is wrong' },
                  { type: 'unclear', label: 'The question is confusing' },
                  { type: 'typo', label: 'There is a typo' },
                  { type: 'too_hard', label: 'Too difficult for this level' },
                  { type: 'multiple_valid', label: 'Multiple valid answers exist' },
                  { type: 'other', label: 'Other issue' },
                ].map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => setFlagType(type)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
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
            
            {/* Additional Comment */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional details (optional)
              </label>
              <textarea
                value={flagComment}
                onChange={(e) => setFlagComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the issue in more detail..."
              />
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowFlagModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFlag}
                disabled={!flagType || flagSubmitting}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
