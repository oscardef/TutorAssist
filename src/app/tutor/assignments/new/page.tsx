'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Student {
  id: string
  name: string
}

interface Question {
  id: string
  prompt_text: string
  difficulty: number | null
  topics?: { name: string } | null
}

export default function NewAssignmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [students, setStudents] = useState<Student[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  
  useEffect(() => {
    fetchData()
  }, [])
  
  async function fetchData() {
    try {
      const [studentsRes, questionsRes] = await Promise.all([
        fetch('/api/students'),
        fetch('/api/questions'),
      ])
      
      const studentsData = await studentsRes.json()
      const questionsData = await questionsRes.json()
      
      setStudents(studentsData.students || [])
      setQuestions(questionsData.questions || [])
    } catch (err) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  
  const filteredQuestions = questions.filter(q => 
    q.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.topics?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  const toggleQuestion = (id: string) => {
    setSelectedQuestions(prev => 
      prev.includes(id) 
        ? prev.filter(qId => qId !== id)
        : [...prev, id]
    )
  }
  
  async function handleSubmit(e: React.FormEvent, asDraft = false) {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Please enter a title')
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
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                      <p className="text-sm text-gray-900 line-clamp-2">{question.prompt_text}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        {question.topics?.name && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5">
                            {question.topics.name}
                          </span>
                        )}
                        {question.difficulty && (
                          <span>
                            Difficulty: {question.difficulty}/5
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
                
                {filteredQuestions.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No questions match your search
                  </p>
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
        <div className="flex justify-end gap-3">
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
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create & Activate'}
          </button>
        </div>
      </form>
    </div>
  )
}
