'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { IconButton, DifficultyDots, ProgressBar, ChoiceList, FeedbackBanner, HintsPanel, SolutionPanel, YourAnswerCard, FlagModal } from '@/components/question-player'
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
        const random = Math.random() * totalWeight
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
    
    const Practice = Icons.practice
    const Book = Icons.book
    const Clock = Icons.clock
    const Target = Icons.target
    const Arrow = Icons.arrowRight

    return (
      <div className="mx-auto max-w-5xl">
        {/* Hero band */}
        <section className="bg-graph-fade -mx-4 -mt-6 px-4 pb-6 pt-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10">
          <div className="animate-rise">
            <h1 className="page-title">Practice</h1>
            <p className="page-subtitle">
              {studentProfile?.study_program?.name ? `${studentProfile.study_program.name} · pick a topic or a mode` : 'Pick a topic or a mode to start'}
            </p>
          </div>

          <div className="animate-rise-2 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ModeTile
              primary
              icon={<Practice className="h-6 w-6" />}
              title="By topic"
              body="Choose what to work on"
              onClick={() => document.getElementById('topic-section')?.scrollIntoView({ behavior: 'smooth' })}
            />
            <ModeTile
              icon={<Clock className="h-6 w-6" />}
              title="Review"
              tip="Questions you missed or haven’t seen for a while come back on a schedule so they stay learned."
              body={totalPracticed > 0 ? 'Questions due to come back' : 'Answer a few questions first'}
              disabled={totalPracticed === 0}
              onClick={() => startPractice('review')}
            />
            <ModeTile
              icon={<Target className="h-6 w-6" />}
              title="Weak spots"
              tip="Topics where your accuracy is under 60%, plus questions you got wrong."
              body={hasWeakTopics
                ? `${weakTopics.length} topic${weakTopics.length > 1 ? 's' : ''} need work`
                : improvementTopics.length > 0
                ? `${improvementTopics.length} topic${improvementTopics.length > 1 ? 's' : ''} to tighten up`
                : totalWrongAnswers > 0
                ? `${totalWrongAnswers} missed question${totalWrongAnswers > 1 ? 's' : ''}`
                : 'Nothing flagged yet'}
              disabled={!hasSomethingToWorkOn}
              onClick={() => hasSomethingToWorkOn && startPractice('weak')}
            />
            <ModeTile
              icon={<Book className="h-6 w-6" />}
              title="Pick questions"
              body="Browse and choose your own"
              onClick={() => { setMode('browse'); fetchBrowseQuestions() }}
            />
          </div>
        </section>

        {/* Topics */}
        <section id="topic-section" className="card mt-8 scroll-mt-6 overflow-hidden">
          <div className="card-header flex-wrap">
            <div>
              <h2 className="card-title">Topics</h2>
              <p className="text-sm text-gray-500 tnum">{topicsWithQuestions.length} with questions</p>
            </div>
            {availableGradeLevels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by year">
                <button type="button" onClick={() => setSelectedGradeLevel('')} className={`chip ${!selectedGradeLevel ? 'chip-brand' : ''}`} aria-pressed={!selectedGradeLevel}>All years</button>
                {availableGradeLevels.map(grade => (
                  <button key={grade.id} type="button" onClick={() => setSelectedGradeLevel(grade.id)} className={`chip ${selectedGradeLevel === grade.id ? 'chip-brand' : ''}`} aria-pressed={selectedGradeLevel === grade.id} title={grade.name}>
                    {grade.code}{studentProfile?.grade_level_id === grade.id ? ' ·' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5">
            {filteredTopics.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTopics.map(topic => {
                  const questionCount = topic.questions?.[0]?.count || 0
                  const stats = topicStats.find(s => s.topicId === topic.id)
                  const hasQuestions = questionCount > 0
                  const acc = stats && stats.total > 0 ? stats.accuracy : null
                  return (
                    <li key={topic.id}>
                      <button
                        type="button"
                        onClick={() => hasQuestions && startPractice('topic', topic.id)}
                        disabled={!hasQuestions}
                        className={`group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${hasQuestions ? 'border-line bg-white hover:border-brand-300 hover:bg-brand-50' : 'border-line bg-paper opacity-60'}`}
                      >
                        <TopicRing value={acc} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold text-ink">{topic.name}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 tnum">
                            <span>{questionCount} question{questionCount !== 1 ? 's' : ''}</span>
                            {topic.grade_level && <span className="chip px-1.5 py-0 text-[10px]">{topic.grade_level.code}</span>}
                          </div>
                        </div>
                        {hasQuestions && <Arrow className="h-5 w-5 flex-shrink-0 text-gray-300 transition-colors group-hover:text-brand-600" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="py-12 text-center">
                <p className="font-bold text-ink">No topics here yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedGradeLevel ? 'Try “All years”.' : 'Your tutor will add topics soon.'}
                </p>
              </div>
            )}
          </div>
        </section>

        {topicStats.length > 0 && (
          <section className="card mt-6">
            <div className="card-header">
              <h2 className="card-title">Your accuracy by topic</h2>
              <Link href="/student/progress" className="btn btn-ghost btn-sm">All progress</Link>
            </div>
            <ul className="divide-y divide-line">
              {topicStats.slice(0, 5).map(stats => (
                <li key={stats.topicId} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-40 truncate text-sm font-semibold text-ink">{stats.topicName}</span>
                  <div className="flex-1"><ProgressBar value={stats.accuracy} tone={stats.accuracy >= 80 ? 'good' : 'brand'} /></div>
                  <span className="w-12 text-right text-sm font-bold text-ink tnum">{stats.accuracy}%</span>
                </li>
              ))}
            </ul>
          </section>
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
              <h1 className="page-title">Choose Questions</h1>
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
                className="hidden sm:flex px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
        <div className="card mb-6 p-5 space-y-4">
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
          <div className="card text-center py-16">
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
              className="px-6 py-3.5 bg-emerald-500 text-white font-semibold rounded-2xl shadow-xl shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
          mode === 'review' ? 'bg-blue-100' :
          mode === 'weak' ? 'bg-green-100' :
          'bg-gray-100'
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
        <h2 className="page-title mb-3">
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
          className="px-6 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Choose Another Practice Mode
        </button>
      </div>
    )
  }

  const topicName = topics.find(t => t.id === selectedTopic)?.name || question.topics?.name || 'Practice'

  const Back = Icons.chevronLeft
  const Flame = Icons.flame
  const Flag = Icons.flag
  const Arrow = Icons.arrowRight
  const Check = Icons.check
  const sessionAccuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : null

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <button type="button" onClick={backToSelection} className="btn btn-secondary btn-sm mt-0.5 !h-10 !w-10 !px-0" aria-label="End session" title="End session">
          <Back className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold text-ink">{topicName}</h1>
          <p className="mt-0.5 text-sm text-gray-600 tnum">Question {currentQuestionIndex + 1} of {questions.length}{sessionAccuracy !== null ? ` · ${sessionAccuracy}% so far` : ''}</p>
        </div>
        {streak > 1 && <span className="chip chip-spark"><Flame className="h-3.5 w-3.5" /> {streak}</span>}
      </div>

      <div className="mb-5">
        <ProgressBar value={((currentQuestionIndex + 1) / Math.max(questions.length, 1)) * 100} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <DifficultyDots level={question.difficulty} />
            {question.grade_level && <span className="chip chip-brand">{getGradeLevelLabel(question.grade_level)}</span>}
          </div>
          <IconButton label={flagSubmitted ? 'Reported' : 'Report a problem with this question'} onClick={() => setShowFlagModal(true)} active={flagSubmitted} disabled={flagSubmitted}>
            <Flag className="h-5 w-5" />
          </IconButton>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-6 text-xl leading-relaxed text-ink">
            <LatexRenderer content={question.prompt_latex || question.prompt_text} />
          </div>

          {question.answer_type === 'multiple_choice' && question.correct_answer_json.choices ? (
            <ChoiceList
              choices={question.correct_answer_json.choices}
              selected={selectedChoice}
              onSelect={setSelectedChoice}
              disabled={submitted}
              correctIndex={question.correct_answer_json.correct}
              answeredIndex={submitted ? selectedChoice : null}
            />
          ) : (
            <div>
              <MathInput
                value={answer}
                onChange={setAnswer}
                disabled={submitted}
                placeholder={question.answer_type === 'numeric' ? 'Enter a number, e.g. 3.14 or 1/2…' : 'Type your answer, e.g. 2x+1 or √2…'}
                onSubmit={() => { if (!submitted && answer.trim()) handleSubmit() }}
                status={submitted ? (isCorrect ? 'correct' : 'incorrect') : undefined}
              />
              {submitted && (
                <YourAnswerCard
                  answer={<LatexRenderer content={formatMathForDisplay(answer)} />}
                  correct={!!isCorrect}
                  correctAnswer={<AnswerDisplay answerType={question.answer_type} correctAnswer={question.correct_answer_json} />}
                />
              )}
            </div>
          )}

          {submitted && (
            <FeedbackBanner
              correct={!!isCorrect}
              message={isCorrect ? 'Correct' : 'Not quite'}
              claimed={claimedCorrect}
              claiming={flagSubmitting}
              onClaim={handleClaimCorrect}
            />
          )}

          {!submitted && question.hints_json && (
            <HintsPanel
              hints={question.hints_json}
              visible={showHints ? visibleHintCount : 0}
              onReveal={() => { setShowHints(true); setVisibleHintCount(1) }}
              onShowNext={() => setVisibleHintCount(prev => prev + 1)}
            />
          )}

          {submitted && question.solution_steps_json && (
            <SolutionPanel steps={question.solution_steps_json} open={showSolution} onOpen={() => setShowSolution(true)} />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line bg-paper px-5 py-4">
          <button type="button" onClick={backToSelection} className="btn btn-ghost">End session</button>
          {!submitted ? (
            <button type="button" onClick={handleSubmit} disabled={question.answer_type === 'multiple_choice' ? selectedChoice === null : !answer.trim()} className="btn btn-primary btn-lg">
              Check answer <Check className="h-5 w-5" />
            </button>
          ) : (
            <button type="button" onClick={nextQuestion} className="btn btn-primary btn-lg">
              {currentQuestionIndex < questions.length - 1 ? <>Next <Arrow className="h-5 w-5" /></> : 'Finish'}
            </button>
          )}
        </div>
      </div>

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

function ModeTile({ icon, title, body, onClick, disabled, primary, tip }: { icon: React.ReactNode; title: string; body: string; onClick: () => void; disabled?: boolean; primary?: boolean; tip?: string }) {
  return (
    <span className="relative block">
    {tip && <span className="absolute right-3 top-3 z-10 text-gray-500"><InfoTip text={tip} /></span>}
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        primary ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700' : 'border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50'
      }`}
    >
      <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-white/15 text-white' : 'bg-brand-100 text-brand-700'}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-extrabold">{title}</span>
        <span className={`block text-sm ${primary ? 'text-white/85' : 'text-gray-500'}`}>{body}</span>
      </span>
    </button>
    </span>
  )
}

function TopicRing({ value }: { value: number | null }) {
  const r = 16
  const c = 2 * Math.PI * r
  const color = value === null ? 'var(--color-paper-deep)' : value >= 80 ? '#2e8b57' : value >= 60 ? 'var(--color-spark-400)' : '#d64545'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0" aria-label={value === null ? 'Not started' : `${value}% accuracy`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-paper-deep)" strokeWidth="4" />
      {value !== null && (
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 22 22)" />
      )}
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--color-ink)">{value === null ? '·' : value}</text>
    </svg>
  )
}
