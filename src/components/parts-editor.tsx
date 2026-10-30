'use client'

import type { QuestionPart, PartAnswerType } from '@/lib/parts'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { COMMAND_TERMS, commandTerm, detectCommandTerm } from '@/lib/command-terms'

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
                <textarea value={part.prompt} onChange={e => {
                  const prompt = e.target.value
                  // Pick up the command term from the first word unless the author chose one
                  const detected = detectCommandTerm(prompt)
                  const auto = !part.command_term || part.command_term === detectCommandTerm(part.prompt)
                  const next: Partial<QuestionPart> = { prompt }
                  if (auto) {
                    next.command_term = detected
                    const form = commandTerm(detected)?.form
                    if (part.answer_type === 'expression') next.correct_answer_json = { ...part.correct_answer_json, form: form ?? undefined }
                  }
                  patch(i, next)
                }} rows={2} className="input resize-y" placeholder="What this part asks, e.g. Find \(f'(x)\)…" aria-label={`Part ${part.label} prompt`} />
                <div className="grid grid-cols-[1fr_1fr_5rem] gap-2">
                  <label>
                    <span className="hint block">Answer type</span>
                    <select value={part.answer_type} onChange={e => {
                      const t = e.target.value as PartAnswerType
                      patch(i, { answer_type: t, correct_answer_json: t === 'multiple_choice' ? { choices: ['', '', '', ''], correct: 0 } : { value: '' } })
                    }} className="input !min-h-10 w-full">
                      {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="hint block">Command term</span>
                    <select value={part.command_term || ''} onChange={e => {
                      const term = e.target.value || undefined
                      const form = commandTerm(term)?.form
                      patch(i, { command_term: term, ...(part.answer_type === 'expression' ? { correct_answer_json: { ...part.correct_answer_json, form: form ?? undefined } } : {}) })
                    }} className="input !min-h-10 w-full" title={commandTerm(part.command_term)?.meaning}>
                      <option value="">None</option>
                      {COMMAND_TERMS.map(c => <option key={c.term} value={c.term}>{c.term}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="hint block">Marks</span>
                    <input type="number" min={1} max={20} value={part.marks} onChange={e => patch(i, { marks: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })} className="input !min-h-10 w-full tnum" />
                  </label>
                </div>
                {part.answer_type !== 'multiple_choice' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="min-w-0 flex-1">
                      <span className="hint block">Correct answer</span>
                      <input value={String(part.correct_answer_json.value ?? '')} onChange={e => patch(i, { correct_answer_json: { ...part.correct_answer_json, value: e.target.value } })} className="input !min-h-10 w-full" placeholder={part.answer_type === 'numeric' ? '0.667' : '6x - 4'} />
                    </label>
                    <label className="min-w-0 flex-1">
                      <span className="hint block">Also accept <span className="text-gray-400">(comma separated)</span></span>
                      <input value={(part.correct_answer_json.alternates || []).join(', ')} onChange={e => patch(i, { correct_answer_json: { ...part.correct_answer_json, alternates: e.target.value.split(',').map(s => s.trimStart()) } })} className="input !min-h-10 w-full" placeholder="2/3" />
                    </label>
                  </div>
                )}
                {(part.answer_type === 'expression' || part.answer_type === 'numeric') && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    {part.answer_type === 'expression' && (
                      <label className="inline-flex items-center gap-2 text-gray-600">
                        Answer must be
                        <select value={part.correct_answer_json.form || 'any'} onChange={e => patch(i, { correct_answer_json: { ...part.correct_answer_json, form: e.target.value === 'any' ? undefined : e.target.value as 'factorised' | 'expanded' | 'exact' } })} className="input !min-h-9 !py-1 w-auto">
                          <option value="any">any equivalent form</option>
                          <option value="factorised">factorised</option>
                          <option value="expanded">expanded</option>
                          <option value="exact">exact (no decimals)</option>
                        </select>
                      </label>
                    )}
                    {part.answer_type === 'numeric' && (
                      <label className="inline-flex items-center gap-2 text-gray-600">
                        <input type="checkbox" checked={!!part.correct_answer_json.sigfigs} onChange={e => patch(i, { correct_answer_json: { ...part.correct_answer_json, sigfigs: e.target.checked ? 3 : undefined } })} className="h-4 w-4 accent-brand-600" />
                        Accept answers correct to 3 s.f.
                      </label>
                    )}
                    <InfoTip text="Equivalent answers are recognised automatically: 6x - 4 and -4 + 6x both count. Choose a form when the command asks for one, like Factorise or Expand." className="text-gray-500" />
                  </div>
                )}
                <details className="group" open={!!part.markscheme}>
                  <summary className="cursor-pointer select-none text-sm font-semibold text-gray-600 hover:text-ink">Markscheme <span className="font-normal text-gray-400">(shown to students after checking)</span></summary>
                  <textarea value={part.markscheme || ''} onChange={e => patch(i, { markscheme: e.target.value || undefined })} rows={3} className="input mt-2 resize-y font-mono text-sm" placeholder={'M1 sets f\'(x) = 0\nA1 x = 2/3'} aria-label={`Part ${part.label} markscheme`} />
                </details>
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
