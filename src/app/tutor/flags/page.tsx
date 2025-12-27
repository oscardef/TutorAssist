'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'

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
    correct_answer_json: { value: unknown; alternates?: string[] }
    alternate_answers_json: string[] | null
  } | null
  student: {
    email: string
  } | null
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'fixed' | 'dismissed'>('pending')
  
  // Review modal state
  const [reviewingFlag, setReviewingFlag] = useState<Flag | null>(null)
  const [reviewStatus, setReviewStatus] = useState<string>('reviewed')
  const [reviewNotes, setReviewNotes] = useState('')
  const [addAsAlternate, setAddAsAlternate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
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
  
  const filteredFlags = filter === 'all' 
    ? flags 
    : flags.filter(f => f.status === filter)
  
  const pendingCount = flags.filter(f => f.status === 'pending').length
  
  const flagTypeLabels: Record<string, { label: string; color: string }> = {
    incorrect_answer: { label: 'Incorrect Answer', color: 'bg-red-100 text-red-700' },
    unclear: { label: 'Unclear', color: 'bg-yellow-100 text-yellow-700' },
    typo: { label: 'Typo', color: 'bg-orange-100 text-orange-700' },
    too_hard: { label: 'Too Hard', color: 'bg-purple-100 text-purple-700' },
    claim_correct: { label: 'Claims Correct', color: 'bg-blue-100 text-blue-700' },
    missing_content: { label: 'Missing Content', color: 'bg-pink-100 text-pink-700' },
    multiple_valid: { label: 'Multiple Valid Answers', color: 'bg-indigo-100 text-indigo-700' },
    other: { label: 'Other', color: 'bg-gray-100 text-gray-700' },
  }
  
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-blue-100 text-blue-700',
    fixed: 'bg-green-100 text-green-700',
    dismissed: 'bg-gray-100 text-gray-500',
    accepted: 'bg-green-100 text-green-700',
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
        {pendingCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
            {pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        {(['all', 'pending', 'reviewed', 'fixed', 'dismissed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'pending' && pendingCount > 0 && (
              <span className="ml-1">({pendingCount})</span>
            )}
          </button>
        ))}
      </div>
      
      {filteredFlags.length > 0 ? (
        <div className="space-y-4">
          {filteredFlags.map((flag) => (
            <div
              key={flag.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${flagTypeLabels[flag.flag_type].color}`}>
                      {flagTypeLabels[flag.flag_type].label}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[flag.status]}`}>
                      {flag.status.charAt(0).toUpperCase() + flag.status.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(flag.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  
                  {flag.questions && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Question:</p>
                      <p className="text-sm text-gray-900 mt-1">{flag.questions.prompt_text}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Answer: {typeof flag.questions.correct_answer_json?.value === 'object' 
                          ? JSON.stringify(flag.questions.correct_answer_json.value) 
                          : String(flag.questions.correct_answer_json?.value)}
                      </p>
                    </div>
                  )}
                  
                  {flag.comment && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700">Student Comment:</p>
                      <p className="text-sm text-gray-600 mt-1">{flag.comment}</p>
                    </div>
                  )}
                  
                  {flag.student_answer && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-700">Student&apos;s Answer:</p>
                      <p className="text-sm text-blue-900 mt-1 font-mono">{flag.student_answer}</p>
                    </div>
                  )}
                  
                  {flag.review_notes && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-700">Review Notes:</p>
                      <p className="text-sm text-blue-900 mt-1">{flag.review_notes}</p>
                    </div>
                  )}
                  
                  <p className="mt-2 text-xs text-gray-500">
                    Reported by: {flag.student?.email || 'Unknown student'}
                  </p>
                </div>
                
                <div className="flex gap-2 ml-4">
                  {flag.questions && (
                    <Link
                      href={`/tutor/questions/${flag.questions.id}`}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View Question
                    </Link>
                  )}
                  {flag.status === 'pending' && (
                    <button
                      onClick={() => {
                        setReviewingFlag(flag)
                        setReviewStatus('reviewed')
                        setReviewNotes('')
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                    >
                      Review
                    </button>
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
