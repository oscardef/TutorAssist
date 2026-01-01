'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import LatexRenderer from '@/components/latex-renderer'

interface Flag {
  id: string
  flag_type: 'incorrect_answer' | 'unclear' | 'typo' | 'too_hard' | 'claim_correct' | 'missing_content' | 'multiple_valid' | 'other'
  comment: string | null
  status: 'pending' | 'reviewed' | 'fixed' | 'dismissed' | 'accepted'
  review_notes: string | null
  student_answer: string | null
  attempt_id: string | null
  created_at: string
  questions: {
    id: string
    prompt_text: string
    prompt_latex: string | null
    correct_answer_json: { value: unknown; alternates?: string[] }
    alternate_answers_json: string[] | null
  } | null
  student: {
    email: string
    name: string
  } | null
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'fixed' | 'dismissed' | 'accepted'>('pending')
  
  // Review modal state
  const [reviewingFlag, setReviewingFlag] = useState<Flag | null>(null)
  const [reviewStatus, setReviewStatus] = useState<string>('reviewed')
  const [reviewNotes, setReviewNotes] = useState('')
  const [addAsAlternate, setAddAsAlternate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // AI bulk review state
  const [selectedFlagIds, setSelectedFlagIds] = useState<Set<string>>(new Set())
  const [aiReviewing, setAiReviewing] = useState(false)
  const [aiResults, setAiResults] = useState<Map<string, {
    recommendation: string
    confidence: string
    reasoning: string
    suggestedAction?: string
    suggestedFix?: string
  }>>(new Map())
  const [showAiResults, setShowAiResults] = useState(false)
  
  useEffect(() => {
    fetchFlags()
  }, [])
  
  async function fetchFlags() {
    try {
      const response = await fetch('/api/flags')
      const data = await response.json()
      setFlags(data.flags || [])
    } catch {
      setError('Failed to load flags')
    } finally {
      setLoading(false)
    }
  }
  
  // Quick actions for flags
  async function quickDismiss(flagId: string) {
    await updateFlag(flagId, 'dismissed')
  }
  
  async function quickAccept(flag: Flag) {
    if (flag.flag_type === 'claim_correct' && flag.student_answer) {
      // Open modal with accept option pre-selected
      setReviewingFlag(flag)
      setReviewStatus('accepted')
      setAddAsAlternate(true)
      setReviewNotes('')
    } else {
      await updateFlag(flag.id, 'reviewed')
    }
  }
  
  async function updateFlag(flagId: string, status: string, addAlt = false) {
    setSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch('/api/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: flagId,
          status,
          addAsAlternate: addAlt,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update flag')
      }
      
      // Update local state
      setFlags(prev => prev.map(f => 
        f.id === flagId 
          ? { ...f, status: status as Flag['status'] }
          : f
      ))
      
      setSuccess(`Flag ${status}`)
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update flag')
    } finally {
      setSubmitting(false)
    }
  }
  
  async function handleReviewSubmit() {
    if (!reviewingFlag) return
    
    setSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch('/api/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reviewingFlag.id,
          status: reviewStatus,
          reviewNotes: reviewNotes.trim() || null,
          addAsAlternate: reviewingFlag.flag_type === 'claim_correct' && reviewStatus === 'accepted' && addAsAlternate,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update flag')
      }
      
      // Update local state
      setFlags(prev => prev.map(f => 
        f.id === reviewingFlag.id 
          ? { ...f, status: reviewStatus as Flag['status'], review_notes: reviewNotes.trim() || null }
          : f
      ))
      
      setReviewingFlag(null)
      setReviewNotes('')
      setAddAsAlternate(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update flag')
    } finally {
      setSubmitting(false)
    }
  }
  
  // Toggle flag selection for AI review
  function toggleFlagSelection(flagId: string) {
    setSelectedFlagIds(prev => {
      const next = new Set(prev)
      if (next.has(flagId)) {
        next.delete(flagId)
      } else {
        next.add(flagId)
      }
      return next
    })
  }
  
  // Select all pending flags
  function selectAllPending() {
    const pendingIds = flags.filter(f => f.status === 'pending').map(f => f.id)
    if (selectedFlagIds.size === pendingIds.length) {
      setSelectedFlagIds(new Set())
    } else {
      setSelectedFlagIds(new Set(pendingIds))
    }
  }
  
  // Run AI review on selected flags
  async function runAiReview() {
    if (selectedFlagIds.size === 0) return
    
    setAiReviewing(true)
    setError(null)
    setAiResults(new Map())
    
    try {
      const response = await fetch('/api/flags/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagIds: Array.from(selectedFlagIds),
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run AI review')
      }
      
      // Store results in map for easy lookup
      const resultsMap = new Map()
      for (const result of data.results || []) {
        resultsMap.set(result.flagId, {
          recommendation: result.recommendation,
          confidence: result.confidence,
          reasoning: result.reasoning,
          suggestedAction: result.suggestedAction,
          suggestedFix: result.suggestedFix,
        })
      }
      setAiResults(resultsMap)
      setShowAiResults(true)
      setSuccess(`AI analyzed ${data.flagsAnalyzed} flags`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run AI review')
    } finally {
      setAiReviewing(false)
    }
  }
  
  // Apply AI recommendation to a flag
  async function applyAiRecommendation(flagId: string) {
    const result = aiResults.get(flagId)
    const flag = flags.find(f => f.id === flagId)
    if (!result || !flag) return
    
    let status: string = 'reviewed'
    let addAlt = false
    
    if (result.recommendation === 'accept') {
      status = 'accepted'
      addAlt = flag.flag_type === 'claim_correct' && !!flag.student_answer
    } else if (result.recommendation === 'dismiss') {
      status = 'dismissed'
    } else if (result.recommendation === 'fix_question') {
      status = 'reviewed' // Leave for manual fixing
    }
    
    await updateFlag(flagId, status, addAlt)
    // Remove from AI results after applying
    setAiResults(prev => {
      const next = new Map(prev)
      next.delete(flagId)
      return next
    })
    setSelectedFlagIds(prev => {
      const next = new Set(prev)
      next.delete(flagId)
      return next
    })
  }
  
  const filteredFlags = filter === 'all' 
    ? flags 
    : flags.filter(f => f.status === filter)
  
  const pendingCount = flags.filter(f => f.status === 'pending').length
  const acceptedCount = flags.filter(f => f.status === 'accepted').length
  
  const flagTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
    incorrect_answer: { label: 'Incorrect Answer', color: 'bg-red-100 text-red-700', icon: '❌' },
    unclear: { label: 'Unclear', color: 'bg-yellow-100 text-yellow-700', icon: '❓' },
    typo: { label: 'Typo', color: 'bg-orange-100 text-orange-700', icon: '📝' },
    too_hard: { label: 'Too Hard', color: 'bg-purple-100 text-purple-700', icon: '🔥' },
    claim_correct: { label: 'Claims Correct', color: 'bg-blue-100 text-blue-700', icon: '✋' },
    missing_content: { label: 'Missing Content', color: 'bg-pink-100 text-pink-700', icon: '📄' },
    multiple_valid: { label: 'Multiple Valid', color: 'bg-indigo-100 text-indigo-700', icon: '🔀' },
    other: { label: 'Other', color: 'bg-gray-100 text-gray-700', icon: '💬' },
  }
  
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-blue-100 text-blue-700',
    fixed: 'bg-green-100 text-green-700',
    dismissed: 'bg-gray-100 text-gray-500',
    accepted: 'bg-emerald-100 text-emerald-700',
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Flags</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and resolve student-reported issues with questions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {acceptedCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              {acceptedCount} accepted
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          {success}
        </div>
      )}
      
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4 overflow-x-auto">
        {(['all', 'pending', 'accepted', 'reviewed', 'fixed', 'dismissed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'pending' && pendingCount > 0 && (
              <span className="ml-1">({pendingCount})</span>
            )}
            {status === 'accepted' && acceptedCount > 0 && (
              <span className="ml-1">({acceptedCount})</span>
            )}
          </button>
        ))}
      </div>
      
      {/* AI Bulk Review Section */}
      {pendingCount > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">AI Bulk Review</h3>
                <p className="text-sm text-gray-600">
                  Select flags and let AI analyze them to suggest resolutions.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={selectAllPending}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                {selectedFlagIds.size === pendingCount ? 'Deselect All' : `Select All (${pendingCount})`}
              </button>
              <button
                onClick={runAiReview}
                disabled={selectedFlagIds.size === 0 || aiReviewing}
                className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {aiReviewing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    Review with AI ({selectedFlagIds.size})
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* AI Results Summary */}
          {showAiResults && aiResults.size > 0 && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-purple-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">AI Recommendations</h4>
                <button
                  onClick={() => setShowAiResults(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Hide
                </button>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-600">
                  ✓ Accept: {Array.from(aiResults.values()).filter(r => r.recommendation === 'accept').length}
                </span>
                <span className="text-gray-500">
                  ✗ Dismiss: {Array.from(aiResults.values()).filter(r => r.recommendation === 'dismiss').length}
                </span>
                <span className="text-orange-600">
                  ⚠ Fix: {Array.from(aiResults.values()).filter(r => r.recommendation === 'fix_question').length}
                </span>
                <span className="text-blue-600">
                  ? Review: {Array.from(aiResults.values()).filter(r => r.recommendation === 'needs_review').length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {filteredFlags.length > 0 ? (
        <div className="space-y-4">
          {filteredFlags.map((flag) => (
            <div
              key={flag.id}
              className={`rounded-lg border bg-white p-4 transition-colors ${
                flag.status === 'pending' ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-200'
              } ${selectedFlagIds.has(flag.id) ? 'ring-2 ring-purple-500 border-purple-300' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {/* Selection checkbox for pending flags */}
                    {flag.status === 'pending' && (
                      <button
                        onClick={() => toggleFlagSelection(flag.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selectedFlagIds.has(flag.id)
                            ? 'border-purple-500 bg-purple-500 text-white'
                            : 'border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {selectedFlagIds.has(flag.id) && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${flagTypeLabels[flag.flag_type].color}`}>
                      <span>{flagTypeLabels[flag.flag_type].icon}</span>
                      {flagTypeLabels[flag.flag_type].label}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[flag.status]}`}>
                      {flag.status.charAt(0).toUpperCase() + flag.status.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(flag.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  
                  {/* AI Recommendation Banner */}
                  {aiResults.has(flag.id) && (
                    <div className={`mb-3 p-3 rounded-lg border ${
                      aiResults.get(flag.id)?.recommendation === 'accept' 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : aiResults.get(flag.id)?.recommendation === 'dismiss'
                        ? 'bg-gray-50 border-gray-200'
                        : aiResults.get(flag.id)?.recommendation === 'fix_question'
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                              </svg>
                              AI Suggestion
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              aiResults.get(flag.id)?.confidence === 'high' 
                                ? 'bg-green-100 text-green-700' 
                                : aiResults.get(flag.id)?.confidence === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {aiResults.get(flag.id)?.confidence} confidence
                            </span>
                          </div>
                          <p className={`text-sm font-medium ${
                            aiResults.get(flag.id)?.recommendation === 'accept' 
                              ? 'text-emerald-700' 
                              : aiResults.get(flag.id)?.recommendation === 'dismiss'
                              ? 'text-gray-700'
                              : aiResults.get(flag.id)?.recommendation === 'fix_question'
                              ? 'text-orange-700'
                              : 'text-blue-700'
                          }`}>
                            {aiResults.get(flag.id)?.recommendation === 'accept' && '✓ Accept - Student is correct'}
                            {aiResults.get(flag.id)?.recommendation === 'dismiss' && '✗ Dismiss - Student answer is incorrect'}
                            {aiResults.get(flag.id)?.recommendation === 'fix_question' && '⚠ Fix Question - Issue found'}
                            {aiResults.get(flag.id)?.recommendation === 'needs_review' && '? Needs Manual Review'}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{aiResults.get(flag.id)?.reasoning}</p>
                          {aiResults.get(flag.id)?.suggestedFix && (
                            <p className="text-xs text-orange-600 mt-1">
                              <strong>Suggested fix:</strong> {aiResults.get(flag.id)?.suggestedFix}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => applyAiRecommendation(flag.id)}
                          disabled={submitting}
                          className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {flag.questions && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1">Question:</p>
                      <div className="text-sm text-gray-900">
                        <LatexRenderer content={flag.questions.prompt_latex || flag.questions.prompt_text} />
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Expected answer:</span>
                        <code className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded">
                          {typeof flag.questions.correct_answer_json?.value === 'object' 
                            ? JSON.stringify(flag.questions.correct_answer_json.value) 
                            : String(flag.questions.correct_answer_json?.value)}
                        </code>
                        {flag.questions.correct_answer_json?.alternates && flag.questions.correct_answer_json.alternates.length > 0 && (
                          <span className="text-gray-400">
                            (+{flag.questions.correct_answer_json.alternates.length} alternates)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {flag.student_answer && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-medium text-blue-600 mb-1">Student&apos;s Answer:</p>
                      <code className="text-sm text-blue-900 font-mono">{flag.student_answer}</code>
                    </div>
                  )}
                  
                  {flag.comment && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-xs font-medium text-amber-600 mb-1">Student&apos;s Comment:</p>
                      <p className="text-sm text-amber-900">{flag.comment}</p>
                    </div>
                  )}
                  
                  {flag.review_notes && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-medium text-slate-600 mb-1">Review Notes:</p>
                      <p className="text-sm text-slate-900">{flag.review_notes}</p>
                    </div>
                  )}
                  
                  <p className="mt-3 text-xs text-gray-500">
                    Reported by: <span className="font-medium">{flag.student?.name || flag.student?.email || 'Unknown student'}</span>
                  </p>
                </div>
                
                <div className="flex flex-col gap-2 ml-4 shrink-0">
                  {flag.questions && (
                    <>
                      <Link
                        href={`/tutor/questions/${flag.questions.id}`}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 text-center"
                      >
                        View Question
                      </Link>
                      <Link
                        href={`/tutor/questions/${flag.questions.id}?edit=true`}
                        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 text-center"
                      >
                        Edit Question
                      </Link>
                    </>
                  )}
                  
                  {flag.status === 'pending' && (
                    <div className="border-t border-gray-200 pt-2 mt-1 space-y-2">
                      {/* Quick accept for claim_correct flags */}
                      {flag.flag_type === 'claim_correct' && flag.student_answer && (
                        <button
                          onClick={() => quickAccept(flag)}
                          disabled={submitting}
                          className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Accept Answer
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          setReviewingFlag(flag)
                          setReviewStatus('reviewed')
                          setReviewNotes('')
                          setAddAsAlternate(false)
                        }}
                        className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                      >
                        Review
                      </button>
                      
                      <button
                        onClick={() => quickDismiss(flag.id)}
                        disabled={submitting}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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
              d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            {filter === 'pending' ? 'No pending flags' : 'No flags found'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'pending' 
              ? 'All flags have been reviewed!'
              : 'When students report issues with questions, they will appear here.'}
          </p>
        </div>
      )}
      
      {/* Review Modal */}
      {reviewingFlag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Flag</h2>
            
            {/* Show student's answer for claim_correct flags */}
            {reviewingFlag.flag_type === 'claim_correct' && reviewingFlag.student_answer && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-700">Student claims this answer is correct:</p>
                <p className="text-lg text-blue-900 mt-1 font-mono">{reviewingFlag.student_answer}</p>
                {reviewingFlag.questions?.correct_answer_json && (
                  <p className="text-sm text-gray-600 mt-2">
                    Expected: <span className="font-mono">{String(reviewingFlag.questions.correct_answer_json.value)}</span>
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="reviewed">Reviewed</option>
                  {reviewingFlag.flag_type === 'claim_correct' && (
                    <option value="accepted">Accept - Student was correct</option>
                  )}
                  <option value="fixed">Fixed</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
              
              {/* Option to add as alternate answer */}
              {reviewingFlag.flag_type === 'claim_correct' && reviewStatus === 'accepted' && reviewingFlag.student_answer && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addAsAlternate}
                      onChange={(e) => setAddAsAlternate(e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-green-800">
                      Add &quot;{reviewingFlag.student_answer}&quot; as an alternate correct answer
                    </span>
                  </label>
                  <p className="text-xs text-green-600 mt-1 ml-6">
                    This will allow future students to get this answer marked correct automatically.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes (optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add notes about how this was resolved..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setReviewingFlag(null)
                  setAddAsAlternate(false)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
