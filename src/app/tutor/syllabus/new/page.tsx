'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface GeneratedTopic {
  name: string
  description: string
  difficulty: number
  questionCount: number
  subtopics?: string[]
}

interface GeneratedSyllabus {
  title: string
  description: string
  grade: string
  curriculum: string
  topics: GeneratedTopic[]
}

export default function NewSyllabusPage() {
  const router = useRouter()
  
  const [step, setStep] = useState<'input' | 'preview' | 'generating'>('input')
  const [prompt, setPrompt] = useState('')
  const [curriculum, setCurriculum] = useState('')
  const [grade, setGrade] = useState('')
  const [duration, setDuration] = useState('semester')
  const [questionsPerTopic, setQuestionsPerTopic] = useState(10)
  
  const [generatedSyllabus, setGeneratedSyllabus] = useState<GeneratedSyllabus | null>(null)
  const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [error, setError] = useState('')
  
  const curriculums = [
    { id: 'ib', name: 'IB (International Baccalaureate)' },
    { id: 'ap', name: 'AP (Advanced Placement)' },
    { id: 'gcse', name: 'GCSE (UK)' },
    { id: 'alevels', name: 'A-Levels (UK)' },
    { id: 'common_core', name: 'Common Core (US)' },
    { id: 'cbse', name: 'CBSE (India)' },
    { id: 'custom', name: 'Custom / Other' }
  ]
  
  const generateSyllabus = async () => {
    if (!prompt && !curriculum) {
      setError('Please describe what you want to teach or select a curriculum')
      return
    }
    
    setGenerating(true)
    setError('')
    
    try {
      const response = await fetch('/api/syllabus/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          curriculum,
          grade,
          duration,
          questionsPerTopic
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate syllabus')
      }
      
      const data = await response.json()
      setGeneratedSyllabus(data.syllabus)
      setSelectedTopics(new Set(data.syllabus.topics.map((_: GeneratedTopic, i: number) => i)))
      setStep('preview')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate syllabus')
    } finally {
      setGenerating(false)
    }
  }
  
  const toggleTopic = (index: number) => {
    const newSelected = new Set(selectedTopics)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedTopics(newSelected)
  }
  
  const createSyllabusAndQuestions = async () => {
    if (!generatedSyllabus || selectedTopics.size === 0) return
    
    setGeneratingQuestions(true)
    setStep('generating')
    setError('')
    
    try {
      const selectedTopicData = generatedSyllabus.topics.filter((_, i) => selectedTopics.has(i))
      
      const response = await fetch('/api/syllabus/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syllabus: {
            ...generatedSyllabus,
            topics: selectedTopicData
          },
          questionsPerTopic
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create syllabus')
      }
      
      router.push('/tutor/questions')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create syllabus')
      setStep('preview')
    } finally {
      setGeneratingQuestions(false)
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate Course Syllabus</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a complete syllabus with topics and questions using AI
        </p>
      </div>
      
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4">
        <div className={`flex items-center ${step === 'input' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'input' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
            1
          </div>
          <span className="ml-2 font-medium">Describe</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-200" />
        <div className={`flex items-center ${step === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'preview' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
            2
          </div>
          <span className="ml-2 font-medium">Preview</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-200" />
        <div className={`flex items-center ${step === 'generating' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'generating' ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}`}>
            3
          </div>
          <span className="ml-2 font-medium">Generate</span>
        </div>
      </div>
      
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      
      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe what you want to teach
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="E.g., 'A complete IB Mathematics course for grade 11 students, focusing on algebra, calculus, and statistics. Include topics for both SL and HL levels.'"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Curriculum (optional)
              </label>
              <select
                value={curriculum}
                onChange={(e) => setCurriculum(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select curriculum...</option>
                {curriculums.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade Level
              </label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="E.g., Grade 11, Year 12"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="quarter">Quarter (8-10 weeks)</option>
                <option value="semester">Semester (15-18 weeks)</option>
                <option value="year">Full Year</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Questions per Topic
              </label>
              <input
                type="number"
                value={questionsPerTopic}
                onChange={(e) => setQuestionsPerTopic(parseInt(e.target.value) || 5)}
                min={3}
                max={50}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={generateSyllabus}
              disabled={generating}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  Generate Syllabus
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Step 2: Preview */}
      {step === 'preview' && generatedSyllabus && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-900">{generatedSyllabus.title}</h2>
            <p className="mt-2 text-gray-600">{generatedSyllabus.description}</p>
            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <span className="bg-gray-100 px-3 py-1 rounded-full">{generatedSyllabus.curriculum}</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">{generatedSyllabus.grade}</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">{selectedTopics.size} topics selected</span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Topics</h3>
              <button
                onClick={() => {
                  if (selectedTopics.size === generatedSyllabus.topics.length) {
                    setSelectedTopics(new Set())
                  } else {
                    setSelectedTopics(new Set(generatedSyllabus.topics.map((_, i) => i)))
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedTopics.size === generatedSyllabus.topics.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="divide-y">
              {generatedSyllabus.topics.map((topic, index) => (
                <div
                  key={index}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedTopics.has(index) ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleTopic(index)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(index)}
                      onChange={() => toggleTopic(index)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{topic.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          topic.difficulty <= 2 ? 'bg-green-100 text-green-800' :
                          topic.difficulty <= 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          Level {topic.difficulty}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{topic.description}</p>
                      {topic.subtopics && topic.subtopics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {topic.subtopics.map((sub, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {topic.questionCount} questions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => setStep('input')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              ← Back to Edit
            </button>
            <button
              onClick={createSyllabusAndQuestions}
              disabled={selectedTopics.size === 0 || generatingQuestions}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Create Syllabus & Generate {selectedTopics.size * questionsPerTopic} Questions
            </button>
          </div>
        </div>
      )}
      
      {/* Step 3: Generating */}
      {step === 'generating' && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <svg className="mx-auto h-16 w-16 text-blue-600 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <h2 className="mt-6 text-xl font-bold text-gray-900">Creating Your Syllabus</h2>
          <p className="mt-2 text-gray-600">
            Generating {selectedTopics.size} topics and {selectedTopics.size * questionsPerTopic} questions...
          </p>
          <p className="mt-4 text-sm text-gray-500">
            This may take a minute. You&apos;ll be redirected when complete.
          </p>
        </div>
      )}
    </div>
  )
}
