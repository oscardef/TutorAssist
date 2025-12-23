'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LatexRenderer from '@/components/latex-renderer'

interface Student {
  id: string
  name: string
}

interface Topic {
  id: string
  name: string
}

interface Question {
  id: string
  prompt_text: string
  prompt_latex: string | null
  difficulty: number | null
  topic_id: string | null
  topics?: { name: string } | null
  origin: string
  tags_json: string[]
}

export default function NewAssignmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [students, setStudents] = useState<Student[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [notifyStudent, setNotifyStudent] = useState(true)
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | ''>('')
  const [selectedOrigin, setSelectedOrigin] = useState<string>('')
  
  // Pre-select questions from URL params
  useEffect(() => {
    const preselected = searchParams.get('questions')
    if (preselected) {
      const questionIds = preselected.split(',').filter(Boolean)
      setSelectedQuestions(questionIds)
    }
  }, [searchParams])
  
  useEffect(() => {
    fetchData()
  }, [])
  
  async function fetchData() {
    try {
      const [studentsRes, questionsRes, topicsRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/questions'),
        fetch('/api/topics'),
      ])
      
      const studentsData = await studentsRes.json()
      const questionsData = await questionsRes.json()
      const topicsData = await topicsRes.json()
      
      setStudents(studentsData.students || [])
      setQuestions(questionsData.questions || [])
      setTopics(topicsData.topics || [])
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  
  // Advanced filtering
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
    
    // Origin filter
    if (selectedOrigin) {
      result = result.filter(q => q.origin === selectedOrigin)
    }
    
    return result
  }, [questions, searchQuery, selectedTopic, selectedDifficulty, selectedOrigin])
  
  const hasActiveFilters = searchQuery || selectedTopic || selectedDifficulty !== '' || selectedOrigin
  
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTopic('')
    setSelectedDifficulty('')
    setSelectedOrigin('')
  }
  
  const toggleQuestion = (id: string) => {
    setSelectedQuestions(prev => 
      prev.includes(id) 
        ? prev.filter(qId => qId !== id)
        : [...prev, id]
    )
  }
  
  const selectAllFiltered = () => {
    const filteredIds = filteredQuestions.map(q => q.id)
    const allSelected = filteredIds.every(id => selectedQuestions.includes(id))
    
    if (allSelected) {
      // Deselect all filtered
      setSelectedQuestions(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      // Select all filtered
      setSelectedQuestions(prev => [...new Set([...prev, ...filteredIds])])
    }
  }
  
  const difficultyLabels = ['Easy', 'Medium-Easy', 'Medium', 'Medium-Hard', 'Hard']
  const difficultyColors = [
    'bg-green-100 text-green-800',
    'bg-lime-100 text-lime-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-800'
  ]
  
  async function handleSubmit(e: React.FormEvent, asDraft = false) {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Please enter a title')
      return
    }
    
    if (selectedQuestions.length === 0) {
      setError('Please select at least one question')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          studentProfileId: studentId || null,
          questionIds: selectedQuestions,
          dueAt: dueDate || null,
          settings: {},
          notifyStudent: notifyStudent && !asDraft,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create assignment')
      }
      
      // If not draft, activate the assignment
      if (!asDraft && data.assignment) {
        await fetch('/api/assignments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: data.assignment.id,
            status: 'active',
            notifyStudent: notifyStudent,
          }),
        })
      }
      
      router.push('/tutor/assignments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assignment')
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/tutor/assignments" className="text-gray-600 hover:text-gray-900 text-sm">
          ← Back to Assignments
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Create Assignment</h1>
        <p className="text-gray-600 mt-1">
          Create a practice assignment for your students
        </p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Assignment Details</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Algebra Practice Week 1"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Optional description for the assignment"
            />
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All students</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Question Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              Select Questions ({selectedQuestions.length} selected)
            </h2>
            {selectedQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedQuestions([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear selection
              </button>
            )}
          </div>
          
          {questions.length > 0 ? (
            <>
              {/* Search and Filters */}
              <div className="space-y-3 mb-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search questions, topics, or tags..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {/* Topic Filter */}
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Topics</option>
                    {topics.map(topic => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                  </select>
                  
                  {/* Difficulty Filter */}
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value ? Number(e.target.value) : '')}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Difficulties</option>
                    {difficultyLabels.map((label, index) => (
                      <option key={index} value={index + 1}>{label}</option>
                    ))}
                  </select>
                  
                  {/* Origin Filter */}
                  <select
                    value={selectedOrigin}
                    onChange={(e) => setSelectedOrigin(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Origins</option>
                    <option value="manual">Manual</option>
                    <option value="ai_generated">AI Generated</option>
                    <option value="variant">Variant</option>
                    <option value="imported">Imported</option>
                  </select>
                  
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                
                {/* Select all / Filter summary */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestions.includes(q.id))}
                      onChange={selectAllFiltered}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      Select all {hasActiveFilters ? 'filtered' : ''} ({filteredQuestions.length})
                    </span>
                  </label>
                  {hasActiveFilters && (
                    <span className="text-sm text-gray-500">
                      Showing {filteredQuestions.length} of {questions.length} questions
                    </span>
                  )}
                </div>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredQuestions.map((question) => (
                  <label
                    key={question.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedQuestions.includes(question.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedQuestions.includes(question.id)}
                      onChange={() => toggleQuestion(question.id)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900">
                        <LatexRenderer content={question.prompt_latex || question.prompt_text} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                        {question.topics?.name && (
                          <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5">
                            {question.topics.name}
                          </span>
                        )}
                        {question.difficulty && (
                          <span className={`rounded-full px-2 py-0.5 ${difficultyColors[question.difficulty - 1]}`}>
                            {difficultyLabels[question.difficulty - 1]}
                          </span>
                        )}
                        {question.origin === 'ai_generated' && (
                          <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5">
                            AI
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
                
                {filteredQuestions.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {hasActiveFilters 
                        ? 'No questions match your filters'
                        : 'No questions match your search'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No questions available</p>
              <Link
                href="/tutor/questions/new"
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Add questions first →
              </Link>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyStudent}
                onChange={(e) => setNotifyStudent(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Send email notification to student when activated
              </span>
            </label>
            
            <div className="flex gap-3">
              <Link
                href="/tutor/assignments"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                disabled={saving || selectedQuestions.length === 0}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create & Activate'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
