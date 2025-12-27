'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Topic {
  id: string
  name: string
  description: string | null
  questions?: { count: number }[]
  program?: { id: string; name: string; code: string } | null
  grade_level?: { id: string; name: string; code: string } | null
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
  code: string
  name: string
  program_id: string
}

interface Student {
  id: string
  name: string
  email: string | null
  study_program_id: string | null
  grade_level_id: string | null
}

type GenerationType = 'questions' | 'topics' | 'assignment'

export default function GeneratePage() {
  const router = useRouter()
  
  // Core state
  const [generationType, setGenerationType] = useState<GenerationType>('questions')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Data state
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [students, setStudents] = useState<Student[]>([])
  
  // Job tracking
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  
  // Filter state
  const [selectedProgram, setSelectedProgram] = useState<string>('')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  
  // Question generation options
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState(5)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed')
  const [questionTypes, setQuestionTypes] = useState<string[]>(['multiple_choice', 'short_answer'])
  const [includeWorkedSolutions, setIncludeWorkedSolutions] = useState(true)
  const [includeHints, setIncludeHints] = useState(true)
  const [realWorldContext, setRealWorldContext] = useState(false)
  const [examStyle, setExamStyle] = useState(false)
  const [customInstructions, setCustomInstructions] = useState('')
  const [useBatchApi, setUseBatchApi] = useState(false)
  
  // Topic/Syllabus generation options
  const [syllabusName, setSyllabusName] = useState('')
  const [syllabusDescription, setSyllabusDescription] = useState('')
  const [syllabusTopicCount, setSyllabusTopicCount] = useState<number | null>(null)
  const [syllabusDepth, setSyllabusDepth] = useState<'overview' | 'standard' | 'detailed'>('standard')
  const [includeSubtopics, setIncludeSubtopics] = useState(true)
  const [includeLearningObjectives, setIncludeLearningObjectives] = useState(true)
  const [sourceProgram, setSourceProgram] = useState<string>('')
  const [sourceGradeLevel, setSourceGradeLevel] = useState<string>('')
  const [syllabusCustomPrompt, setSyllabusCustomPrompt] = useState('')
  
  // Assignment generation options
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentQuestionCount, setAssignmentQuestionCount] = useState(10)
  const [assignmentDifficulty, setAssignmentDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive'>('adaptive')
  const [assignmentDueDate, setAssignmentDueDate] = useState('')
  const [assignmentInstructions, setAssignmentInstructions] = useState('')
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [showResultsImmediately, setShowResultsImmediately] = useState(false)

  // Available grade levels based on selected program
  const availableGradeLevels = selectedProgram
    ? programs.find(p => p.id === selectedProgram)?.grade_levels || []
    : programs.flatMap(p => p.grade_levels || [])
    
  const sourceGradeLevels = sourceProgram
    ? programs.find(p => p.id === sourceProgram)?.grade_levels || []
    : []

  // Filtered topics based on selected program/grade
  const filteredTopics = topics.filter(topic => {
    if (selectedProgram && topic.program?.id !== selectedProgram) return false
    if (selectedGradeLevel && topic.grade_level?.id !== selectedGradeLevel) return false
    return true
  })
  
  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch('/api/programs').then(r => r.json()),
      fetch('/api/topics').then(r => r.json()),
      fetch('/api/students').then(r => r.json()),
    ]).then(([programsData, topicsData, studentsData]) => {
      setPrograms(programsData.programs || [])
      setTopics(topicsData.topics || [])
      setStudents(studentsData.students || [])
      setLoading(false)
    }).catch(() => {
      setError('Failed to load data')
      setLoading(false)
    })
  }, [])
  
  // Poll job status
  useEffect(() => {
    if (!jobId) return
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/questions/generate?jobId=${jobId}`)
        const data = await response.json()
        
        setJobStatus(data.status)
        
        if (data.status === 'completed') {
          setSuccess(`Successfully generated ${data.result?.questionsGenerated || questionCount} questions!`)
          setJobId(null)
          setGenerating(false)
        } else if (data.status === 'failed') {
          setError(data.error || 'Generation failed')
          setJobId(null)
          setGenerating(false)
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [jobId, questionCount])

  // Handle topic selection
  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) 
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    )
  }, [])
  
  const selectAllTopics = useCallback(() => {
    setSelectedTopics(filteredTopics.map(t => t.id))
  }, [filteredTopics])
  
  const clearTopics = useCallback(() => {
    setSelectedTopics([])
  }, [])

  // Toggle student selection
  const toggleStudent = useCallback((studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }, [])

  // Handle question type toggle
  const toggleQuestionType = useCallback((type: string) => {
    setQuestionTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }, [])

  // Generate questions
  async function handleGenerateQuestions() {
    if (selectedTopics.length === 0) {
      setError('Please select at least one topic')
      return
    }
    
    setGenerating(true)
    setError(null)
    setSuccess(null)
    
    try {
      // If multiple topics, we'll need to generate for each (or use bulk endpoint)
      const response = await fetch('/api/questions/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicIds: selectedTopics,
          countPerTopic: Math.ceil(questionCount / selectedTopics.length),
          totalCount: questionCount,
          difficulty,
          questionTypes,
          options: {
            includeWorkedSolutions,
            includeHints,
            realWorldContext,
            examStyle,
            customInstructions: customInstructions || undefined,
          },
          useBatchApi,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start generation')
      }
      
      if (data.jobId) {
        setJobId(data.jobId)
        setJobStatus(data.status)
      }
      
      if (useBatchApi) {
        setSuccess('Batch job submitted! Questions will be generated within 24 hours.')
        setGenerating(false)
      } else if (data.questionsGenerated) {
        setSuccess(`Successfully generated ${data.questionsGenerated} questions!`)
        setGenerating(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
      setGenerating(false)
    }
  }

  // Generate topics/syllabus
  async function handleGenerateSyllabus() {
    if (!syllabusName.trim()) {
      setError('Please enter a syllabus/topic set name')
      return
    }
    
    if (!selectedGradeLevel) {
      setError('Please select a target grade level')
      return
    }
    
    // If no topic count specified, let AI determine appropriate amount
    const effectiveTopicCount = syllabusTopicCount || undefined
    
    setGenerating(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/syllabus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: syllabusName,
          description: syllabusDescription || undefined,
          targetProgramId: selectedProgram || undefined,
          targetGradeLevelId: selectedGradeLevel,
          topicCount: effectiveTopicCount,
          depth: syllabusDepth,
          includeSubtopics,
          includeLearningObjectives,
          sourceProgramId: sourceProgram || undefined,
          sourceGradeLevelId: sourceGradeLevel || undefined,
          customPrompt: syllabusCustomPrompt || undefined,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate syllabus')
      }
      
      setSuccess(`Successfully generated ${data.topicsCreated} topic${data.topicsCreated !== 1 ? 's' : ''}! Redirecting...`)
      setGenerating(false)
      
      // Redirect to topics page after a moment
      setTimeout(() => {
        router.push('/tutor/topics')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate syllabus')
      setGenerating(false)
    }
  }

  // Generate assignment
  async function handleGenerateAssignment() {
    if (selectedTopics.length === 0) {
      setError('Please select at least one topic for the assignment')
      return
    }
    
    if (selectedStudents.length === 0) {
      setError('Please select at least one student')
      return
    }
    
    setGenerating(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/assignments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: assignmentTitle || 'AI-Generated Assignment',
          topicIds: selectedTopics,
          studentIds: selectedStudents,
          questionCount: assignmentQuestionCount,
          difficulty: assignmentDifficulty,
          dueDate: assignmentDueDate || undefined,
          instructions: assignmentInstructions || undefined,
          options: {
            timeLimit,
            shuffleQuestions,
            showResultsImmediately,
          },
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate assignment')
      }
      
      setSuccess(`Successfully created assignment for ${selectedStudents.length} student(s)! Redirecting...`)
      setGenerating(false)
      
      setTimeout(() => {
        router.push('/tutor/assignments')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate assignment')
      setGenerating(false)
    }
  }

  // Handle form submission based on type
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    switch (generationType) {
      case 'questions':
        handleGenerateQuestions()
        break
      case 'topics':
        handleGenerateSyllabus()
        break
      case 'assignment':
        handleGenerateAssignment()
        break
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">AI Generation Studio</h1>
        <p className="text-gray-600 mt-1">
          Generate questions, topics, syllabi, and assignments with AI
        </p>
      </div>
      
      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex justify-between items-center">
          <span>
            {success}
            {generationType === 'questions' && (
              <Link href="/tutor/questions" className="ml-2 underline">View questions</Link>
            )}
          </span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">×</button>
        </div>
      )}
      
      {/* Generation Type Selector */}
      <div className="mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[
            { value: 'questions', label: 'Questions', icon: '❓', desc: 'Generate practice questions' },
            { value: 'topics', label: 'Topics/Syllabus', icon: '📚', desc: 'Generate curriculum topics' },
            { value: 'assignment', label: 'Assignment', icon: '📝', desc: 'Create student assignments' },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setGenerationType(type.value as GenerationType)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                generationType === type.value
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="text-lg mr-2">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Common Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {generationType === 'topics' ? 'Target Curriculum' : 'Filter by Curriculum'}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Study Program
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value)
                  setSelectedGradeLevel('')
                  setSelectedTopics([])
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Programs</option>
                {programs.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.name} ({program.code})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade Level {generationType === 'topics' && <span className="text-red-500">*</span>}
              </label>
              <select
                value={selectedGradeLevel}
                onChange={(e) => {
                  setSelectedGradeLevel(e.target.value)
                  setSelectedTopics([])
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={generationType === 'topics'}
              >
                <option value="">All Grade Levels</option>
                {availableGradeLevels.map(grade => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name} ({grade.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* QUESTION GENERATION OPTIONS */}
        {generationType === 'questions' && (
          <>
            {/* Topic Selection */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Select Topics</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllTopics}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearTopics}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              {filteredTopics.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No topics found for the selected filters.</p>
                  <Link href="/tutor/topics" className="text-blue-600 hover:underline mt-2 inline-block">
                    Create topics first
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {filteredTopics.map(topic => (
                    <label
                      key={topic.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTopics.includes(topic.id)
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic.id)}
                        onChange={() => toggleTopic(topic.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{topic.name}</div>
                        {topic.questions?.[0]?.count !== undefined && (
                          <div className="text-xs text-gray-500">{topic.questions[0].count} existing</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              
              {selectedTopics.length > 0 && (
                <div className="mt-3 text-sm text-blue-600">
                  {selectedTopics.length} topic(s) selected
                </div>
              )}
            </div>
            
            {/* Question Options */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Question Options</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {useBatchApi ? 'Up to 100 with batch' : 'Up to 50 per request'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty
                  </label>
                  <div className="flex gap-1">
                    {(['easy', 'medium', 'hard', 'mixed'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          difficulty === d
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'multiple_choice', label: 'Multiple Choice' },
                    { value: 'short_answer', label: 'Short Answer' },
                    { value: 'long_answer', label: 'Long Answer' },
                    { value: 'true_false', label: 'True/False' },
                    { value: 'fill_blank', label: 'Fill in the Blank' },
                    { value: 'matching', label: 'Matching' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleQuestionType(type.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        questionTypes.includes(type.value)
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={includeWorkedSolutions}
                    onChange={(e) => setIncludeWorkedSolutions(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Worked Solutions</div>
                    <div className="text-xs text-gray-500">Include step-by-step solutions</div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={includeHints}
                    onChange={(e) => setIncludeHints(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Include Hints</div>
                    <div className="text-xs text-gray-500">Add helpful hints for students</div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={realWorldContext}
                    onChange={(e) => setRealWorldContext(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Real-World Context</div>
                    <div className="text-xs text-gray-500">Use practical scenarios</div>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={examStyle}
                    onChange={(e) => setExamStyle(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Exam Style</div>
                    <div className="text-xs text-gray-500">Format like official exams</div>
                  </div>
                </label>
              </div>
            </div>
            
            {/* Custom Instructions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Custom Instructions</h2>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Add any specific instructions for the AI... e.g., 'Focus on graph interpretation', 'Include questions about recent scientific discoveries', 'Make questions progressively harder'"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>
            
            {/* Batch API Option */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={useBatchApi}
                  onChange={(e) => setUseBatchApi(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    Use Batch API
                    <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">50% cheaper</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Questions will be generated within 24 hours instead of immediately. Best for large batches.
                  </p>
                </div>
              </label>
            </div>
          </>
        )}
        
        {/* TOPIC/SYLLABUS GENERATION OPTIONS */}
        {generationType === 'topics' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Syllabus Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={syllabusName}
                    onChange={(e) => setSyllabusName(e.target.value)}
                    placeholder="e.g., IB Math HL Year 1 Topics"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={syllabusDescription}
                    onChange={(e) => setSyllabusDescription(e.target.value)}
                    placeholder="Describe the scope and goals of this syllabus..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Units (optional)
                    </label>
                    <input
                      type="number"
                      value={syllabusTopicCount || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null
                        setSyllabusTopicCount(val ? Math.max(1, Math.min(50, val)) : null)
                      }}
                      placeholder="Let AI decide"
                      min={1}
                      max={50}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Units (e.g., Number, Algebra). Each will have 2-5 subtopics.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Detail Level
                    </label>
                    <select
                      value={syllabusDepth}
                      onChange={(e) => setSyllabusDepth(e.target.value as 'overview' | 'standard' | 'detailed')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="overview">Overview (high-level)</option>
                      <option value="standard">Standard</option>
                      <option value="detailed">Detailed (granular)</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeSubtopics}
                      onChange={(e) => setIncludeSubtopics(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={true}
                    />
                    <span className="text-sm text-gray-700">Create hierarchical structure (units → subtopics)</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeLearningObjectives}
                      onChange={(e) => setIncludeLearningObjectives(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Include learning objectives</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Topics are organized as Units (parent) → Subtopics (children). E.g., &quot;Algebra&quot; contains &quot;Equations&quot;, &quot;Formulas&quot;, etc.
                </p>
              </div>
            </div>
            
            {/* Map from existing program */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Map from Existing Program</h2>
              <p className="text-sm text-gray-500 mb-4">
                Optionally base the new syllabus on topics from an existing program/grade level
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Program
                  </label>
                  <select
                    value={sourceProgram}
                    onChange={(e) => {
                      setSourceProgram(e.target.value)
                      setSourceGradeLevel('')
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None (generate from scratch)</option>
                    {programs.map(program => (
                      <option key={program.id} value={program.id}>
                        {program.name} ({program.code})
                      </option>
                    ))}
                  </select>
                </div>
                
                {sourceProgram && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source Grade Level
                    </label>
                    <select
                      value={sourceGradeLevel}
                      onChange={(e) => setSourceGradeLevel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select grade level...</option>
                      {sourceGradeLevels.map(grade => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name} ({grade.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            {/* Custom prompt */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Custom Instructions / Curriculum Outline</h2>
              <p className="text-sm text-gray-500 mb-3">
                Paste a curriculum outline or add specific requirements. The AI will follow this structure closely.
              </p>
              <textarea
                value={syllabusCustomPrompt}
                onChange={(e) => setSyllabusCustomPrompt(e.target.value)}
                placeholder={`Paste your curriculum outline here. Example:

Unit 1: Number
- Exponents and Surds
- Sequences

Unit 2: Algebra
- Expressions and equations
- Formulas

Or add specific requirements like:
"Focus on IB MYP Year 9 standards"
"Include trigonometry and geometry"`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={8}
              />
            </div>
          </>
        )}
        
        {/* ASSIGNMENT GENERATION OPTIONS */}
        {generationType === 'assignment' && (
          <>
            {/* Topic Selection for Assignment */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Select Topics</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllTopics}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearTopics}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              {filteredTopics.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No topics found. Create topics first or generate a syllabus.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {filteredTopics.map(topic => (
                    <label
                      key={topic.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTopics.includes(topic.id)
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic.id)}
                        onChange={() => toggleTopic(topic.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900 truncate">{topic.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            {/* Student Selection */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign to Students</h2>
              
              {students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No students found.
                  <Link href="/tutor/students/new" className="text-blue-600 hover:underline ml-1">
                    Add students first
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {students.map(student => (
                    <label
                      key={student.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedStudents.includes(student.id)
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900 truncate">{student.name}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {selectedStudents.length > 0 && (
                <div className="mt-3 text-sm text-blue-600">
                  {selectedStudents.length} student(s) selected
                </div>
              )}
            </div>
            
            {/* Assignment Details */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignment Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="e.g., Week 3 Practice Quiz"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Questions
                    </label>
                    <input
                      type="number"
                      value={assignmentQuestionCount}
                      onChange={(e) => setAssignmentQuestionCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                      min={1}
                      max={50}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={assignmentDifficulty}
                      onChange={(e) => setAssignmentDifficulty(e.target.value as 'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="mixed">Mixed (variety)</option>
                      <option value="adaptive">Adaptive (per student)</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      value={assignmentDueDate}
                      onChange={(e) => setAssignmentDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Limit (minutes)
                    </label>
                    <input
                      type="number"
                      value={timeLimit || ''}
                      onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="No limit"
                      min={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instructions for Students
                  </label>
                  <textarea
                    value={assignmentInstructions}
                    onChange={(e) => setAssignmentInstructions(e.target.value)}
                    placeholder="Any special instructions..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Shuffle questions</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showResultsImmediately}
                      onChange={(e) => setShowResultsImmediately(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Show results immediately</span>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={generating}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-colors"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                {jobStatus === 'processing' ? 'Generating...' : 'Starting...'}
              </span>
            ) : (
              <>
                {generationType === 'questions' && `Generate ${questionCount} Question${questionCount !== 1 ? 's' : ''}`}
                {generationType === 'topics' && (syllabusTopicCount ? `Generate ${syllabusTopicCount} Topic${syllabusTopicCount !== 1 ? 's' : ''}` : 'Generate Topics')}
                {generationType === 'assignment' && 'Create Assignment'}
              </>
            )}
          </button>
        </div>
        
        {generating && jobStatus && (
          <div className="text-center text-sm text-gray-600">
            Status: <span className="font-medium">{jobStatus}</span>
          </div>
        )}
      </form>
      
      {/* Tips Section */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span>💡</span> Tips for Better Results
        </h3>
        <ul className="text-sm text-gray-600 space-y-2">
          {generationType === 'questions' && (
            <>
              <li>• <strong>Select multiple topics</strong> for varied practice sets</li>
              <li>• Use <strong>custom instructions</strong> for specific requirements</li>
              <li>• <strong>Exam style</strong> option formats questions like official exams</li>
              <li>• <strong>Batch API</strong> is cheaper for 20+ questions</li>
            </>
          )}
          {generationType === 'topics' && (
            <>
              <li>• <strong>Map from existing programs</strong> to adapt curricula</li>
              <li>• <strong>Detailed depth</strong> creates more granular topics</li>
              <li>• <strong>Learning objectives</strong> help track student progress</li>
              <li>• Review and edit generated topics as needed</li>
            </>
          )}
          {generationType === 'assignment' && (
            <>
              <li>• <strong>Adaptive difficulty</strong> adjusts based on student level</li>
              <li>• <strong>Shuffle questions</strong> to prevent copying</li>
              <li>• Set <strong>time limits</strong> for timed practice</li>
              <li>• Use clear <strong>instructions</strong> for students</li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
