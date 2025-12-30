'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LatexRenderer from '@/components/latex-renderer'
import { AnswerDisplay, AnswerTypeBadge } from '@/components/answer-display'
import { SearchableSelect, SearchableSelectOption } from '@/components/searchable-select'

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
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([])
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [generatingVariant, setGeneratingVariant] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null)
  const [similarQuestions, setSimilarQuestions] = useState<Map<string, { id: string; similarity: number }[]>>(new Map())
  const [loadingSimilar, setLoadingSimilar] = useState<string | null>(null)
  
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
  
  // Convert topics to searchable select options
  const topicOptions: SearchableSelectOption[] = useMemo(() => 
    topics.map(t => ({
      id: t.id,
      label: t.name,
      description: t.description || undefined,
    })),
    [topics]
  )
  
  // Get grade levels for selected program
  const availableGradeLevels = useMemo(() => {
    if (!selectedProgram) return []
    const program = programs.find(p => p.id === selectedProgram)
    return program?.grade_levels || []
  }, [selectedProgram, programs])
  
  // Filtered and sorted questions
  const filteredQuestions = useMemo(() => {
    let result = [...questions]
    
    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(q => 
        q.prompt_text.toLowerCase().includes(query) ||
        q.topics?.name?.toLowerCase().includes(query) ||
        q.tags_json?.some((t: string) => t.toLowerCase().includes(query))
      )
    }
    
    // Multi-topic filter
    if (selectedTopics.length > 0) {
      result = result.filter(q => q.topic_id && selectedTopics.includes(q.topic_id))
    }
    
    // Multi-difficulty filter
    if (selectedDifficulties.length > 0) {
      result = result.filter(q => selectedDifficulties.includes(q.difficulty))
    }
    
    // Only show active questions (removed status filter per requirements)
    result = result.filter(q => q.status === 'active')
    
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
  }, [questions, searchQuery, selectedTopics, selectedDifficulties, selectedProgram, selectedGradeLevel, sortField, sortOrder])
  
  // Stats
  const stats = useMemo(() => {
    const activeQuestions = questions.filter(q => q.status === 'active')
    const total = activeQuestions.length
    const byDifficulty = [0, 0, 0, 0, 0]
    
    activeQuestions.forEach(q => {
      if (q.difficulty >= 1 && q.difficulty <= 5) {
        byDifficulty[q.difficulty - 1]++
      }
    })
    
    return { total, byDifficulty }
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
  
  // Load similar questions
  const loadSimilarQuestions = useCallback(async (questionId: string) => {
    if (similarQuestions.has(questionId)) return
    
    setLoadingSimilar(questionId)
    try {
      const response = await fetch(`/api/questions/similar?id=${questionId}&limit=5&threshold=0.7`)
      const data = await response.json()
      
      if (data.questions) {
        setSimilarQuestions(prev => new Map(prev).set(
          questionId, 
          data.questions.map((q: { id: string; similarity: number }) => ({ id: q.id, similarity: q.similarity }))
        ))
      }
    } catch (error) {
      console.error('Failed to load similar questions:', error)
    } finally {
      setLoadingSimilar(null)
    }
  }, [similarQuestions])
  
  // Bulk actions
  const handleBulkAction = async (action: 'archive' | 'delete' | 'assign') => {
    if (selectedQuestions.size === 0) return
    
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
    setSelectedTopics([])
    setSelectedDifficulties([])
    setSelectedProgram('')
    setSelectedGradeLevel('')
  }
  
  const hasActiveFilters = searchQuery || selectedTopics.length > 0 || selectedDifficulties.length > 0 || selectedProgram || selectedGradeLevel
  const activeFilterCount = [
    selectedTopics.length > 0,
    selectedDifficulties.length > 0,
    !!selectedProgram,
    !!selectedGradeLevel,
  ].filter(Boolean).length
  
  const difficultyLabels = ['Easy', 'Medium-Easy', 'Medium', 'Medium-Hard', 'Hard']
  const difficultyColors = [
    'bg-green-100 text-green-800 border-green-200',
    'bg-lime-100 text-lime-800 border-lime-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-red-100 text-red-800 border-red-200'
  ]
  
  const toggleDifficulty = (level: number) => {
    setSelectedDifficulties(prev => 
      prev.includes(level) 
        ? prev.filter(d => d !== level)
        : [...prev, level]
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="mt-1 text-sm text-gray-500">
            {stats.total} questions
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tutor/questions/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            + Add Question
          </Link>
        </div>
      </div>
      
      {/* Large Search Bar */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search questions by content, topic, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Difficulty Quick Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm font-medium text-gray-700 mr-2">Difficulty:</span>
        {difficultyLabels.map((label, index) => {
          const level = index + 1
          const isSelected = selectedDifficulties.includes(level)
          return (
            <button
              key={label}
              onClick={() => toggleDifficulty(level)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                isSelected 
                  ? `${difficultyColors[index]} ring-2 ring-offset-1 ring-blue-500` 
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {label} ({stats.byDifficulty[index]})
            </button>
          )
        })}
        {selectedDifficulties.length > 0 && (
          <button
            onClick={() => setSelectedDifficulties([])}
            className="text-sm text-gray-500 hover:text-gray-700 ml-2"
          >
            Clear
          </button>
        )}
      </div>
      
      {/* Filters Toggle + Sort */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
        
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all filters
            </button>
          )}
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [SortField, SortOrder]
              setSortField(field)
              setSortOrder(order)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="difficulty-asc">Easiest First</option>
            <option value="difficulty-desc">Hardest First</option>
            <option value="topic-asc">Topic A-Z</option>
            <option value="success_rate-desc">Highest Success</option>
            <option value="success_rate-asc">Lowest Success</option>
          </select>
        </div>
      </div>
      
      {/* Collapsible Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Topics Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topics</label>
              <SearchableSelect
                options={topicOptions}
                selected={selectedTopics}
                onChange={setSelectedTopics}
                placeholder="Search and select topics..."
                multiple={true}
                emptyMessage="No topics found"
              />
            </div>
            
            {/* Program Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value)
                  setSelectedGradeLevel('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Programs</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </div>
            
            {/* Grade Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
              <select
                value={selectedGradeLevel}
                onChange={(e) => setSelectedGradeLevel(e.target.value)}
                disabled={!selectedProgram}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">All Grades</option>
                {availableGradeLevels.map(grade => (
                  <option key={grade.id} value={grade.id}>{grade.code} - {grade.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
      
      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {filteredQuestions.length} of {stats.total} questions
        </span>
      </div>
      
      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between sticky top-0 z-10">
          <span className="text-blue-800 font-medium">
            {selectedQuestions.size} questions selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('assign')}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Assignment
            </button>
            <button
              onClick={() => handleBulkAction('archive')}
              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
            >
              Archive
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => {
                setSelectedQuestions(new Set())
                setShowBulkActions(false)
              }}
              className="px-3 py-1.5 text-gray-600 hover:text-gray-800"
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
            const isExpanded = expandedQuestionId === question.id
            const questionSimilar = similarQuestions.get(question.id)
            
            return (
              <div
                key={question.id}
                className={`bg-white rounded-xl border transition-all ${
                  selectedQuestions.has(question.id) 
                    ? 'ring-2 ring-blue-500 border-blue-300' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.has(question.id)}
                      onChange={() => toggleSelection(question.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    
                    <div className="flex-1 min-w-0">
                      {/* Compact Tags Row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {question.primary_program && (
                          <span 
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: question.primary_program.color || '#6366f1' }}
                          >
                            {question.primary_program.code}
                          </span>
                        )}
                        {question.primary_grade_level && (
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {question.primary_grade_level.code}
                          </span>
                        )}
                        {question.topics?.name && (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {question.topics.name}
                          </span>
                        )}
                        {question.difficulty && (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${difficultyColors[question.difficulty - 1].replace('border-', '').replace('-200', '-800')}`}>
                            {difficultyLabels[question.difficulty - 1]}
                          </span>
                        )}
                        <AnswerTypeBadge answerType={question.answer_type} />
                      </div>
                      
                      {/* Question text */}
                      <div 
                        className={`text-gray-900 cursor-pointer ${isExpanded ? '' : 'line-clamp-2'}`}
                        onClick={() => setExpandedQuestionId(isExpanded ? null : question.id)}
                      >
                        <LatexRenderer content={question.prompt_latex || question.prompt_text} />
                      </div>
                      
                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                          {/* Answer Section */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Answer</h4>
                            <div className="bg-green-50 rounded-lg p-3 text-sm">
                              <AnswerDisplay 
                                answerType={question.answer_type} 
                                correctAnswer={question.correct_answer_json}
                              />
                            </div>
                          </div>
                          
                          {/* Tags */}
                          {question.tags_json && question.tags_json.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Tags</h4>
                              <div className="flex gap-1 flex-wrap">
                                {question.tags_json.map((tag: string, i: number) => (
                                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Similar Questions */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-medium text-gray-700">Similar Questions</h4>
                              {!questionSimilar && (
                                <button
                                  onClick={() => loadSimilarQuestions(question.id)}
                                  disabled={loadingSimilar === question.id}
                                  className="text-xs text-blue-600 hover:text-blue-700"
                                >
                                  {loadingSimilar === question.id ? 'Loading...' : 'Find similar'}
                                </button>
                              )}
                            </div>
                            {questionSimilar && questionSimilar.length > 0 ? (
                              <div className="space-y-1">
                                {questionSimilar.map(sim => {
                                  const simQ = questions.find(q => q.id === sim.id)
                                  if (!simQ) return null
                                  return (
                                    <Link
                                      key={sim.id}
                                      href={`/tutor/questions/${sim.id}`}
                                      className="block text-xs p-2 bg-gray-50 rounded hover:bg-gray-100 truncate"
                                    >
                                      <span className="text-gray-400 mr-2">{Math.round(sim.similarity * 100)}%</span>
                                      {simQ.prompt_text.slice(0, 100)}...
                                    </Link>
                                  )
                                })}
                              </div>
                            ) : questionSimilar ? (
                              <p className="text-xs text-gray-500">No similar questions found</p>
                            ) : null}
                          </div>
                        </div>
                      )}
                      
                      {/* Bottom row: stats + expand toggle */}
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        {successRate !== null && (
                          <span className={successRate >= 70 ? 'text-green-600' : successRate >= 40 ? 'text-yellow-600' : 'text-red-600'}>
                            {successRate}% ({question.times_correct}/{question.times_attempted})
                          </span>
                        )}
                        <button
                          onClick={() => setExpandedQuestionId(isExpanded ? null : question.id)}
                          className="text-blue-600 hover:text-blue-700 text-xs"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/tutor/questions/${question.id}`}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-center font-medium"
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
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
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
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
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
