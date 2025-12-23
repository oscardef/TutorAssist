'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Topic {
  id: string
  name: string
  description: string | null
}

export default function NewQuestionPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [selectedTopic, setSelectedTopic] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [questionLatex, setQuestionLatex] = useState('')
  const [answerType, setAnswerType] = useState<'exact' | 'numeric' | 'multiple_choice'>('exact')
  const [answer, setAnswer] = useState('')
  const [answerTolerance, setAnswerTolerance] = useState('')
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState(['', '', '', ''])
  const [correctChoiceIndex, setCorrectChoiceIndex] = useState(0)
  const [difficulty, setDifficulty] = useState(3)
  const [hints, setHints] = useState<string[]>([''])
  const [solutionSteps, setSolutionSteps] = useState<string[]>([''])
  const [tags, setTags] = useState('')
  
  // Create topic modal state
  const [showCreateTopic, setShowCreateTopic] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicDescription, setNewTopicDescription] = useState('')
  const [creatingTopic, setCreatingTopic] = useState(false)
  
  useEffect(() => {
    fetchTopics()
  }, [])
  
  async function fetchTopics() {
    try {
      const response = await fetch('/api/topics')
      const data = await response.json()
      setTopics(data.topics || [])
    } catch (err) {
      setError('Failed to load topics')
    } finally {
      setLoading(false)
    }
  }
  
  async function handleCreateTopic() {
    if (!newTopicName.trim()) {
      setError('Topic name is required')
      return
    }
    
    setCreatingTopic(true)
    setError(null)
    
    try {
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTopicName.trim(),
          description: newTopicDescription.trim() || null,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create topic')
      }
      
      // Add new topic to list and select it
      setTopics(prev => [...prev, data.topic])
      setSelectedTopic(data.topic.id)
      setShowCreateTopic(false)
      setNewTopicName('')
      setNewTopicDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create topic')
    } finally {
      setCreatingTopic(false)
    }
  }
  
  function addHint() {
    setHints(prev => [...prev, ''])
  }
  
  function updateHint(index: number, value: string) {
    setHints(prev => prev.map((h, i) => i === index ? value : h))
  }
  
  function removeHint(index: number) {
    setHints(prev => prev.filter((_, i) => i !== index))
  }
  
  function addSolutionStep() {
    setSolutionSteps(prev => [...prev, ''])
  }
  
  function updateSolutionStep(index: number, value: string) {
    setSolutionSteps(prev => prev.map((s, i) => i === index ? value : s))
  }
  
  function removeSolutionStep(index: number) {
    setSolutionSteps(prev => prev.filter((_, i) => i !== index))
  }
  
  function updateMultipleChoiceOption(index: number, value: string) {
    setMultipleChoiceOptions(prev => prev.map((o, i) => i === index ? value : o))
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedTopic) {
      setError('Please select a topic')
      return
    }
    
    if (!questionText.trim()) {
      setError('Please enter the question text')
      return
    }
    
    // Validate answer based on type
    if (answerType === 'exact' && !answer.trim()) {
      setError('Please enter the correct answer')
      return
    }
    
    if (answerType === 'numeric' && !answer.trim()) {
      setError('Please enter the numeric answer')
      return
    }
    
    if (answerType === 'multiple_choice') {
      const filledOptions = multipleChoiceOptions.filter(o => o.trim())
      if (filledOptions.length < 2) {
        setError('Please provide at least 2 answer choices')
        return
      }
    }
    
    setSaving(true)
    setError(null)
    
    try {
      // Build correct_answer_json based on type
      let correctAnswerJson: Record<string, unknown>
      
      if (answerType === 'multiple_choice') {
        const choices = multipleChoiceOptions
          .filter(o => o.trim())
          .map(o => ({ text: o.trim() }))
        correctAnswerJson = {
          choices,
          correct: correctChoiceIndex,
        }
      } else if (answerType === 'numeric') {
        correctAnswerJson = {
          value: parseFloat(answer),
          tolerance: answerTolerance ? parseFloat(answerTolerance) : undefined,
        }
      } else {
        correctAnswerJson = {
          value: answer.trim(),
        }
      }
      
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopic,
          promptText: questionText.trim(),
          promptLatex: questionLatex.trim() || null,
          correctAnswerJson: correctAnswerJson,
          answerType,
          tolerance: answerType === 'numeric' && answerTolerance ? parseFloat(answerTolerance) : null,
          difficulty,
          hints: hints.filter(h => h.trim()),
          solutionSteps: solutionSteps.filter(s => s.trim()).map(s => ({ step: s })),
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create question')
      }
      
      router.push('/tutor/questions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question')
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
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/tutor/questions" className="text-gray-600 hover:text-gray-900 text-sm">
          ← Back to Question Bank
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Add Question</h1>
        <p className="text-gray-600 mt-1">
          Create a new practice question manually
        </p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Topic Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Topic *</h2>
            <button
              type="button"
              onClick={() => setShowCreateTopic(true)}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              + Create Topic
            </button>
          </div>
          
          {topics.length > 0 ? (
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a topic...</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-2">No topics yet</p>
              <button
                type="button"
                onClick={() => setShowCreateTopic(true)}
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Create your first topic
              </button>
            </div>
          )}
        </div>
        
        {/* Question Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Question Content</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Text *
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter the question text..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LaTeX (optional)
            </label>
            <textarea
              value={questionLatex}
              onChange={(e) => setQuestionLatex(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              rows={2}
              placeholder="Enter LaTeX for math rendering (e.g., \frac{1}{2} + \frac{1}{4})"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use LaTeX for complex mathematical notation
            </p>
          </div>
        </div>
        
        {/* Answer Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Answer</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer Type
            </label>
            <div className="flex gap-2">
              {(['exact', 'numeric', 'multiple_choice'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAnswerType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    answerType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type === 'exact' ? 'Exact Match' : type === 'numeric' ? 'Numeric' : 'Multiple Choice'}
                </button>
              ))}
            </div>
          </div>
          
          {answerType === 'multiple_choice' ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Answer Choices
              </label>
              {multipleChoiceOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctChoice"
                    checked={correctChoiceIndex === index}
                    onChange={() => setCorrectChoiceIndex(index)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateMultipleChoiceOption(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Option ${index + 1}`}
                  />
                </div>
              ))}
              <p className="text-xs text-gray-500">
                Select the radio button next to the correct answer
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correct Answer *
                </label>
                <input
                  type={answerType === 'numeric' ? 'number' : 'text'}
                  step={answerType === 'numeric' ? 'any' : undefined}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={answerType === 'numeric' ? 'e.g., 42' : 'e.g., x = 5'}
                  required
                />
              </div>
              
              {answerType === 'numeric' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tolerance (optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={answerTolerance}
                    onChange={(e) => setAnswerTolerance(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 0.01"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Allow answers within ± this value
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Difficulty */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Difficulty</h2>
          
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              difficulty === 1 ? 'bg-green-100 text-green-700' :
              difficulty === 2 ? 'bg-lime-100 text-lime-700' :
              difficulty === 3 ? 'bg-yellow-100 text-yellow-700' :
              difficulty === 4 ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {['Easy', 'Medium-Easy', 'Medium', 'Medium-Hard', 'Hard'][difficulty - 1]}
            </span>
          </div>
        </div>
        
        {/* Hints */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Hints (optional)</h2>
            <button
              type="button"
              onClick={addHint}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              + Add Hint
            </button>
          </div>
          
          <div className="space-y-3">
            {hints.map((hint, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => updateHint(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Hint ${index + 1}`}
                />
                {hints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeHint(index)}
                    className="px-3 py-2 text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Solution Steps */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Solution Steps (optional)</h2>
            <button
              type="button"
              onClick={addSolutionStep}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              + Add Step
            </button>
          </div>
          
          <div className="space-y-3">
            {solutionSteps.map((step, index) => (
              <div key={index} className="flex gap-2">
                <span className="flex-shrink-0 w-8 h-10 flex items-center justify-center bg-gray-100 rounded text-sm font-medium text-gray-600">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => updateSolutionStep(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Step ${index + 1}`}
                />
                {solutionSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSolutionStep(index)}
                    className="px-3 py-2 text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Tags */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Tags (optional)</h2>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="algebra, equations, linear (comma-separated)"
          />
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/tutor/questions"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Question'}
          </button>
        </div>
      </form>
      
      {/* Create Topic Modal */}
      {showCreateTopic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Topic</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic Name *
                </label>
                <input
                  type="text"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Algebra, Geometry, Calculus"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Brief description of the topic"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTopic(false)
                  setNewTopicName('')
                  setNewTopicDescription('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTopic}
                disabled={creatingTopic}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {creatingTopic ? 'Creating...' : 'Create Topic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
