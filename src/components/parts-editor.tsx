'use client'

import type { QuestionPart, PartAnswerType } from '@/lib/parts'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'

const TYPES: { v: PartAnswerType; l: string }[] = [
  { v: 'numeric', l: 'Number' },
  { v: 'expression', l: 'Expression' },
  { v: 'short_answer', l: 'Short answer' },
  { v: 'multiple_choice', l: 'Multiple choice' },
]

function blankPart(i: number): QuestionPart {
  return { label: String.fromCharCode(97 + i), prompt: '', answer_type: 'numeric', correct_answer_json: { value: '' }, marks: 1 }
}

/**
 * Authoring UI for exam-style parts (a), (b), (c). The question text above is
 * the shared stem; each part has its own prompt, answer and marks.
 */
export function PartsEditor({ value, onChange }: { value: QuestionPart[] | null; onChange: (parts: QuestionPart[] | null) => void }) {
  const parts = value || []
  const Plus = Icons.plus
  const X = Icons.x
  const set = (next: QuestionPart[]) => onChange(next.length ? next.map((p, i) => ({ ...p, label: String.fromCharCode(97 + i) })) : null)
  const patch = (i: number, p: Partial<QuestionPart>) => set(parts.map((x, idx) => (idx === i ? { ...x, ...p } : x)))
  const total = parts.reduce((n, p) => n + (p.marks || 0), 0)

  if (parts.length === 0) {
    return (
      <button type="button" onClick={() => set([blankPart(0), blankPart(1)])} className="btn btn-secondary btn-sm">
        <Plus className="h-4 w-4" /> Split into parts (a), (b)…
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 text-gray-600">The question text above is the shared stem. <InfoTip text="Students answer every part, then check once. Each part is marked separately; the score is marks earned over the total." className="text-gray-500" /></span>
        <span className="chip tnum">Total {total} mark{total === 1 ? '' : 's'}</span>
      </div>
      <ol className="space-y-3">
        {parts.map((part, i) => (
          <li key={i} className="rounded-2xl border border-line p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white">{part.label}</span>
              <div className="min-w-0 flex-1 space-y-3">
                <textarea value={part.prompt} onChange={e => patch(i, { prompt: e.target.value })} rows={2} className="input resize-y" placeholder="What this part asks, e.g. Find \(f'(x)\)…" aria-label={`Part ${part.label} prompt`} />
                <div className="flex flex-wrap items-end gap-2">
                  <label>
                    <span className="hint block">Answer type</span>
                    <select value={part.answer_type} onChange={e => {
                      const t = e.target.value as PartAnswerType
                      patch(i, { answer_type: t, correct_answer_json: t === 'multiple_choice' ? { choices: ['', '', '', ''], correct: 0 } : { value: '' } })
                    }} className="input !min-h-10 w-40">
                      {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </label>
                  {part.answer_type !== 'multiple_choice' && (
                    <label className="min-w-0 flex-1">
                      <span className="hint block">Correct answer</span>
                      <input value={String(part.correct_answer_json.value ?? '')} onChange={e => patch(i, { correct_answer_json: { ...part.correct_answer_json, value: e.target.value } })} className="input !min-h-10" placeholder={part.answer_type === 'numeric' ? '0.667' : '6x - 4'} />
                    </label>
                  )}
                  {part.answer_type !== 'multiple_choice' && (
                    <label className="min-w-0 flex-1">
                      <span className="hint block">Also accept <span className="text-gray-400">(comma separated)</span></span>
                      <input value={(part.correct_answer_json.alternates || []).join(', ')} onChange={e => patch(i, { correct_answer_json: { ...part.correct_answer_json, alternates: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} className="input !min-h-10" placeholder="2/3" />
                    </label>
                  )}
                  <label>
                    <span className="hint block">Marks</span>
                    <input type="number" min={1} max={20} value={part.marks} onChange={e => patch(i, { marks: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })} className="input !min-h-10 w-20 tnum" />
                  </label>
                </div>
                {part.answer_type === 'multiple_choice' && (
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Choices">
                    {(part.correct_answer_json.choices || []).map((c, ci) => (
                      <label key={ci} className="flex items-center gap-2">
                        <input type="radio" name={`part-${i}-correct`} checked={part.correct_answer_json.correct === ci} onChange={() => patch(i, { correct_answer_json: { ...part.correct_answer_json, correct: ci } })} className="h-4 w-4 accent-brand-600" aria-label={`Choice ${String.fromCharCode(65 + ci)} is correct`} />
                        <input value={typeof c === 'string' ? c : c.text} onChange={e => {
                          const choices = [...(part.correct_answer_json.choices || [])]
                          choices[ci] = e.target.value
                          patch(i, { correct_answer_json: { ...part.correct_answer_json, choices } })
                        }} className="input !min-h-10" placeholder={`Choice ${String.fromCharCode(65 + ci)}`} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => set(parts.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-gray-400 hover:bg-paper hover:text-ink" aria-label={`Remove part ${part.label}`}><X className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => set([...parts, blankPart(parts.length)])} className="btn btn-secondary btn-sm" disabled={parts.length >= 12}><Plus className="h-4 w-4" /> Add part</button>
        <button type="button" onClick={() => onChange(null)} className="btn btn-ghost btn-sm !text-[#9b2c2c]">Remove parts</button>
      </div>
    </div>
  )
}
