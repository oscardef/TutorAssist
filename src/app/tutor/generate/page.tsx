'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Topic {
  id: string
  name: string
  description: string | null
  questions?: { count: number }[]
}

export default function GenerateQuestionsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [selectedTopic, setSelectedTopic] = useState('')
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed')
  const [style, setStyle] = useState('')
  const [useBatchApi, setUseBatchApi] = useState(false)
  
  useEffect(() => {
    fetchTopics()
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
          setSuccess(`Successfully generated ${data.result?.questionsGenerated || count} questions!`)
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
  }, [jobId, count])
  
  async function fetchTopics() {
    try {
      const response = await fetch('/api/topics')
      const data = await response.json()
      setTopics(data.topics || [])
    } catch {
      setError('Failed to load topics')
    } finally {
      setLoading(false)
    }
  }
  
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedTopic) {
      setError('Please select a topic')
      return
    }
    
    setGenerating(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopic,
          count,
          difficulty,
          style: style || undefined,
          useBatchApi,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start generation')
      }
      
      setJobId(data.jobId)
      setJobStatus(data.status)
      
      if (useBatchApi) {
        setSuccess('Batch job submitted! Questions will be generated within 24 hours.')
        setGenerating(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
      setGenerating(false)
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/tutor/questions"
          className="text-gray-600 hover:text-gray-900 text-sm"
        >
          ← Back to Question Bank
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Generate Questions with AI</h1>
        <p className="text-gray-600 mt-1">
          Use AI to automatically generate practice questions for your students.
        </p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
          <Link
            href="/tutor/questions"
            className="ml-2 underline"
          >
            View questions
          </Link>
        </div>
      )}
      
      {topics.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Topics Yet</h3>
          <p className="text-gray-600 mb-4">
            Create a topic first before generating questions.
          </p>
          <Link
            href="/tutor/questions"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Create Topic
          </Link>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topic *
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a topic...</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                  {topic.questions?.[0]?.count !== undefined && 
                    ` (${topic.questions[0].count} questions)`}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Questions
            </label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
              min={1}
              max={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {useBatchApi ? 'Up to 50 questions per batch' : 'Up to 20 questions per request'}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard', 'mixed'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Style Preferences (optional)
            </label>
            <textarea
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="e.g., 'Focus on word problems', 'Include proofs', 'Application-based questions'"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
          
          <div className="border-t pt-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useBatchApi}
                onChange={(e) => setUseBatchApi(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Use Batch API (50% cheaper)
                </span>
                <p className="text-xs text-gray-500">
                  Questions will be generated within 24 hours instead of immediately
                </p>
              </div>
            </label>
          </div>
          
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={generating || !selectedTopic}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  {jobStatus === 'processing' ? 'Generating...' : 'Starting...'}
                </span>
              ) : (
                `Generate ${count} Question${count !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
          
          {generating && jobStatus && (
            <div className="text-center text-sm text-gray-600">
              Status: <span className="font-medium">{jobStatus}</span>
            </div>
          )}
        </form>
      )}
      
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-3">💡 Tips for Better Results</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• <strong>Be specific</strong> with your topic names and descriptions</li>
          <li>• Use <strong>style preferences</strong> to guide the type of questions</li>
          <li>• Start with <strong>mixed difficulty</strong> to get a variety</li>
          <li>• <strong>Review and edit</strong> generated questions for accuracy</li>
          <li>• Use <strong>Batch API</strong> for large batches to save costs</li>
        </ul>
      </div>
    </div>
  )
}
