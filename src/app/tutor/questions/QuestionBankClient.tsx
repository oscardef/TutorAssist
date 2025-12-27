'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LatexRenderer from '@/components/latex-renderer'
import { AnswerDisplay, AnswerTypeBadge } from '@/components/answer-display'

interface StudyProgram {
  id: string
  code: string
  name: string
  color: string | null
  grade_levels?: GradeLevel[]
}

interface GradeLevel {
  id: string
  program_id: string
  code: string
  name: string
}

interface Topic {
  id: string
  name: string
  description: string | null
}

interface Question {
  id: string
  topic_id: string | null
  prompt_text: string
  prompt_latex: string | null
  answer_type: 'short_answer' | 'long_answer' | 'numeric' | 'expression' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching' | 'exact'
  correct_answer_json: Record<string, unknown>
  difficulty: number
  grade_level: number | null
  primary_program_id: string | null
  primary_grade_level_id: string | null
  status: string
  origin: string
  tags_json: string[]
  times_attempted: number
  times_correct: number
  parent_question_id: string | null
  created_at: string
  topics?: { name: string } | null
  primary_program?: { id: string; code: string; name: string; color: string | null } | null
  primary_grade_level?: { id: string; code: string; name: string } | null
}

type SortField = 'created_at' | 'difficulty' | 'topic' | 'success_rate'
type SortOrder = 'asc' | 'desc'

export default function QuestionBankClient({ 
  initialQuestions, 
  initialTopics 
}: { 
  initialQuestions: Question[]
  initialTopics: Topic[]
}) {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [topics] = useState<Topic[]>(initialTopics)
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedOrigin, setSelectedOrigin] = useState<string>('')
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [generatingVariant, setGeneratingVariant] = useState<string | null>(null)
  
  // Fetch programs on mount
  useEffect(() => {
    async function fetchPrograms() {
      try {
        const response = await fetch('/api/programs')
        const data = await response.json()
        if (data.programs) {
          setPrograms(data.programs)
        }
      } catch (error) {
        console.error('Failed to fetch programs:', error)
      }
    }
    fetchPrograms()
  }, [])
  
  // Get grade levels for selected program
  const availableGradeLevels = useMemo(() => {
    if (!selectedProgram) return []
    const program = programs.find(p => p.id === selectedProgram)
    return program?.grade_levels || []
  }, [selectedProgram, programs])
  
  // Filtered and sorted questions
  const filteredQuestions = useMemo(() => {
    let result = [...questions]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(q => 
        q.prompt_text.toLowerCase().includes(query) ||
        q.topics?.name?.toLowerCase().includes(query) ||
        q.tags_json?.some((t: string) => t.toLowerCase().includes(query))
      )
    }
    
    // Topic filter
    if (selectedTopic) {
      result = result.filter(q => q.topic_id === selectedTopic)
    }
    
    // Difficulty filter
    if (selectedDifficulty !== '') {
      result = result.filter(q => q.difficulty === selectedDifficulty)
    }
    
    // Status filter
    if (selectedStatus) {
      result = result.filter(q => q.status === selectedStatus)
    }
    
    // Origin filter
    if (selectedOrigin) {
      result = result.filter(q => q.origin === selectedOrigin)
    }
    
    // Program filter
    if (selectedProgram) {
      result = result.filter(q => q.primary_program_id === selectedProgram)
    }
    
    // Grade level filter
    if (selectedGradeLevel) {
      result = result.filter(q => q.primary_grade_level_id === selectedGradeLevel)
    }
    
    // Sorting
    result.sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'difficulty':
          comparison = (a.difficulty || 0) - (b.difficulty || 0)
          break
        case 'topic':
          comparison = (a.topics?.name || '').localeCompare(b.topics?.name || '')
          break
        case 'success_rate':
          const rateA = a.times_attempted > 0 ? a.times_correct / a.times_attempted : 0
          const rateB = b.times_attempted > 0 ? b.times_correct / b.times_attempted : 0
          comparison = rateA - rateB
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    return result
  }, [questions, searchQuery, selectedTopic, selectedDifficulty, selectedStatus, selectedOrigin, selectedProgram, selectedGradeLevel, sortField, sortOrder])
  
  // Stats
  const stats = useMemo(() => {
    const total = questions.length
    const byDifficulty = [0, 0, 0, 0, 0]
    const byOrigin = { manual: 0, ai_generated: 0, imported: 0, variant: 0 }
    const byStatus = { active: 0, archived: 0, draft: 0 }
    
    questions.forEach(q => {
      if (q.difficulty >= 1 && q.difficulty <= 5) {
        byDifficulty[q.difficulty - 1]++
      }
      if (q.origin in byOrigin) {
        byOrigin[q.origin as keyof typeof byOrigin]++
      }
      if (q.status in byStatus) {
        byStatus[q.status as keyof typeof byStatus]++
      }
    })
    
    return { total, byDifficulty, byOrigin, byStatus }
  }, [questions])
  
  // Toggle question selection
  const toggleSelection = (questionId: string) => {
    const newSelection = new Set(selectedQuestions)
    if (newSelection.has(questionId)) {
      newSelection.delete(questionId)
    } else {
      newSelection.add(questionId)
    }
    setSelectedQuestions(newSelection)
    setShowBulkActions(newSelection.size > 0)
  }
  
  // Select all visible questions
  const selectAll = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set())
      setShowBulkActions(false)
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)))
      setShowBulkActions(true)
    }
  }
  
  // Generate variant of a question
  const generateVariant = async (questionId: string, type: 'similar' | 'harder' | 'easier') => {
    setGeneratingVariant(questionId)
    try {
      const response = await fetch('/api/questions/variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, variationType: type })
      })
      
      if (response.ok) {
        // Refresh questions
        const questionsRes = await fetch('/api/questions')
        const questionsData = await questionsRes.json()
        setQuestions(questionsData.questions || [])
      }
    } catch (error) {
      console.error('Failed to generate variant:', error)
    } finally {
      setGeneratingVariant(null)
    }
  }
  
  // Bulk actions
  const handleBulkAction = async (action: 'archive' | 'delete' | 'assign') => {
    if (selectedQuestions.size === 0) return
    
    // For assign, redirect to new assignment page with selected questions
    if (action === 'assign') {
      const questionIds = Array.from(selectedQuestions).join(',')
      router.push(`/tutor/assignments/new?questions=${questionIds}`)
      return
    }
    
    if (action === 'delete' && !confirm(`Delete ${selectedQuestions.size} questions? This cannot be undone.`)) {
      return
    }
    
    try {
      const response = await fetch('/api/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          questionIds: Array.from(selectedQuestions)
        })
      })
      
      if (response.ok) {
        // Refresh questions
        const questionsRes = await fetch('/api/questions')
        const questionsData = await questionsRes.json()
        setQuestions(questionsData.questions || [])
        setSelectedQuestions(new Set())
        setShowBulkActions(false)
      }
    } catch (error) {
      console.error('Bulk action failed:', error)
    }
  }
  
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTopic('')
    setSelectedDifficulty('')
    setSelectedStatus('')
    setSelectedOrigin('')
    setSelectedProgram('')
    setSelectedGradeLevel('')
  }
  
  const hasActiveFilters = searchQuery || selectedTopic || selectedDifficulty !== '' || selectedStatus || selectedOrigin || selectedProgram || selectedGradeLevel
  
  const difficultyLabels = ['Easy', 'Medium-Easy', 'Medium', 'Medium-Hard', 'Hard']
  const difficultyColors = [
    'bg-green-100 text-green-800',
    'bg-lime-100 text-lime-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-800'
  ]
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="mt-1 text-sm text-gray-500">
            {stats.total} questions • {stats.byOrigin.ai_generated} AI generated
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tutor/generate"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            Generate with AI
          </Link>
          <Link
            href="/tutor/syllabus/new"
            className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            Generate Syllabus
          </Link>
          <Link
            href="/tutor/questions/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            + Add Question
          </Link>
        </div>
      </div>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4">
        {difficultyLabels.map((label, index) => (
          <button
            key={label}
            onClick={() => setSelectedDifficulty(selectedDifficulty === index + 1 ? '' : index + 1)}
            className={`p-3 rounded-lg border text-center transition-colors ${
              selectedDifficulty === index + 1 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{stats.byDifficulty[index]}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </button>
        ))}
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
        <div className="flex gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search questions, topics, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Topic Filter */}
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Topics</option>
            {topics.map(topic => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
          
          {/* Program Filter */}
          <select
            value={selectedProgram}
            onChange={(e) => {
              setSelectedProgram(e.target.value)
              setSelectedGradeLevel('')
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Programs</option>
            {programs.map(program => (
              <option key={program.id} value={program.id}>{program.name}</option>
            ))}
          </select>
          
          {/* Grade Level Filter */}
          {selectedProgram && availableGradeLevels.length > 0 && (
            <select
              value={selectedGradeLevel}
              onChange={(e) => setSelectedGradeLevel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Grades</option>
              {availableGradeLevels.map(grade => (
                <option key={grade.id} value={grade.id}>{grade.code} - {grade.name}</option>
              ))}
            </select>
          )}
          
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active ({stats.byStatus.active})</option>
            <option value="draft">Draft ({stats.byStatus.draft})</option>
            <option value="archived">Archived ({stats.byStatus.archived})</option>
          </select>
          
          {/* Origin Filter */}
          <select
            value={selectedOrigin}
            onChange={(e) => setSelectedOrigin(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Origins</option>
            <option value="manual">Manual ({stats.byOrigin.manual})</option>
            <option value="ai_generated">AI Generated ({stats.byOrigin.ai_generated})</option>
            <option value="variant">Variant ({stats.byOrigin.variant})</option>
            <option value="imported">Imported ({stats.byOrigin.imported})</option>
          </select>
          
          {/* Sort */}
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [SortField, SortOrder]
              setSortField(field)
              setSortOrder(order)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="difficulty-asc">Easiest First</option>
            <option value="difficulty-desc">Hardest First</option>
            <option value="topic-asc">Topic A-Z</option>
            <option value="success_rate-desc">Highest Success Rate</option>
            <option value="success_rate-asc">Lowest Success Rate</option>
          </select>
        </div>
        
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-gray-500">
              Showing {filteredQuestions.length} of {questions.length} questions
            </span>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
      
      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-blue-800 font-medium">
            {selectedQuestions.size} questions selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('assign')}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Assignment
            </button>
            <button
              onClick={() => handleBulkAction('archive')}
              className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
            >
              Archive
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => {
                setSelectedQuestions(new Set())
                setShowBulkActions(false)
              }}
              className="px-3 py-1 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Questions List */}
      {filteredQuestions.length > 0 ? (
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center gap-2 px-2">
            <input
              type="checkbox"
              checked={selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0}
              onChange={selectAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">Select all</span>
          </div>
          
          {filteredQuestions.map((question) => {
            const successRate = question.times_attempted > 0 
              ? Math.round((question.times_correct / question.times_attempted) * 100) 
              : null
            
            return (
              <div
                key={question.id}
                className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${
                  selectedQuestions.has(question.id) ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(question.id)}
                    onChange={() => toggleSelection(question.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  
                  <div className="flex-1 min-w-0">
                    {/* Tags row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {question.primary_program && (
                        <span 
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: question.primary_program.color || '#6366f1' }}
                        >
                          {question.primary_program.code}
                        </span>
                      )}
                      {question.primary_grade_level && (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                          {question.primary_grade_level.code}
                        </span>
                      )}
                      {question.topics?.name && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {question.topics.name}
                        </span>
                      )}
                      {question.difficulty && (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${difficultyColors[question.difficulty - 1]}`}>
                          {difficultyLabels[question.difficulty - 1]}
                        </span>
                      )}
                      {!question.primary_grade_level && question.grade_level && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {question.grade_level <= 12 ? `Year ${question.grade_level}` : 
                           question.grade_level === 13 ? 'A-Level' : 
                           question.grade_level === 14 ? 'Uni' : 
                           question.grade_level === 15 ? 'Postgrad' : ''}
                        </span>
                      )}
                      {question.origin === 'ai_generated' && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                          AI Generated
                        </span>
                      )}
                      {question.origin === 'variant' && (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                          Variant
                        </span>
                      )}
                    </div>
                    
                    {/* Question text with LaTeX rendering */}
                    <div className="text-gray-900 font-medium line-clamp-2">
                      <LatexRenderer content={question.prompt_latex || question.prompt_text} />
                    </div>
                    
                    {/* Answer type badge and preview */}
                    <div className="mt-2 flex items-center gap-2">
                      <AnswerTypeBadge answerType={question.answer_type} />
                      <span className="text-sm text-gray-500">•</span>
                      <div className="text-sm text-gray-500 line-clamp-1">
                        <AnswerDisplay 
                          answerType={question.answer_type} 
                          correctAnswer={question.correct_answer_json}
                        />
                      </div>
                    </div>
                    
                    {/* Success rate */}
                    {successRate !== null && (
                      <div className="mt-1 text-sm text-gray-500">
                        {successRate}% success ({question.times_correct}/{question.times_attempted})
                      </div>
                    )}
                    
                    {/* Tags */}
                    {question.tags_json && question.tags_json.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {question.tags_json.slice(0, 5).map((tag: string, i: number) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/tutor/questions/${question.id}`}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
                    >
                      Edit
                    </Link>
                    
                    {/* Variant dropdown */}
                    <div className="relative group">
                      <button
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 w-full flex items-center justify-center gap-1"
                        disabled={generatingVariant === question.id}
                      >
                        {generatingVariant === question.id ? (
                          <span className="animate-spin">⟳</span>
                        ) : (
                          <>
                            <span>Variant</span>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </>
                        )}
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all min-w-[120px]">
                        <button
                          onClick={() => generateVariant(question.id, 'similar')}
                          className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50"
                        >
                          Similar
                        </button>
                        <button
                          onClick={() => generateVariant(question.id, 'easier')}
                          className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50"
                        >
                          Easier
                        </button>
                        <button
                          onClick={() => generateVariant(question.id, 'harder')}
                          className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50"
                        >
                          Harder
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            {hasActiveFilters ? 'No questions match your filters' : 'No questions yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {hasActiveFilters 
              ? 'Try adjusting your filters or search query.'
              : 'Get started by creating questions manually or generating them with AI.'
            }
          </p>
          {!hasActiveFilters && (
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/tutor/questions/new"
                className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Add Manually
              </Link>
              <Link
                href="/tutor/generate"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                Generate with AI
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
