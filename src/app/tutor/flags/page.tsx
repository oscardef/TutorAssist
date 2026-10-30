'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import LatexRenderer from '@/components/latex-renderer'
import { Icons } from '@/components/ui/icons'
import { IconButton } from '@/components/question-player'

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

interface FlagInsight {
  type: 'pattern' | 'question_issue' | 'student_pattern' | 'recommendation'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  affectedCount: number
  questionIds?: string[]
  actionSuggestion?: string
}

interface InsightsData {
  insights: FlagInsight[]
  summary: {
    totalFlags: number
    pendingCount: number
    acceptedRate: number
    commonTypes: { type: string; count: number }[]
    problematicQuestionCount: number
  }
  aiSummary?: string | null
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'fixed' | 'dismissed' | 'accepted'>('pending')
  const [activeTab, setActiveTab] = useState<'flags' | 'insights'>('flags')
  
  // Insights state
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  
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
  
  useEffect(() => {
    fetchFlags()
  }, [])
  
  // Fetch insights when tab changes to insights
  useEffect(() => {
    if (activeTab === 'insights' && !insights && !loadingInsights) {
      fetchInsights()
    }
  }, [activeTab, insights, loadingInsights])
  
  async function fetchInsights() {
    setLoadingInsights(true)
    try {
      const response = await fetch('/api/flags/insights')
      const data = await response.json()
      if (response.ok) {
        setInsights(data)
      } else {
        setError(data.error || 'Failed to load insights')
      }
    } catch {
      setError('Failed to load insights')
    } finally {
      setLoadingInsights(false)
    }
  }
  
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
  
  const flagTypeLabels: Record<string, { label: string; cls: string }> = {
    incorrect_answer: { label: 'Answer wrong', cls: 'chip-bad' },
    unclear: { label: 'Confusing', cls: 'chip-spark' },
    typo: { label: 'Typo', cls: 'chip-spark' },
    too_hard: { label: 'Too hard', cls: 'chip' },
    claim_correct: { label: 'Claims correct', cls: 'chip-brand' },
    missing_content: { label: 'Missing content', cls: 'chip' },
    multiple_valid: { label: 'Several valid', cls: 'chip-brand' },
    other: { label: 'Other', cls: 'chip' },
  }
  const statusLabels: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'chip-spark' },
    reviewed: { label: 'Reviewed', cls: 'chip' },
    fixed: { label: 'Fixed', cls: 'chip-good' },
    dismissed: { label: 'Dismissed', cls: 'chip' },
    accepted: { label: 'Accepted', cls: 'chip-good' },
  }
  const filters: { key: typeof filter; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'accepted', label: 'Accepted', count: acceptedCount },
    { key: 'reviewed', label: 'Reviewed', count: flags.filter(f => f.status === 'reviewed').length },
    { key: 'fixed', label: 'Fixed', count: flags.filter(f => f.status === 'fixed').length },
    { key: 'dismissed', label: 'Dismissed', count: flags.filter(f => f.status === 'dismissed').length },
    { key: 'all', label: 'All', count: flags.length },
  ]
  const Sparkles = Icons.sparkles
  const Progress = Icons.progress
  const Check = Icons.check
  const X = Icons.x
  const Questions = Icons.questions
  const Flag = Icons.flag
  const selectable = filteredFlags.filter(f => f.status === 'pending')
  const allSelected = selectable.length > 0 && selectable.every(f => selectedFlagIds.has(f.id))

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 skeleton" />
        <div className="h-10 w-full skeleton" />
        <div className="h-24 w-full skeleton" />
        <div className="h-24 w-full skeleton" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Flags</h1>
          <p className="page-subtitle">Questions your students reported. Decide, fix, or dismiss.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setActiveTab(activeTab === 'insights' ? 'flags' : 'insights') }} className={`btn btn-secondary btn-sm ${activeTab === 'insights' ? '!border-brand-400 !bg-brand-50' : ''}`} aria-pressed={activeTab === 'insights'}>
            <Progress className="h-4 w-4" /> Patterns
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error flex items-center justify-between" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="rounded p-1 hover:bg-white/50"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && <div className="alert-success" role="status">{success}</div>}

      {activeTab === 'insights' && (
        <section className="card p-5">
          {loadingInsights ? (
            <p className="text-sm text-gray-500">Looking for patterns…</p>
          ) : insights ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><p className="text-xs font-semibold text-gray-500">Flags</p><p className="text-xl font-extrabold text-ink tnum">{insights.summary.totalFlags}</p></div>
                <div><p className="text-xs font-semibold text-gray-500">Pending</p><p className="text-xl font-extrabold text-ink tnum">{insights.summary.pendingCount}</p></div>
                <div><p className="text-xs font-semibold text-gray-500">Accepted</p><p className="text-xl font-extrabold text-ink tnum">{Math.round(insights.summary.acceptedRate)}%</p></div>
                <div><p className="text-xs font-semibold text-gray-500">Questions with issues</p><p className="text-xl font-extrabold text-ink tnum">{insights.summary.problematicQuestionCount}</p></div>
              </div>
              {insights.aiSummary && <p className="text-sm text-gray-700">{insights.aiSummary}</p>}
              {insights.insights.length > 0 && (
                <ul className="divide-y divide-line">
                  {insights.insights.map((ins, idx) => (
                    <li key={idx} className="flex items-start gap-3 py-3">
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${ins.severity === 'high' ? 'bg-[#d64545]' : ins.severity === 'medium' ? 'bg-spark-400' : 'bg-brand-400'}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{ins.title} <span className="font-normal text-gray-500 tnum">· {ins.affectedCount}</span></p>
                        <p className="text-sm text-gray-600">{ins.description}</p>
                        {ins.actionSuggestion && <p className="mt-1 text-sm font-semibold text-brand-700">{ins.actionSuggestion}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={fetchInsights} className="btn btn-ghost btn-sm">Refresh</button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No patterns yet.</p>
          )}
        </section>
      )}

      {/* Filter row + bulk tools */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter flags">
          {filters.map(f => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`chip ${filter === f.key ? 'chip-brand' : ''}`} aria-pressed={filter === f.key}>
              {f.label} <span className="tnum opacity-70">{f.count}</span>
            </button>
          ))}
        </div>
        {selectable.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={allSelected} onChange={selectAllPending} className="h-4 w-4 rounded border-gray-300 accent-brand-600" /> Select pending
            </label>
            <button type="button" onClick={runAiReview} disabled={selectedFlagIds.size === 0 || aiReviewing} className="btn btn-secondary btn-sm" title="Suggest a resolution for the selected flags">
              <Sparkles className="h-4 w-4 text-spark-600" /> {aiReviewing ? 'Thinking…' : `Suggest (${selectedFlagIds.size})`}
            </button>
          </div>
        )}
      </div>

      {/* Flags */}
      {filteredFlags.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper-deep text-gray-500"><Flag className="h-6 w-6" /></div>
          <p className="mt-4 font-bold text-ink">Nothing here</p>
          <p className="mt-1 text-sm text-gray-500">{filter === 'pending' ? 'No flags waiting for you.' : 'No flags with this status.'}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredFlags.map(flag => {
            const type = flagTypeLabels[flag.flag_type] || flagTypeLabels.other
            const status = statusLabels[flag.status] || statusLabels.pending
            const ai = aiResults.get(flag.id)
            const expected = flag.questions?.correct_answer_json?.value
            return (
              <li key={flag.id} className="card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  {flag.status === 'pending' && (
                    <input type="checkbox" checked={selectedFlagIds.has(flag.id)} onChange={() => toggleFlagSelection(flag.id)} aria-label="Select flag" className="mt-1.5 h-4 w-4 rounded border-gray-300 accent-brand-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`chip ${type.cls}`}>{type.label}</span>
                      <span className={`chip ${status.cls}`}>{status.label}</span>
                      <span className="text-gray-500">{flag.student?.name || 'Student'} · {format(new Date(flag.created_at), 'd MMM')}</span>
                    </div>
                    <p className="mt-2 text-ink"><LatexRenderer content={flag.questions?.prompt_latex || flag.questions?.prompt_text || ''} /></p>
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      {flag.student_answer && (
                        <div><dt className="text-xs font-semibold text-gray-500">Student answered</dt><dd className="font-semibold text-ink"><LatexRenderer content={flag.student_answer} /></dd></div>
                      )}
                      {expected !== undefined && expected !== null && (
                        <div><dt className="text-xs font-semibold text-gray-500">Expected</dt><dd className="font-semibold text-[#1f6b43]"><LatexRenderer content={String(expected)} /></dd></div>
                      )}
                      {flag.comment && (
                        <div className="sm:col-span-2"><dt className="text-xs font-semibold text-gray-500">Comment</dt><dd className="text-gray-700">{flag.comment}</dd></div>
                      )}
                      {flag.review_notes && (
                        <div className="sm:col-span-2"><dt className="text-xs font-semibold text-gray-500">Your note</dt><dd className="text-gray-700">{flag.review_notes}</dd></div>
                      )}
                    </dl>
                    {ai && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-spark-200 bg-spark-50 px-3 py-2 text-sm">
                        <Sparkles className="h-4 w-4 text-spark-600" />
                        <span className="font-semibold text-ink">Suggests: {ai.recommendation.replace('_', ' ')}</span>
                        <span className="text-gray-600">{ai.reasoning}</span>
                        <button type="button" onClick={() => applyAiRecommendation(flag.id)} className="btn btn-spark btn-sm ml-auto">Apply</button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {flag.questions?.id && (
                      <Link href={`/tutor/questions/${flag.questions.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-gray-500 hover:border-gray-300 hover:text-ink" aria-label="Open question" title="Open question">
                        <Questions className="h-5 w-5" />
                      </Link>
                    )}
                    {flag.status === 'pending' && (
                      <>
                        <IconButton label={flag.flag_type === 'claim_correct' ? 'Accept the student’s answer' : 'Mark as reviewed'} onClick={() => quickAccept(flag)} disabled={submitting} className="!text-[#1f6b43] hover:!border-[#bfe4cd]"><Check className="h-5 w-5" /></IconButton>
                        <IconButton label="Dismiss" onClick={() => quickDismiss(flag.id)} disabled={submitting}><X className="h-5 w-5" /></IconButton>
                        <button type="button" onClick={() => { setReviewingFlag(flag); setReviewStatus(flag.flag_type === 'claim_correct' ? 'accepted' : 'reviewed'); setAddAsAlternate(flag.flag_type === 'claim_correct'); setReviewNotes('') }} className="btn btn-primary btn-sm">Review</button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Review modal */}
      {reviewingFlag && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="card animate-scale-in w-full max-w-lg rounded-b-none p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="review-title" className="text-lg font-extrabold text-ink">Review flag</h2>
              <IconButton label="Close" onClick={() => setReviewingFlag(null)}><X className="h-5 w-5" /></IconButton>
            </div>
            <p className="text-ink"><LatexRenderer content={reviewingFlag.questions?.prompt_latex || reviewingFlag.questions?.prompt_text || ''} /></p>
            {reviewingFlag.student_answer && (
              <div className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="text-gray-500">Student answered </span><span className="font-semibold text-ink"><LatexRenderer content={reviewingFlag.student_answer} /></span>
                {reviewingFlag.questions?.correct_answer_json?.value !== undefined && (
                  <><span className="text-gray-500"> · expected </span><span className="font-semibold text-[#1f6b43]"><LatexRenderer content={String(reviewingFlag.questions.correct_answer_json.value)} /></span></>
                )}
              </div>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Decision">
              {[
                { v: 'accepted', l: 'Accept', d: 'The student was right' },
                { v: 'fixed', l: 'Fixed', d: 'I corrected the question' },
                { v: 'reviewed', l: 'Reviewed', d: 'Seen, no change needed' },
                { v: 'dismissed', l: 'Dismiss', d: 'Not an issue' },
              ].map(o => (
                <button key={o.v} type="button" role="radio" aria-checked={reviewStatus === o.v} onClick={() => setReviewStatus(o.v)} className={`rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${reviewStatus === o.v ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-gray-300'}`}>
                  <span className="block text-sm font-bold text-ink">{o.l}</span>
                  <span className="block text-xs text-gray-500">{o.d}</span>
                </button>
              ))}
            </div>
            {reviewingFlag.flag_type === 'claim_correct' && reviewStatus === 'accepted' && reviewingFlag.student_answer && (
              <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={addAsAlternate} onChange={e => setAddAsAlternate(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-brand-600" />
                Also accept this answer for everyone in future
              </label>
            )}
            <div className="mt-4">
              <label htmlFor="review-notes" className="label">Note <span className="font-normal text-gray-500">(optional)</span></label>
              <textarea id="review-notes" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} className="input resize-none" placeholder="Shown to you only…" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReviewingFlag(null)} className="btn btn-ghost">Cancel</button>
              <button type="button" onClick={handleReviewSubmit} disabled={submitting} className="btn btn-primary">{submitting ? 'Saving…' : 'Save decision'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
