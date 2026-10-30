'use client'

import MathInput from '@/components/math-input'
import { LatexRenderer } from '@/components/latex-renderer'
import { ChoiceList } from '@/components/question-player'
import { Icons } from '@/components/ui/icons'
import type { QuestionPart, PartResult } from '@/lib/parts'

/**
 * Answer block for multi-part questions: (a), (b), … each with its own input
 * and marks. After checking, every part shows right/wrong and the correct
 * answer, and the header shows marks earned.
 */
export function PartsAnswerBlock({ parts, answers, onAnswer, submitted, results, onSubmitLast }: {
  parts: QuestionPart[]
  answers: string[]
  onAnswer: (index: number, value: string) => void
  submitted: boolean
  results: PartResult[] | null
  onSubmitLast?: () => void
}) {
  const Check = Icons.check
  const X = Icons.x
  const earned = results ? results.reduce((n, r) => n + r.earned, 0) : 0
  const total = parts.reduce((n, p) => n + p.marks, 0)

  return (
    <div className="space-y-4">
      {submitted && results && (
        <div className="flex items-center justify-between rounded-2xl bg-paper px-4 py-2.5 text-sm">
          <span className="font-bold text-ink">Marks</span>
          <span className="font-extrabold text-ink tnum">{earned} / {total}</span>
        </div>
      )}
      <ol className="space-y-4">
        {parts.map((part, i) => {
          const r = results?.[i]
          const ring = !submitted ? 'border-line' : r?.correct ? 'border-[#bfe4cd] bg-[#f3faf6]' : 'border-[#f3c7c7] bg-[#fdf5f5]'
          return (
            <li key={i} className={`rounded-2xl border-2 p-4 transition-colors ${ring}`}>
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white">{part.label}</span>
                <div className="min-w-0 flex-1 pt-1 text-ink"><LatexRenderer content={part.prompt} /></div>
                <span className="chip flex-shrink-0 tnum" title={`${part.marks} mark${part.marks === 1 ? '' : 's'}`}>[{part.marks}]</span>
              </div>
              {part.answer_type === 'multiple_choice' && part.correct_answer_json.choices ? (
                <ChoiceList
                  choices={part.correct_answer_json.choices}
                  selected={answers[i] === undefined || answers[i] === '' ? null : parseInt(answers[i], 10)}
                  onSelect={idx => onAnswer(i, String(idx))}
                  disabled={submitted}
                  correctIndex={part.correct_answer_json.correct}
                  answeredIndex={submitted && answers[i] !== '' ? parseInt(answers[i], 10) : null}
                />
              ) : (
                <MathInput
                  value={answers[i] || ''}
                  onChange={v => onAnswer(i, v)}
                  disabled={submitted}
                  placeholder={part.answer_type === 'numeric' ? 'Enter a number…' : 'Type your answer…'}
                  onSubmit={i === parts.length - 1 ? onSubmitLast : undefined}
                  status={submitted ? (r?.correct ? 'correct' : 'incorrect') : undefined}
                />
              )}
              {submitted && r && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex items-center gap-1 font-bold ${r.correct ? 'text-[#1f6b43]' : 'text-[#9b2c2c]'}`}>
                    {r.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {r.earned}/{r.marks}
                  </span>
                  {!r.correct && part.answer_type !== 'multiple_choice' && (
                    <span className="text-gray-600">Correct answer: <span className="font-semibold text-[#1f6b43]"><LatexRenderer content={String(part.correct_answer_json.value ?? '')} /></span></span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
