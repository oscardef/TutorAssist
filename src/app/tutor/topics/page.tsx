'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface StudyProgram {
  id: string
  code: string
  name: string
  color: string | null
  order_index: number
  grade_levels?: GradeLevel[]
}

interface GradeLevel {
  id: string
  program_id: string
  code: string
  name: string
  year_number: number | null
  order_index: number
}

interface Topic {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  program_id: string | null
  grade_level_id: string | null
  is_core: boolean
  curriculum_code: string | null
  order_index: number
  metadata?: {
    difficulty?: number
    subtopics?: string[]
    learning_objectives?: string[]
    generated_from?: string
    source_program_id?: string | null
    source_grade_level_id?: string | null
  }
  questions?: { count: number }[]
  program?: StudyProgram
  grade_level?: GradeLevel
}

interface TopicGroup {
  canonicalName: string
  canonicalId: string | null
  variants: { id: string; name: string; questionCount: number }[]
  suggestedMerge: boolean
}

interface TopicAnalysis {
  groups: TopicGroup[]
  hierarchySuggestions: { parentId: string; childId: string; reason: string }[]
  totalTopics: number
  potentialDuplicates: number
}

export default function TopicsPage() {
  // Data state
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter state
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string | null>(null)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Topic analysis state
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<TopicAnalysis | null>(null)
  const [merging, setMerging] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  const [formProgramId, setFormProgramId] = useState('')
  const [formGradeLevelId, setFormGradeLevelId] = useState('')
  const [isCore, setIsCore] = useState(false)
  const [curriculumCode, setCurriculumCode] = useState('')
  const [programsLoaded, setProgramsLoaded] = useState(false)
  
  const fetchPrograms = useCallback(async () => {
    try {
      const response = await fetch('/api/programs')
      const data = await response.json()
      if (data.programs) {
        setPrograms(data.programs)
        // Only auto-select first program on initial load, not when "All Programs" is selected
        if (!programsLoaded && data.programs.length > 0) {
          setSelectedProgram(data.programs[0].id)
          setProgramsLoaded(true)
        }
      }
    } catch {
      console.error('Failed to load programs')
    }
  }, [programsLoaded])
  
  const fetchTopics = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/topics?'
      if (selectedProgram) url += `programId=${selectedProgram}&`
      if (selectedGradeLevel) url += `gradeLevelId=${selectedGradeLevel}&`
      
      const response = await fetch(url)
      const data = await response.json()
      setTopics(data.topics || [])
    } catch {
      setError('Failed to load topics')
    } finally {
      setLoading(false)
    }
  }, [selectedProgram, selectedGradeLevel])
  
  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])
  
  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])
  
  // Get grade levels for selected program
  const selectedProgramData = programs.find(p => p.id === selectedProgram)
  const gradeLevels = selectedProgramData?.grade_levels || []
  
  async function analyzeTopics() {
    setAnalyzing(true)
    setError(null)
    try {
      const response = await fetch('/api/topics/analyze')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setAnalysis(data)
      setShowAnalysis(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze topics')
    } finally {
      setAnalyzing(false)
    }
  }

  async function mergeDuplicates(group: TopicGroup) {
    if (!group.canonicalId) return
    setMerging(true)
    setError(null)
    try {
      const mergeIds = group.variants
        .filter(v => v.id !== group.canonicalId)
        .map(v => v.id)
      
      const response = await fetch('/api/topics/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalTopicId: group.canonicalId,
          mergeTopicIds: mergeIds,
          newName: group.canonicalName,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      
      await fetchTopics()
      await analyzeTopics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge topics')
    } finally {
      setMerging(false)
    }
  }
  
  function openCreateModal() {
    setEditingTopic(null)
    setName('')
    setDescription('')
    setParentId('')
    setFormProgramId(selectedProgram || '')
    setFormGradeLevelId(selectedGradeLevel || '')
    setIsCore(false)
    setCurriculumCode('')
    setShowModal(true)
  }
  
  function openEditModal(topic: Topic) {
    setEditingTopic(topic)
    setName(topic.name)
    setDescription(topic.description || '')
    setParentId(topic.parent_id || '')
    setFormProgramId(topic.program_id || '')
    setFormGradeLevelId(topic.grade_level_id || '')
    setIsCore(topic.is_core || false)
    setCurriculumCode(topic.curriculum_code || '')
    setShowModal(true)
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    try {
      const url = editingTopic ? `/api/topics?id=${editingTopic.id}` : '/api/topics'
      const method = editingTopic ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          parentId: parentId || null,
          programId: formProgramId || null,
          gradeLevelId: formGradeLevelId || null,
          isCore,
          curriculumCode: curriculumCode || null,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save topic')
      }
      
      await fetchTopics()
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save topic')
    } finally {
      setSaving(false)
    }
  }
  
  async function handleDelete(topicId: string) {
    const topic = topics.find(t => t.id === topicId)
    const hasChildren = topics.some(t => t.parent_id === topicId)
    const questionCount = topic?.questions?.[0]?.count || 0
    
    let confirmMessage = `Are you sure you want to delete "${topic?.name}"?`
    if (hasChildren) {
      const childCount = topics.filter(t => t.parent_id === topicId).length
      confirmMessage += `\n\nThis will also delete ${childCount} subtopic${childCount !== 1 ? 's' : ''}.`
    }
    if (questionCount > 0) {
      confirmMessage += `\n\n${questionCount} question${questionCount !== 1 ? 's' : ''} will be unassigned but not deleted.`
    }
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    try {
      const response = await fetch(`/api/topics?id=${topicId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete topic')
      }
      
      await fetchTopics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete topic')
    }
  }
  
  // Get grade levels for the form's selected program
  const formProgramData = programs.find(p => p.id === formProgramId)
  const formGradeLevels = formProgramData?.grade_levels || []
  
  // Organize topics into a tree structure
  type TopicWithChildren = Topic & { children: TopicWithChildren[] }
  
  function buildTopicTree(topics: Topic[]): TopicWithChildren[] {
    const topicMap = new Map<string, TopicWithChildren>()
    const rootTopics: TopicWithChildren[] = []
    
    topics.forEach(topic => {
      topicMap.set(topic.id, { ...topic, children: [] })
    })
    
    topics.forEach(topic => {
      const topicWithChildren = topicMap.get(topic.id)!
      if (topic.parent_id && topicMap.has(topic.parent_id)) {
        topicMap.get(topic.parent_id)!.children.push(topicWithChildren)
      } else {
        rootTopics.push(topicWithChildren)
      }
    })
    
    return rootTopics
  }
  
  const topicTree = buildTopicTree(topics)
  
  // Calculate statistics
  const totalUnits = topics.filter(t => !t.parent_id).length
  const totalSubtopics = topics.filter(t => t.parent_id).length
  const totalQuestions = topics.reduce((sum, t) => sum + (t.questions?.[0]?.count || 0), 0)
  
  // Color helper for program tabs
  function getProgramColor(program: StudyProgram) {
    const colors: Record<string, string> = {
      'IB': 'bg-blue-500',
      'AP': 'bg-green-500',
      'GCSE': 'bg-purple-500',
      'ALEVEL': 'bg-orange-500',
      'GENERAL': 'bg-gray-500',
    }
    return program.color || colors[program.code] || 'bg-gray-500'
  }
  
  if (loading && programs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize questions by study program and grade level
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={analyzeTopics}
            disabled={analyzing}
            className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                Find Duplicates
              </>
            )}
          </button>
          <button
            onClick={openCreateModal}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Create Topic
          </button>
        </div>
      </div>
      
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      
      {/* Program Tabs */}
      {programs.length > 0 && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-2" aria-label="Programs">
            {programs.map((program) => (
              <button
                key={program.id}
                onClick={() => {
                  setSelectedProgram(program.id)
                  setSelectedGradeLevel(null)
                }}
                className={`
                  px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2
                  ${selectedProgram === program.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className={`w-2 h-2 rounded-full ${getProgramColor(program)}`} />
                {program.name}
              </button>
            ))}
            <button
              onClick={() => {
                setSelectedProgram(null)
                setSelectedGradeLevel(null)
              }}
              className={`
                px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${selectedProgram === null
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              All Programs
            </button>
          </nav>
        </div>
      )}
      
      {/* Grade Level Pills */}
      {selectedProgram && gradeLevels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedGradeLevel(null)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-full transition-colors
              ${selectedGradeLevel === null
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            All Grades
          </button>
          {gradeLevels.map((grade) => (
            <button
              key={grade.id}
              onClick={() => setSelectedGradeLevel(grade.id)}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-full transition-colors
                ${selectedGradeLevel === grade.id
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {grade.code} - {grade.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Statistics Banner */}
      {topics.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-2xl font-bold text-blue-600">{totalUnits}</div>
                <div className="text-xs text-gray-600">Units</div>
              </div>
              <div className="h-8 w-px bg-blue-200" />
              <div>
                <div className="text-2xl font-bold text-indigo-600">{totalSubtopics}</div>
                <div className="text-xs text-gray-600">Subtopics</div>
              </div>
              <div className="h-8 w-px bg-blue-200" />
              <div>
                <div className="text-2xl font-bold text-purple-600">{totalQuestions}</div>
                <div className="text-xs text-gray-600">Questions</div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {selectedProgram && selectedGradeLevel && (
                <span>
                  Showing {topics.length} topic{topics.length !== 1 ? 's' : ''} for selected grade
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Topics List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : topicTree.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {topicTree.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              level={0}
              onEdit={openEditModal}
              onDelete={handleDelete}
              programs={programs}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center bg-white">
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
              d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            No topics yet
          </h3>
          <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
            Create your first topic to organize questions by subject area. Try using the AI Generation Studio to create a full curriculum.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Topic Manually
            </button>
            <Link
              href="/tutor/generate"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              Generate with AI
            </Link>
          </div>
        </div>
      )}
      
      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {editingTopic ? 'Edit Topic' : 'Create Topic'}
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Program Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Study Program
                      </label>
                      <select
                        value={formProgramId}
                        onChange={(e) => {
                          setFormProgramId(e.target.value)
                          setFormGradeLevelId('') // Reset grade when program changes
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No Program (General)</option>
                        {programs.map(program => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Grade Level Selection */}
                    {formProgramId && formGradeLevels.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Grade Level
                        </label>
                        <select
                          value={formGradeLevelId}
                          onChange={(e) => setFormGradeLevelId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Grades</option>
                          {formGradeLevels.map(grade => (
                            <option key={grade.id} value={grade.id}>
                              {grade.code} - {grade.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Topic Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Quadratic Functions, Integration, Statistics"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Curriculum Code
                      </label>
                      <input
                        type="text"
                        value={curriculumCode}
                        onChange={(e) => setCurriculumCode(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., AA.2.3, SL.5.1"
                      />
                      <p className="mt-1 text-xs text-gray-500">Optional curriculum reference code</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe what this topic covers..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parent Topic
                      </label>
                      <select
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">None (Top Level)</option>
                        {topics
                          .filter(t => t.id !== editingTopic?.id)
                          .map(topic => (
                            <option key={topic.id} value={topic.id}>
                              {topic.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isCore"
                        checked={isCore}
                        onChange={(e) => setIsCore(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="isCore" className="text-sm text-gray-700">
                        Core Topic (required in syllabus)
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingTopic ? 'Save Changes' : 'Create Topic'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Topic Analysis Modal */}
      {showAnalysis && analysis && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAnalysis(false)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    Topic Analysis
                  </h3>
                  <button onClick={() => setShowAnalysis(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
                  Found {analysis.potentialDuplicates} potential duplicate groups in {analysis.totalTopics} topics
                </div>

                {analysis.groups.filter(g => g.variants.length > 1).length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {analysis.groups
                      .filter(g => g.variants.length > 1)
                      .map((group, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                              Suggested: &quot;{group.canonicalName}&quot;
                            </span>
                            <button
                              onClick={() => mergeDuplicates(group)}
                              disabled={merging}
                              className="px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              {merging ? 'Merging...' : 'Merge All'}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {group.variants.map((v) => (
                              <div key={v.id} className="flex items-center justify-between text-sm text-gray-600">
                                <span className={v.id === group.canonicalId ? 'font-medium text-gray-900' : ''}>
                                  {v.name}
                                  {v.id === group.canonicalId && (
                                    <span className="ml-2 text-xs text-green-600">(kept)</span>
                                  )}
                                </span>
                                <span className="text-gray-400">{v.questionCount} questions</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <p className="mt-2">No duplicate topics found! Your topics are well organized.</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  onClick={() => setShowAnalysis(false)}
                  className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type TopicWithChildrenType = Topic & { children: TopicWithChildrenType[] }

interface TopicRowProps {
  topic: TopicWithChildrenType
  level: number
  onEdit: (topic: Topic) => void
  onDelete: (topicId: string) => void
  programs: StudyProgram[]
}

function TopicRow({ topic, level, onEdit, onDelete, programs }: TopicRowProps) {
  const [expanded, setExpanded] = useState(level === 0) // Units expanded by default, subtopics collapsed
  const questionCount = topic.questions?.[0]?.count || 0
  const hasChildren = topic.children.length > 0
  const isUnit = level === 0 // Units are top-level (parents)
  
  // Get program and grade info for badges
  const program = programs.find(p => p.id === topic.program_id)
  const gradeLevel = program?.grade_levels?.find(g => g.id === topic.grade_level_id)
  
  // Build question bank URL with topic filter
  const questionBankUrl = `/tutor/questions?topicId=${topic.id}`
  
  return (
    <>
      <div className={`group transition-colors ${
        isUnit 
          ? 'bg-gray-50 border-t border-gray-200 first:border-t-0' 
          : 'bg-white hover:bg-blue-50/30'
      }`}>
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Left side: Topic info */}
          <div className="flex items-center gap-3 flex-1 min-w-0" style={{ paddingLeft: `${level * 20}px` }}>
            {/* Expand/collapse button */}
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
                aria-label={expanded ? 'Collapse' : 'Expand'}
                title={expanded ? `Collapse (${topic.children.length} subtopics)` : `Expand (${topic.children.length} subtopics)`}
              >
                <svg
                  className={`h-4 w-4 transform transition-transform ${expanded ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ) : (
              <div className="w-6" />
            )}
            
            {/* Topic name and metadata */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link 
                  href={questionBankUrl}
                  className={`font-medium hover:text-blue-600 hover:underline transition-colors ${
                    isUnit ? 'text-gray-900 text-base' : 'text-gray-700 text-sm'
                  }`}
                >
                  {topic.name}
                </Link>
                {hasChildren && isUnit && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded font-medium">
                    {topic.children.length} subtopic{topic.children.length !== 1 ? 's' : ''}
                  </span>
                )}
                {topic.is_core && (
                  <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded font-medium">
                    Core
                  </span>
                )}
                {!isUnit && gradeLevel && (
                  <span className="text-xs text-gray-400">
                    {gradeLevel.code}
                  </span>
                )}
              </div>
              
              {topic.description && (
                <p className={`mt-1 text-gray-500 ${isUnit ? 'text-sm' : 'text-xs'}`}>
                  {topic.description}
                </p>
              )}
              
              {/* Learning objectives for subtopics */}
              {!isUnit && topic.metadata?.learning_objectives && topic.metadata.learning_objectives.length > 0 && (
                <div className="mt-1 text-xs text-gray-400">
                  {topic.metadata.learning_objectives.slice(0, 2).join(' • ')}
                  {topic.metadata.learning_objectives.length > 2 && ` (+${topic.metadata.learning_objectives.length - 2})`}
                </div>
              )}
            </div>
          </div>
          
          {/* Right side: Stats and actions */}
          <div className="flex items-center gap-4 ml-4 shrink-0">
            {/* Question count - clickable */}
            <Link
              href={questionBankUrl}
              className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
              title="View questions"
            >
              <span className="font-medium">{questionCount}</span> {questionCount === 1 ? 'question' : 'questions'}
            </Link>
            
            {/* Action buttons - hidden by default, shown on hover */}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(topic)}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                title="Edit topic"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(topic.id)}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
                title="Delete topic"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Render children (subtopics) */}
      {expanded && hasChildren && (
        <div>
          {topic.children.map(child => (
            <TopicRow
              key={child.id}
              topic={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              programs={programs}
            />
          ))}
        </div>
      )}
    </>
  )
}
