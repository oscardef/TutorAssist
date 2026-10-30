'use client'

import { LatexRenderer } from '@/components/latex-renderer'
import { AnswerDisplay } from '@/components/answer-display'
import { Icons } from '@/components/ui/icons'

/**
 * Shared building blocks for the question-answering experience (practice and
 * assignments). Icons carry meaning where a label would be noise; every icon
 * control still has an accessible name.
 */

export function IconButton({ label, onClick, active, disabled, children, className = '' }: {
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
        active ? 'border-spark-300 bg-spark-100 text-spark-700' : 'border-line bg-white text-gray-500 hover:border-gray-300 hover:text-ink'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/** Difficulty 1–5 as filled dots instead of a word. */
export function DifficultyDots({ level, className = '' }: { level: number | null | undefined; className?: string }) {
  const n = Math.max(0, Math.min(5, level || 0))
  const label = ['', 'Very easy', 'Easy', 'Medium', 'Hard', 'Very hard'][n] || 'Unrated'
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`Difficulty: ${label}`} title={label}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i < n ? 'bg-brand-500' : 'bg-paper-deep'}`} />
      ))}
    </span>
  )
}

/** Numbered trail of questions with state; current one is enlarged. */
export function ProgressTrail({ total, current, results }: { total: number; current: number; results: (boolean | null | undefined)[] }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Questions">
      {Array.from({ length: total }).map((_, idx) => {
        const r = results[idx]
        const isCurrent = idx === current
        const cls = r === true ? 'bg-[#2e8b57] text-white' : r === false ? 'bg-[#d64545] text-white' : idx <= current ? 'bg-brand-100 text-brand-800' : 'bg-paper-deep text-gray-400'
        return (
          <li
            key={idx}
            aria-current={isCurrent ? 'step' : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold tnum transition-transform ${cls} ${isCurrent ? 'scale-110 ring-2 ring-brand-500 ring-offset-2 ring-offset-white' : ''}`}
            title={r === true ? 'Correct' : r === false ? 'Incorrect' : `Question ${idx + 1}`}
          >
            {r === true ? '✓' : r === false ? '✗' : idx + 1}
          </li>
        )
      })}
    </ol>
  )
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'good' }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-deep" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${tone === 'good' ? 'bg-[#2e8b57]' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

type Choice = string | { text: string; latex?: string }

export function ChoiceList({ choices, selected, onSelect, disabled, correctIndex, answeredIndex }: {
  choices: Choice[]
  selected: number | null
  onSelect: (i: number) => void
  disabled?: boolean
  correctIndex?: number
  answeredIndex?: number | null
}) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label="Answer choices">
      {choices.map((raw, idx) => {
        const choice = typeof raw === 'string' ? { text: raw } : raw
        const isSelected = selected === idx
        const showCorrect = disabled && correctIndex === idx
        const showWrong = disabled && answeredIndex === idx && correctIndex !== idx
        const cls = showCorrect
          ? 'border-[#2e8b57] bg-[#e3f3ea]'
          : showWrong
          ? 'border-[#d64545] bg-[#fbe5e5]'
          : isSelected
          ? 'border-brand-500 bg-brand-50'
          : 'border-line bg-white hover:border-gray-300 hover:bg-paper'
        return (
          <button
            key={idx}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => !disabled && onSelect(idx)}
            disabled={disabled}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors ${cls} ${disabled ? 'cursor-default' : ''}`}
          >
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
              showCorrect ? 'bg-[#2e8b57] text-white' : showWrong ? 'bg-[#d64545] text-white' : isSelected ? 'bg-brand-600 text-white' : 'bg-paper-deep text-ink'
            }`}>
              {String.fromCharCode(65 + idx)}
            </span>
            <span className="text-ink"><LatexRenderer content={choice.latex || choice.text} /></span>
          </button>
        )
      })}
    </div>
  )
}

export function FeedbackBanner({ correct, message, onClaim, claiming, claimed, correctAnswer }: {
  correct: boolean
  message?: string
  onClaim?: () => void
  claiming?: boolean
  claimed?: boolean
  correctAnswer?: React.ReactNode
}) {
  const good = correct || claimed
  const Check = Icons.check
  const X = Icons.x
  return (
    <div className={`mt-6 rounded-2xl border-2 p-5 ${good ? 'border-[#bfe4cd] bg-[#e3f3ea]' : 'border-[#f3c7c7] bg-[#fbe5e5]'}`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${good ? 'bg-[#2e8b57]' : 'bg-[#d64545]'}`}>
            {good ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </div>
          <span className={`text-lg font-extrabold ${good ? 'text-[#1f6b43]' : 'text-[#9b2c2c]'}`}>
            {claimed ? 'Marked as correct' : message || (correct ? 'Correct' : 'Not quite')}
          </span>
        </div>
        {!good && onClaim && (
          <button type="button" onClick={onClaim} disabled={claiming} className="btn btn-secondary btn-sm">
            {claiming ? 'Sending…' : 'I was right'}
          </button>
        )}
      </div>
      {!good && correctAnswer && (
        <div className="mt-4 border-t border-[#f3c7c7] pt-4">
          <p className="mb-2 text-sm font-semibold text-[#9b2c2c]">Correct answer</p>
          <div className="inline-block rounded-lg bg-white px-3 py-2 font-semibold text-ink">{correctAnswer}</div>
        </div>
      )}
      {claimed && <p className="mt-3 text-sm text-[#1f6b43]">Your tutor will check this answer.</p>}
    </div>
  )
}

export function HintsPanel({ hints, visible, onReveal, onShowNext }: {
  hints: string[]
  visible: number
  onReveal: () => void
  onShowNext: () => void
}) {
  const Bulb = Icons.sparkles
  if (hints.length === 0) return null
  if (visible === 0) {
    return (
      <button type="button" onClick={onReveal} className="btn btn-secondary btn-sm mt-6">
        <Bulb className="h-4 w-4 text-spark-600" /> Hint
        <span className="chip chip-spark ml-1 px-2 py-0 text-xs">{hints.length}</span>
      </button>
    )
  }
  return (
    <div className="mt-6 rounded-2xl border border-spark-200 bg-spark-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-extrabold text-spark-700"><Bulb className="h-4 w-4" /> Hints</span>
        <span className="text-xs font-semibold text-spark-700 tnum">{visible} of {hints.length}</span>
      </div>
      <ol className="space-y-3">
        {hints.slice(0, visible).map((hint, idx) => (
          <li key={idx} className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-spark-200 text-xs font-extrabold text-spark-700 tnum">{idx + 1}</span>
            <p className="text-ink"><LatexRenderer content={hint} /></p>
          </li>
        ))}
      </ol>
      {visible < hints.length && (
        <button type="button" onClick={onShowNext} className="btn btn-ghost btn-sm mt-3 text-spark-700">Another hint</button>
      )}
    </div>
  )
}

export function SolutionPanel({ steps, open, onOpen }: {
  steps: { step: string; result?: string; latex?: string }[]
  open: boolean
  onOpen: () => void
}) {
  const Book = Icons.book
  if (!steps || steps.length === 0) return null
  if (!open) {
    return (
      <button type="button" onClick={onOpen} className="btn btn-secondary btn-sm mt-6">
        <Book className="h-4 w-4 text-brand-600" /> Worked solution
      </button>
    )
  }
  return (
    <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-extrabold text-brand-800"><Book className="h-4 w-4" /> Worked solution</p>
      <ol className="space-y-3">
        {steps.map((step, idx) => (
          <li key={idx} className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-extrabold text-brand-800 tnum">{idx + 1}</span>
            <div className="min-w-0">
              <p className="text-ink"><LatexRenderer content={step.step} /></p>
              {step.latex && <p className="mt-1 text-ink"><LatexRenderer content={step.latex} /></p>}
              {step.result && <p className="mt-1 font-semibold text-brand-800"><LatexRenderer content={step.result} /></p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function YourAnswerCard({ answer, correct, correctAnswer }: {
  answer: React.ReactNode
  correct: boolean
  correctAnswer?: React.ReactNode
}) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
      <p className="text-gray-600">Your answer: <span className="font-semibold text-ink">{answer}</span></p>
      {!correct && correctAnswer && (
        <p className="mt-1 text-gray-600">Correct answer: <span className="font-semibold text-[#1f6b43]">{correctAnswer}</span></p>
      )}
    </div>
  )
}

const FLAG_TYPES = [
  { type: 'incorrect_answer', label: 'The given answer is wrong' },
  { type: 'unclear', label: 'The question is confusing' },
  { type: 'typo', label: 'There is a typo' },
  { type: 'too_hard', label: 'Too difficult for this level' },
  { type: 'multiple_valid', label: 'More than one answer is valid' },
  { type: 'other', label: 'Something else' },
]

export function FlagModal({ open, onClose, flagType, setFlagType, comment, setComment, onSubmit, submitting }: {
  open: boolean
  onClose: () => void
  flagType: string
  setFlagType: (t: string) => void
  comment: string
  setComment: (c: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  const X = Icons.x
  const Flag = Icons.flag
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="flag-title">
      <div className="card animate-scale-in w-full max-w-md rounded-b-none p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="flag-title" className="inline-flex items-center gap-2 text-lg font-extrabold text-ink"><Flag className="h-5 w-5 text-spark-600" /> Report this question</h3>
          <IconButton label="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </div>
        <div className="grid gap-2" role="radiogroup" aria-label="What is wrong">
          {FLAG_TYPES.map(({ type, label }) => (
            <button key={type} type="button" role="radio" aria-checked={flagType === type} onClick={() => setFlagType(type)}
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors ${flagType === type ? 'border-spark-400 bg-spark-50 text-ink' : 'border-line text-gray-700 hover:border-gray-300 hover:bg-paper'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label htmlFor="flag-comment" className="label">Details <span className="font-normal text-gray-500">(optional)</span></label>
          <textarea id="flag-comment" value={comment} onChange={e => setComment(e.target.value)} rows={3} className="input resize-none" placeholder="What did you expect?" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="button" onClick={onSubmit} disabled={!flagType || submitting} className="btn btn-spark">{submitting ? 'Sending…' : 'Send report'}</button>
        </div>
      </div>
    </div>
  )
}

export function CompletionModal({ open, correct, total, onBack, onRedo, onReview }: {
  open: boolean
  correct: number
  total: number
  onBack: () => void
  onRedo: () => void
  onReview: () => void
}) {
  if (!open) return null
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="done-title">
      <div className="card animate-scale-in w-full max-w-md p-8 text-center shadow-xl">
        <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto" aria-hidden="true">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-paper-deep)" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={pct >= 70 ? '#2e8b57' : pct >= 50 ? 'var(--color-spark-400)' : '#d64545'} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 60 60)" />
          <text x="60" y="68" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--color-ink)">{pct}%</text>
        </svg>
        <h3 id="done-title" className="mt-4 text-2xl font-extrabold text-ink">{pct >= 70 ? 'Nicely done' : pct >= 50 ? 'Good effort' : 'Keep going'}</h3>
        <p className="mt-2 text-gray-600 tnum">{correct} of {total} correct</p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onBack} className="btn btn-primary btn-lg w-full">Back to assignments</button>
          <button type="button" onClick={onRedo} className="btn btn-secondary w-full">Try again</button>
          <button type="button" onClick={onReview} className="btn btn-ghost w-full">Review answers</button>
        </div>
      </div>
    </div>
  )
}
