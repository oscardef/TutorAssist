'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  prompt_latex: string | null
  difficulty: number
  grade_level: number | null
  answer_type: string
  correct_answer_json: {
    value: string | number
    latex?: string
    tolerance?: number
    choices?: Array<string | { text: string; latex?: string }>
    correct?: number
    alternates?: string[]
  }
  hints_json: string[] | null
  solution_steps_json: { step: string; result: string }[] | null
  topics: { id: string; name: string } | null
  primary_program?: { code: string; name: string; color: string | null } | null
  primary_grade_level?: { code: string; name: string } | null
}

interface GradeLevel {
  id: string
  code: string
  name: string
}

interface StudyProgram {
  id: string
  code: string
  name: string
  color: string | null
  grade_levels?: GradeLevel[]
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
  study_program?: { id: string; code: string; name: string; color?: string } | null
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

// Practice mode icons and colors
const PRACTICE_MODES = {
  topic: {
    title: 'Practice by Topic',
    description: 'Choose a specific topic to focus on',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    color: 'indigo',
    bgGradient: 'from-indigo-500 to-indigo-600',
  },
  browse: {
    title: 'Choose Questions',
    description: 'Browse and pick specific questions to practice',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-emerald-600',
  },
  review: {
    title: 'Spaced Review',
    description: 'Review questions based on your memory schedule',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    color: 'blue',
    bgGradient: 'from-blue-500 to-blue-600',
  },
  weak: {
    title: 'Strengthen Weak Areas',
    description: 'Focus on topics where you need more practice',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    color: 'amber',
    bgGradient: 'from-amber-500 to-amber-600',
  },
}

export default function PracticePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode') as PracticeMode | null
  const sounds = useSounds()
  const confetti = useConfetti()
  const topicParam = searchParams.get('topic')
  
  // Preload sounds on mount for faster playback
  useEffect(() => {
    sounds.preload()
  }, [sounds])
  
  const [mode, setMode] = useState<PracticeMode>(modeParam || 'select')
  const [loading, setLoading] = useState(true)
  // Students don't choose program - we use their assigned one
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  const [availableGradeLevels, setAvailableGradeLevels] = useState<GradeLevel[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicStats, setTopicStats] = useState<TopicStats[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>(topicParam || '')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  
  // Question history tracking for smart sampling
  const [questionHistory, setQuestionHistory] = useState<Map<string, { attempts: number; correct: number; lastAttempt: Date }>>(new Map())
  
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
          // Auto-select student's grade level as default
          if (profileData.profile.grade_level_id) {
            setSelectedGradeLevel(profileData.profile.grade_level_id)
          }
        }
        
        // Fetch programs to get grade levels for the student's program
        const programsRes = await fetch('/api/programs')
        const programsData = await programsRes.json()
        
        // Set available grade levels based on student's program
        if (profileData.profile?.study_program_id) {
          const studentProgram = programsData.programs?.find(
            (p: StudyProgram) => p.id === profileData.profile.study_program_id
          )
          if (studentProgram?.grade_levels) {
            setAvailableGradeLevels(studentProgram.grade_levels)
          }
        }
        
        // Fetch topics - filter by student's program if they have one
        let topicsUrl = '/api/topics'
        if (profileData.profile?.study_program_id) {
          topicsUrl += `?programId=${profileData.profile.study_program_id}`
        }
        const topicsRes = await fetch(topicsUrl)
        const topicsData = await topicsRes.json()
        setTopics(topicsData.topics || [])
        
        // Fetch student's topic performance
        const statsRes = await fetch('/api/attempts?stats=byTopic')
        const statsData = await statsRes.json()
        if (statsData.topicStats) {
          setTopicStats(statsData.topicStats)
        }
        
        // Fetch question-level history for smart sampling
        const historyRes = await fetch('/api/attempts?stats=byQuestion')
        const historyData = await historyRes.json()
        if (historyData.questionStats) {
          const historyMap = new Map<string, { attempts: number; correct: number; lastAttempt: Date }>()
          for (const stat of historyData.questionStats) {
            historyMap.set(stat.questionId, {
              attempts: stat.total,
              correct: stat.correct,
              lastAttempt: new Date(stat.lastAttempt)
            })
          }
          setQuestionHistory(historyMap)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Smart sampling: prioritize unanswered questions, then questions with lower accuracy
  const smartSampleQuestions = useCallback((allQuestions: Question[], count: number): Question[] => {
    if (allQuestions.length <= count) return allQuestions
    
    // Separate into unanswered and answered questions
    const unanswered: Question[] = []
    const answered: { question: Question; weight: number }[] = []
    
    for (const q of allQuestions) {
      const history = questionHistory.get(q.id)
      if (!history || history.attempts === 0) {
        unanswered.push(q)
      } else {
        // Weight: lower accuracy = higher weight (more likely to be selected)
        // Questions with 0% accuracy get weight 3, 100% accuracy gets weight 0.5
        const accuracy = history.correct / history.attempts
        const weight = 3 - (accuracy * 2.5)
        answered.push({ question: q, weight })
      }
    }
    
    const selected: Question[] = []
    
    // Prioritize unanswered questions (70% of selection if available)
    const unansweredTarget = Math.min(Math.ceil(count * 0.7), unanswered.length)
    const shuffledUnanswered = [...unanswered].sort(() => Math.random() - 0.5)
    selected.push(...shuffledUnanswered.slice(0, unansweredTarget))
    
    // Fill remaining slots with weighted random selection from answered questions
    const remaining = count - selected.length
    if (remaining > 0 && answered.length > 0) {
      // Weighted random selection
      const totalWeight = answered.reduce((sum, a) => sum + a.weight, 0)
      const selectedFromAnswered: Question[] = []
      const availableAnswered = [...answered]
      
      for (let i = 0; i < remaining && availableAnswered.length > 0; i++) {
        let random = Math.random() * totalWeight
        let cumulativeWeight = 0
        
        for (let j = 0; j < availableAnswered.length; j++) {
          cumulativeWeight += availableAnswered[j].weight
          if (random <= cumulativeWeight) {
            selectedFromAnswered.push(availableAnswered[j].question)
            availableAnswered.splice(j, 1)
            break
          }
        }
      }
      selected.push(...selectedFromAnswered)
    }
    
    // Shuffle the final selection
    return selected.sort(() => Math.random() - 0.5)
  }, [questionHistory])

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
        // When practicing by topic, just filter by topic - don't add program/grade filter
        // since the topic already belongs to the correct program/grade
        params.set('topicId', topicId)
      } else if (practiceMode === 'review') {
        params.set('mode', 'review') // Due for spaced repetition
        // For review mode, filter by student's program/grade
        if (studentProfile?.study_program_id) {
          params.set('programId', studentProfile.study_program_id)
        }
        if (studentProfile?.grade_level_id) {
          params.set('gradeLevelId', studentProfile.grade_level_id)
        }
      } else if (practiceMode === 'weak') {
        params.set('mode', 'weak') // Topics with low accuracy
        // For weak areas, filter by student's program/grade
        if (studentProfile?.study_program_id) {
          params.set('programId', studentProfile.study_program_id)
        }
        if (studentProfile?.grade_level_id) {
          params.set('gradeLevelId', studentProfile.grade_level_id)
        }
      }
      
      const response = await fetch(`/api/questions?${params}`)
      const data = await response.json()
      
      if (data.questions && data.questions.length > 0) {
        // Use smart sampling to prioritize unanswered questions
        const sampled = smartSampleQuestions(data.questions, 20)
        setQuestions(sampled)
        setQuestion(sampled[0])
        setStartTime(Date.now())
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setLoading(false)
    }
  }, [studentProfile, smartSampleQuestions])

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
    } else if (question.answer_type === 'true_false') {
      // STRICT validation: only accept exactly "true" or "false"
      const normalizedAnswer = answer.toLowerCase().trim()
      // Handle various storage formats: string "true"/"false", boolean, or number 1/0
      const correctBool = String(correctAnswer.value).toLowerCase() === 'true' || correctAnswer.value === 1
      if (normalizedAnswer === 'true') {
        correct = correctBool === true
      } else if (normalizedAnswer === 'false') {
        correct = correctBool === false
      } else {
        // Anything other than "true" or "false" is incorrect
        correct = false
      }
    } else if (question.answer_type === 'numeric') {
      // Use strict numeric comparison
      correct = compareNumericAnswers(
        answer,
        parseFloat(String(correctAnswer.value))
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
    // Primary weak topics: <60% accuracy with 3+ attempts
    const weakTopics = topicStats.filter(s => s.total >= 3 && s.accuracy < 60)
    // Secondary: topics with room for improvement (<80% accuracy)
    const improvementTopics = topicStats.filter(s => s.total >= 3 && s.accuracy >= 60 && s.accuracy < 80)
    // Calculate total wrong answers across all topics
    const totalWrongAnswers = topicStats.reduce((sum, s) => sum + (s.total - s.correct), 0)
    // Has something to work on if we have weak topics, improvement topics, or any wrong answers
    const hasWeakTopics = weakTopics.length > 0
    const hasSomethingToWorkOn = hasWeakTopics || improvementTopics.length > 0 || totalWrongAnswers > 0
    const totalPracticed = topicStats.reduce((sum, s) => sum + s.total, 0)
    
    // Filter topics based on student's program and selected grade level
    const filteredTopics = topics.filter(topic => {
      // Must match student's program (or no program set)
      if (studentProfile?.study_program_id && topic.program_id !== studentProfile.study_program_id) {
        return false
      }
      // Filter by selected grade level if one is chosen
      if (selectedGradeLevel && topic.grade_level_id !== selectedGradeLevel) {
        return false
      }
      return true
    })
    
    const topicsWithQuestions = filteredTopics.filter(t => (t.questions?.[0]?.count || 0) > 0)
    
    return (
      <div className="max-w-5xl mx-auto px-4">
        {/* Hero Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Practice</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            {studentProfile?.study_program?.name 
              ? `Practicing ${studentProfile.study_program.name}`
              : 'Choose a practice mode to get started'
            }
          </p>
        </div>

        {/* Practice Mode Cards - Primary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Practice by Topic */}
          <button
            onClick={() => document.getElementById('topic-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 text-left text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {PRACTICE_MODES.topic.icon}
              </div>
              <h3 className="font-semibold text-lg mb-1">{PRACTICE_MODES.topic.title}</h3>
              <p className="text-sm text-indigo-100 opacity-90">{PRACTICE_MODES.topic.description}</p>
            </div>
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
          </button>

          {/* Browse & Pick */}
          <button
            onClick={() => {
              setMode('browse')
              fetchBrowseQuestions()
            }}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-left text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {PRACTICE_MODES.browse.icon}
              </div>
              <h3 className="font-semibold text-lg mb-1">{PRACTICE_MODES.browse.title}</h3>
              <p className="text-sm text-emerald-100 opacity-90">{PRACTICE_MODES.browse.description}</p>
            </div>
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
          </button>

          {/* Spaced Review */}
          <button
            onClick={() => startPractice('review')}
            disabled={totalPracticed === 0}
            className={`group relative overflow-hidden rounded-2xl p-6 text-left shadow-lg transition-all ${
              totalPracticed > 0 
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="relative z-10">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform ${
                totalPracticed > 0 ? 'bg-white/20 group-hover:scale-110' : 'bg-gray-200'
              }`}>
                {PRACTICE_MODES.review.icon}
              </div>
              <h3 className="font-semibold text-lg mb-1">{PRACTICE_MODES.review.title}</h3>
              <p className={`text-sm opacity-90 ${totalPracticed > 0 ? 'text-blue-100' : 'text-gray-400'}`}>
                {totalPracticed > 0 ? PRACTICE_MODES.review.description : 'Practice some questions first'}
              </p>
            </div>
            {totalPracticed > 0 && (
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
            )}
          </button>

          {/* Weak Areas */}
          <button
            onClick={() => hasSomethingToWorkOn && startPractice('weak')}
            disabled={!hasSomethingToWorkOn}
            className={`group relative overflow-hidden rounded-2xl p-6 text-left shadow-lg transition-all ${
              hasSomethingToWorkOn 
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="relative z-10">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform ${
                hasSomethingToWorkOn ? 'bg-white/20 group-hover:scale-110' : 'bg-gray-200'
              }`}>
                {PRACTICE_MODES.weak.icon}
              </div>
              <h3 className="font-semibold text-lg mb-1">{PRACTICE_MODES.weak.title}</h3>
              <p className={`text-sm opacity-90 ${hasSomethingToWorkOn ? 'text-amber-100' : 'text-gray-400'}`}>
                {hasWeakTopics 
                  ? `${weakTopics.length} topic${weakTopics.length > 1 ? 's' : ''} need attention`
                  : improvementTopics.length > 0
                  ? `${improvementTopics.length} topic${improvementTopics.length > 1 ? 's' : ''} to improve`
                  : totalWrongAnswers > 0
                  ? `${totalWrongAnswers} question${totalWrongAnswers > 1 ? 's' : ''} to review`
                  : totalPracticed >= 3 ? 'Keep practicing!' : 'Keep practicing to identify areas'
                }
              </p>
            </div>
            {hasSomethingToWorkOn && (
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
            )}
          </button>
        </div>

        {/* Topic Selection Section */}
        <div id="topic-section" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg text-gray-900">Practice by Topic</h2>
                <p className="text-sm text-gray-500">
                  {topicsWithQuestions.length} topic{topicsWithQuestions.length !== 1 ? 's' : ''} available
                </p>
              </div>
              
              {/* Grade Level Filter - Using student's assigned program grade levels */}
              {availableGradeLevels.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Grade:</span>
                  <button
                    onClick={() => setSelectedGradeLevel('')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                      !selectedGradeLevel
                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {availableGradeLevels.map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => setSelectedGradeLevel(grade.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                        selectedGradeLevel === grade.id
                          ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {grade.code}
                      {studentProfile?.grade_level_id === grade.id && (
                        <span className="ml-1 text-xs opacity-60">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {filteredTopics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTopics.map((topic) => {
                  const questionCount = topic.questions?.[0]?.count || 0
                  const stats = topicStats.find(s => s.topicId === topic.id)
                  const hasQuestions = questionCount > 0
                  
                  return (
                    <button
                      key={topic.id}
                      onClick={() => hasQuestions && startPractice('topic', topic.id)}
                      disabled={!hasQuestions}
                      className={`group relative p-4 rounded-xl border text-left transition-all ${
                        hasQuestions
                          ? 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-md active:scale-[0.98]'
                          : 'border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                          {topic.name}
                        </span>
                        {stats && stats.total > 0 && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            stats.accuracy >= 80 ? 'bg-green-100 text-green-700' :
                            stats.accuracy >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            {stats.accuracy}%
                          </span>
                        )}
                      </div>
                      
                      {topic.grade_level && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 mb-2">
                          {topic.grade_level.code}
                        </span>
                      )}
                      
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{questionCount} question{questionCount !== 1 ? 's' : ''}</span>
                        {stats && stats.total > 0 && (
                          <span className="text-xs">
                            {stats.correct}/{stats.total} correct
                          </span>
                        )}
                      </div>
                      
                      {hasQuestions && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-gray-500">
                  {selectedGradeLevel 
                    ? 'No topics found for this grade level. Try selecting "All".'
                    : 'No topics available yet. Your tutor will add practice materials soon.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {topicStats.length > 0 && (
          <div className="mt-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Your Progress</h2>
              <Link 
                href="/student/progress" 
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                View all
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
            <div className="space-y-3">
              {topicStats.slice(0, 5).map((stats) => (
                <div key={stats.topicId} className="bg-white rounded-lg p-3 border border-gray-100">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">{stats.topicName}</span>
                    <span className={`font-semibold ${
                      stats.accuracy >= 80 ? 'text-green-600' :
                      stats.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {stats.accuracy}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        stats.accuracy >= 80 ? 'bg-green-500' :
                        stats.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${stats.accuracy}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {stats.correct} of {stats.total} correct
                  </div>
                </div>
              ))}
            </div>
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
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={backToSelection}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1 group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to practice modes
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Choose Questions</h1>
              <p className="text-gray-600 mt-1">
                {studentProfile?.study_program?.name 
                  ? `Showing questions from ${studentProfile.study_program.name}`
                  : 'Select the questions you want to practice'
                }
              </p>
            </div>
            {selectedQuestionIds.size > 0 && (
              <button
                onClick={startCustomPractice}
                className="hidden sm:flex px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
                Start ({selectedQuestionIds.size})
              </button>
            )}
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={browseSearch}
              onChange={(e) => setBrowseSearch(e.target.value)}
              placeholder="Search questions by text or topic..."
              className="w-full pl-12 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
            />
            {browseSearch && (
              <button
                onClick={() => setBrowseSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Filter Row */}
          <div className="flex flex-wrap items-end gap-4">
            {/* Topic Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Topic</label>
              <select
                value={browseTopicFilter}
                onChange={(e) => setBrowseTopicFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="">All Topics</option>
                {availableTopics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </div>
            
            {/* Sort By */}
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Sort By</label>
              <select
                value={browseSortBy}
                onChange={(e) => setBrowseSortBy(e.target.value as typeof browseSortBy)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="newest">Newest First</option>
                <option value="easiest">Easiest First</option>
                <option value="hardest">Hardest First</option>
                <option value="topic">By Topic</option>
              </select>
            </div>
          </div>
          
          {/* Difficulty Filter Pills */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Difficulty</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 1, label: 'Easy', activeClass: 'bg-green-500 text-white ring-green-300', inactiveClass: 'bg-green-50 text-green-700 hover:bg-green-100' },
                { value: 2, label: 'Medium-Easy', activeClass: 'bg-lime-500 text-white ring-lime-300', inactiveClass: 'bg-lime-50 text-lime-700 hover:bg-lime-100' },
                { value: 3, label: 'Medium', activeClass: 'bg-yellow-500 text-white ring-yellow-300', inactiveClass: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
                { value: 4, label: 'Medium-Hard', activeClass: 'bg-orange-500 text-white ring-orange-300', inactiveClass: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
                { value: 5, label: 'Hard', activeClass: 'bg-red-500 text-white ring-red-300', inactiveClass: 'bg-red-50 text-red-700 hover:bg-red-100' },
              ].map(({ value, label, activeClass, inactiveClass }) => (
                <button
                  key={value}
                  onClick={() => {
                    setBrowseDifficulties(prev => 
                      prev.includes(value) 
                        ? prev.filter(d => d !== value)
                        : [...prev, value]
                    )
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    browseDifficulties.includes(value)
                      ? `${activeClass} ring-2`
                      : inactiveClass
                  }`}
                >
                  {label}
                </button>
              ))}
              {browseDifficulties.length > 0 && (
                <button
                  onClick={() => setBrowseDifficulties([])}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Selection controls */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={toggleSelectAll}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            {selectedQuestionIds.size === filteredBrowseQuestions.length && filteredBrowseQuestions.length > 0
              ? 'Deselect All'
              : 'Select All'
            }
          </button>
          <span className="text-sm text-gray-500">
            {filteredBrowseQuestions.length} question{filteredBrowseQuestions.length !== 1 ? 's' : ''}
            {(browseSearch || browseTopicFilter || browseDifficulties.length > 0) && browseQuestions.length !== filteredBrowseQuestions.length
              ? ` (filtered from ${browseQuestions.length})`
              : ''
            }
          </span>
        </div>
        
        {/* Questions list */}
        {browseLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p className="text-gray-500">Loading questions...</p>
          </div>
        ) : filteredBrowseQuestions.length > 0 ? (
          <div className="space-y-3 pb-24">
            {filteredBrowseQuestions.map((q, index) => (
              <div
                key={q.id}
                onClick={() => toggleQuestionSelection(q.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedQuestionIds.has(q.id)
                    ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 mt-0.5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                    selectedQuestionIds.has(q.id)
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {selectedQuestionIds.has(q.id) && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        q.difficulty <= 2 ? 'bg-green-100 text-green-700' :
                        q.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {q.difficulty <= 2 ? 'Easy' : q.difficulty <= 3 ? 'Medium' : 'Hard'}
                      </span>
                      {q.topics && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {q.topics.name}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-800">
                      <LatexRenderer content={q.prompt_latex || q.prompt_text} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-1">No questions found</p>
            <p className="text-gray-500 text-sm">Try adjusting your filters or search terms</p>
          </div>
        )}
        
        {/* Floating action button */}
        {selectedQuestionIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={startCustomPractice}
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-2xl shadow-xl shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              Start Practice
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">
                {selectedQuestionIds.size} selected
              </span>
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
      <div className="max-w-2xl mx-auto text-center py-12 px-4">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
          mode === 'review' ? 'bg-gradient-to-br from-blue-100 to-blue-200' :
          mode === 'weak' ? 'bg-gradient-to-br from-green-100 to-green-200' :
          'bg-gradient-to-br from-gray-100 to-gray-200'
        }`}>
          {mode === 'review' ? (
            <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : mode === 'weak' ? (
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {mode === 'review' 
            ? "You're All Caught Up!" 
            : mode === 'weak'
            ? "Great Work!"
            : "No Questions Available"
          }
        </h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          {mode === 'review' 
            ? "You've completed all your scheduled reviews. Practice more questions and they'll appear here based on your memory schedule."
            : mode === 'weak'
            ? "You're performing excellently in all topics! No weak areas detected. Keep up the great work!"
            : "No questions found for this topic yet. Try selecting a different topic or check back later."
          }
        </p>
        
        {mode === 'review' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-8 text-left max-w-md mx-auto">
            <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              How Spaced Review Works
            </h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Practice questions to add them to your review schedule
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Questions you get right appear less often
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Questions you struggle with appear more frequently
              </li>
            </ul>
          </div>
        )}
        
        {mode === 'weak' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-left max-w-md mx-auto">
            <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              Areas for Improvement
            </h3>
            <ul className="text-sm text-amber-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                Topics with less than 60% accuracy need attention
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                Topics between 60-80% are shown as improvement areas
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                Questions you&apos;ve gotten wrong will appear for review
              </li>
            </ul>
          </div>
        )}
        
        <button
          onClick={backToSelection}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Choose Another Practice Mode
        </button>
      </div>
    )
  }

  const topicName = topics.find(t => t.id === selectedTopic)?.name || question.topics?.name || 'Practice'

  return (
    <div className="max-w-3xl mx-auto px-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={backToSelection}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1 group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            End session
          </button>
          <h1 className="text-xl font-bold text-gray-900">{topicName}</h1>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-1">
            Question <span className="font-semibold text-gray-800">{currentQuestionIndex + 1}</span>
            <span className="mx-1 text-gray-400">of</span>
            <span className="font-medium">{questions.length}</span>
          </div>
          {streak > 1 && (
            <div className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.75 2.75a.75.75 0 00-1.5 0V4.5H9.276a1.75 1.75 0 00-.985.303L6.596 5.957A.25.25 0 016.455 6H2.353a.75.75 0 100 1.5H3.93L.563 15.18a.762.762 0 00.21.88c.08.064.161.125.309.221.186.121.452.278.792.433.68.311 1.662.62 2.876.62a6.919 6.919 0 002.876-.62c.34-.155.606-.312.792-.433.15-.097.23-.158.31-.223a.75.75 0 00.209-.878L5.569 7.5h.886c.351 0 .694-.106.984-.303l1.696-1.154A.25.25 0 019.275 6h1.975v14.5H6.763a.75.75 0 000 1.5h10.474a.75.75 0 000-1.5H12.75V6h1.974c.05 0 .1.015.14.043l1.697 1.154c.29.197.633.303.984.303h.886l-3.368 7.68a.75.75 0 00.23.896c.012.009 0 0 .002 0a3.154 3.154 0 00.31.206c.185.112.45.256.79.4a7.343 7.343 0 002.855.568 7.343 7.343 0 002.856-.569c.338-.143.604-.287.79-.399a3.5 3.5 0 00.31-.206.75.75 0 00.23-.896L20.07 7.5h1.578a.75.75 0 000-1.5h-4.102a.25.25 0 01-.14-.043l-1.697-1.154a1.75 1.75 0 00-.984-.303H12.75V2.75z" />
              </svg>
              {streak} streak
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="font-medium text-green-600">{sessionStats.correct}</span> correct
          </span>
          <span className={`font-medium ${
            sessionStats.total > 0 
              ? (sessionStats.correct / sessionStats.total) >= 0.7 ? 'text-green-600' : 
                (sessionStats.correct / sessionStats.total) >= 0.5 ? 'text-yellow-600' : 'text-red-600'
              : 'text-gray-400'
          }`}>
            {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}% accuracy
          </span>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Question Header */}
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              question.difficulty <= 2 ? 'bg-green-100 text-green-700' :
              question.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {question.difficulty <= 2 ? 'Easy' : question.difficulty <= 3 ? 'Medium' : 'Hard'}
            </span>
            {question.grade_level && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                {getGradeLevelLabel(question.grade_level)}
              </span>
            )}
          </div>
          
          {/* Flag button */}
          <button
            onClick={() => setShowFlagModal(true)}
            disabled={flagSubmitted}
            className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              flagSubmitted 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
            }`}
            title={flagSubmitted ? 'Flag submitted' : 'Report an issue'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            {flagSubmitted ? 'Flagged' : 'Report'}
          </button>
        </div>

        {/* Question Content */}
        <div className="p-6">
          <div className="prose prose-lg max-w-none mb-8">
            <div className="text-gray-800 leading-relaxed">
              <LatexRenderer content={question.prompt_latex || question.prompt_text} />
            </div>
          </div>

          {/* Answer Input */}
          {question.answer_type === 'multiple_choice' && question.correct_answer_json.choices ? (
            <div className="space-y-3">
              {question.correct_answer_json.choices.map((rawChoice, idx) => {
                // Handle both string and object choice formats
                const choice = typeof rawChoice === 'string' ? { text: rawChoice } : rawChoice
                return (
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
                )
              })}
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
                            <AnswerDisplay
                              answerType={question.answer_type}
                              correctAnswer={question.correct_answer_json}
                            />
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
              isCorrect || claimedCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCorrect || claimedCorrect ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="font-medium">
                    {isCorrect ? 'Correct!' : claimedCorrect ? 'Marked correct!' : 'Not quite right'}
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
                <p className="mt-2 text-sm text-green-700">
                  ✓ This question has been marked correct. Your tutor will review the answer.
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
        <div className="border-t border-gray-100 p-5 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
          <button
            onClick={backToSelection}
            className="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            End Session
          </button>

          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={question.answer_type === 'multiple_choice' ? selectedChoice === null : !answer.trim()}
              className="px-8 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="px-8 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              {currentQuestionIndex < questions.length - 1 ? (
                <>
                  Next Question
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </>
              ) : 'Finish'}
            </button>
          )}
        </div>
      </div>
      
      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Report an Issue</h3>
              <button
                onClick={() => setShowFlagModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-5">
              Help us improve by reporting any issues with this question.
            </p>
            
            {/* Flag Type Selection */}
            <div className="space-y-2 mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">What&apos;s the issue?</label>
              <div className="grid gap-2">
                {[
                  { type: 'incorrect_answer', label: 'The correct answer is wrong', icon: '❌' },
                  { type: 'unclear', label: 'The question is confusing', icon: '❓' },
                  { type: 'typo', label: 'There is a typo', icon: '✏️' },
                  { type: 'too_hard', label: 'Too difficult for this level', icon: '📈' },
                  { type: 'multiple_valid', label: 'Multiple valid answers exist', icon: '🔀' },
                  { type: 'other', label: 'Other issue', icon: '💬' },
                ].map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => setFlagType(type)}
                    className={`text-left px-4 py-3 rounded-xl border-2 text-sm transition-all flex items-center gap-3 ${
                      flagType === type
                        ? 'border-orange-500 bg-orange-50 text-orange-800'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Additional Comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional details (optional)
              </label>
              <textarea
                value={flagComment}
                onChange={(e) => setFlagComment(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                placeholder="Describe the issue in more detail..."
              />
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowFlagModal(false)}
                className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFlag}
                disabled={!flagType || flagSubmitting}
                className="px-5 py-2.5 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
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
