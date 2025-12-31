'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Topic {
  id: string
  name: string
  program_id?: string | null
  grade_level_id?: string | null
}

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
  year_number?: number | null
}

interface Question {
  id: string
  topic_id: string | null
  prompt_text: string
  prompt_latex: string | null
  answer_type: 'exact' | 'numeric' | 'multiple_choice' | 'short_answer' | 'long_answer' | 'expression' | 'true_false' | 'fill_blank' | 'matching'
  correct_answer_json: {
    value: string | number | string[]
    tolerance?: number
    options?: string[]
  }
  difficulty: number
  grade_level: number | null
  primary_program_id: string | null
  primary_grade_level_id: string | null
  hints_json: string[]
  solution_steps_json: Array<string | { step: string; latex?: string; result?: string }>
  tags_json: string[]
  status: string
  topics?: Topic
  primary_program?: { id: string; code: string; name: string; color: string | null } | null
  primary_grade_level?: { id: string; code: string; name: string; year_number?: number | null } | null
}

export default function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [question, setQuestion] = useState<Question | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [topicId, setTopicId] = useState('')
  const [promptText, setPromptText] = useState('')
  const [promptLatex, setPromptLatex] = useState('')
  const [answerType, setAnswerType] = useState<'exact' | 'numeric' | 'multiple_choice'>('exact')
  const [answerValue, setAnswerValue] = useState('')
  const [tolerance, setTolerance] = useState(0)
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [correctOption, setCorrectOption] = useState(0)
  const [difficulty, setDifficulty] = useState(3)
  const [gradeLevel, setGradeLevel] = useState<number | null>(null)
  const [primaryProgramId, setPrimaryProgramId] = useState<string>('')
  const [primaryGradeLevelId, setPrimaryGradeLevelId] = useState<string>('')
  const [hints, setHints] = useState<string[]>([''])
  const [solutionSteps, setSolutionSteps] = useState<string[]>([''])
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState('active')
  
  // Get available grade levels for the selected program
  const availableGradeLevels = primaryProgramId
    ? programs.find(p => p.id === primaryProgramId)?.grade_levels || []
    : []
  
  const fetchData = useCallback(async () => {
    try {
      const [questionsRes, topicsRes, programsRes] = await Promise.all([
        fetch(`/api/questions?id=${id}`),
        fetch('/api/topics'),
        fetch('/api/programs')
      ])
      
      const questionsData = await questionsRes.json()
      const topicsData = await topicsRes.json()
      const programsData = await programsRes.json()
      
      setPrograms(programsData.programs || [])
      
      if (questionsData.question) {
        const q = questionsData.question
        setQuestion(q)
        setTopicId(q.topic_id || '')
        setPromptText(q.prompt_text || '')
        setPromptLatex(q.prompt_latex || '')
        setAnswerType(q.answer_type || 'exact')
        setDifficulty(q.difficulty || 3)
        setGradeLevel(q.grade_level || null)
        setPrimaryProgramId(q.primary_program_id || '')
        setPrimaryGradeLevelId(q.primary_grade_level_id || '')
        // Use correct field names from DB
        setHints(q.hints_json?.length > 0 ? q.hints_json : [''])
        // Handle both string and object formats for solution steps
        const steps = q.solution_steps_json?.map((s: string | { step: string }) => 
          typeof s === 'string' ? s : s.step || ''
        ) || ['']
        setSolutionSteps(steps.length > 0 ? steps : [''])
        setTags(q.tags_json?.join(', ') || '')
        setStatus(q.status || 'active')
        
        // Parse answer based on type
        const answer = q.correct_answer_json
        if (q.answer_type === 'multiple_choice') {
          setOptions(answer.options || ['', '', '', ''])
          setCorrectOption(typeof answer.value === 'number' ? answer.value : 0)
        } else if (q.answer_type === 'numeric') {
          setAnswerValue(String(answer.value || ''))
          setTolerance(answer.tolerance || 0)
        } else {
          setAnswerValue(String(answer.value || ''))
        }
      }
      
      setTopics(topicsData.topics || [])
    } catch {
      setError('Failed to load question')
    } finally {
      setLoading(false)
    }
  }, [id])
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    // Build answer JSON based on type
    let correctAnswerJson
    if (answerType === 'multiple_choice') {
      correctAnswerJson = {
        value: correctOption,
        options: options.filter(o => o.trim())
      }
    } else if (answerType === 'numeric') {
      correctAnswerJson = {
        value: parseFloat(answerValue) || 0,
        tolerance
      }
    } else {
      correctAnswerJson = { value: answerValue }
    }
    
    try {
      const response = await fetch(`/api/questions?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topicId || null,
          prompt_text: promptText,
          prompt_latex: promptLatex || null,
          answer_type: answerType,
          correct_answer_json: correctAnswerJson,
          difficulty,
          grade_level: gradeLevel,
          primary_program_id: primaryProgramId || null,
          primary_grade_level_id: primaryGradeLevelId || null,
          hints: hints.filter(h => h.trim()),
          solution_steps: solutionSteps.filter(s => s.trim()),
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          status,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save question')
      }
      
      router.push('/tutor/questions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }
  
  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) {
      return
    }
    
    try {
      const response = await fetch(`/api/questions?id=${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete question')
      }
      
      router.push('/tutor/questions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question')
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  if (!question) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Question not found</h2>
        <Link href="/tutor/questions" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Questions
        </Link>
      </div>
    )
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link
          href="/tutor/questions"
          className="text-gray-600 hover:text-gray-900 text-sm"
        >
          ← Back to Question Bank
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Edit Question</h1>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          {/* Topic Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topic
            </label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No topic</option>
              {topics.map(topic => (
                <option key={topic.id} value={topic.id}>{topic.name}</option>
              ))}
            </select>
          </div>
          
          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Text *
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the question text..."
              required
            />
          </div>
          
          {/* LaTeX */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LaTeX Expression (optional)
            </label>
            <textarea
              value={promptLatex}
              onChange={(e) => setPromptLatex(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="\frac{x^2 + 3x}{2}"
            />
          </div>
          
          {/* Answer Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer Type
            </label>
            <div className="flex gap-4">
              {(['exact', 'numeric', 'multiple_choice'] as const).map(type => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="answerType"
                    value={type}
                    checked={answerType === type}
                    onChange={(e) => setAnswerType(e.target.value as typeof answerType)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Answer Input */}
          {answerType === 'multiple_choice' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOption === index}
                      onChange={() => setCorrectOption(index)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...options]
                        newOptions[index] = e.target.value
                        setOptions(newOptions)
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${index + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correct Answer *
                </label>
                <input
                  type={answerType === 'numeric' ? 'number' : 'text'}
                  value={answerValue}
                  onChange={(e) => setAnswerValue(e.target.value)}
                  step={answerType === 'numeric' ? 'any' : undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {answerType === 'numeric' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tolerance (±)
                  </label>
                  <input
                    type="number"
                    value={tolerance}
                    onChange={(e) => setTolerance(parseFloat(e.target.value) || 0)}
                    step="any"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty: {['Easy', 'Medium-Easy', 'Medium', 'Medium-Hard', 'Hard'][difficulty - 1]}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          
          {/* Grade Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grade Level
            </label>
            <select
              value={gradeLevel || ''}
              onChange={(e) => setGradeLevel(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not specified</option>
              <optgroup label="Primary">
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
                <option value="5">Year 5</option>
                <option value="6">Year 6</option>
              </optgroup>
              <optgroup label="Secondary">
                <option value="7">Year 7</option>
                <option value="8">Year 8</option>
                <option value="9">Year 9</option>
                <option value="10">Year 10</option>
                <option value="11">Year 11</option>
              </optgroup>
              <optgroup label="Post-16">
                <option value="12">Year 12 (AS)</option>
                <option value="13">Year 13 (A-Level)</option>
              </optgroup>
              <optgroup label="Higher Education">
                <option value="14">University</option>
                <option value="15">Postgraduate</option>
              </optgroup>
            </select>
          </div>
          
          {/* Study Program & Grade Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Study Program
              </label>
              <select
                value={primaryProgramId}
                onChange={(e) => {
                  setPrimaryProgramId(e.target.value)
                  setPrimaryGradeLevelId('') // Reset grade level when program changes
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not specified</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.name} ({program.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Program Grade Level
              </label>
              <select
                value={primaryGradeLevelId}
                onChange={(e) => setPrimaryGradeLevelId(e.target.value)}
                disabled={!primaryProgramId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Not specified</option>
                {availableGradeLevels.map(grade => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name} ({grade.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="needs_review">Needs Review</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          
          {/* Hints */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hints
            </label>
            {hints.map((hint, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => {
                    const newHints = [...hints]
                    newHints[index] = e.target.value
                    setHints(newHints)
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Hint ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setHints(hints.filter((_, i) => i !== index))}
                  className="px-3 py-2 text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setHints([...hints, ''])}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Hint
            </button>
          </div>
          
          {/* Solution Steps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Solution Steps
            </label>
            {solutionSteps.map((step, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <span className="px-3 py-2 text-gray-500">{index + 1}.</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => {
                    const newSteps = [...solutionSteps]
                    newSteps[index] = e.target.value
                    setSolutionSteps(newSteps)
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Step ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setSolutionSteps(solutionSteps.filter((_, i) => i !== index))}
                  className="px-3 py-2 text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSolutionSteps([...solutionSteps, ''])}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Add Step
            </button>
          </div>
          
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="algebra, equations, basics"
            />
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 hover:text-red-800 font-medium"
          >
            Delete Question
          </button>
          <div className="flex gap-3">
            <Link
              href="/tutor/questions"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
