'use client'

import { InfoTip } from '@/components/ui/info-tip'

export type AnswerFormChoice = 'any' | 'factorised' | 'expanded' | 'exact'

/**
 * How strictly an answer is checked: the required form for expressions, and
 * whether rounded numeric answers count. Shared by the new and edit pages.
 */
export function AnswerOptions({ answerType, form, onForm, acceptSf, onAcceptSf }: {
  answerType: string
  form: AnswerFormChoice
  onForm: (f: AnswerFormChoice) => void
  acceptSf: boolean
  onAcceptSf: (v: boolean) => void
}) {
  if (answerType === 'multiple_choice' || answerType === 'true_false' || answerType === 'long_answer') return null
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {answerType === 'numeric' ? (
        <label className="inline-flex items-center gap-2 text-gray-600">
          <input type="checkbox" checked={acceptSf} onChange={e => onAcceptSf(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Accept answers correct to 3 significant figures
        </label>
      ) : (
        <label className="inline-flex items-center gap-2 text-gray-600">
          Answer must be
          <select value={form} onChange={e => onForm(e.target.value as AnswerFormChoice)} className="input !min-h-9 !py-1 w-auto">
            <option value="any">any equivalent form</option>
            <option value="factorised">factorised</option>
            <option value="expanded">expanded</option>
            <option value="exact">exact (no decimals)</option>
          </select>
        </label>
      )}
      <InfoTip text="Equivalent answers are recognised automatically: 6x - 4 and -4 + 6x both count, as do 2√2 and √8. Choose a form when the question asks for one, like factorise or expand." className="text-gray-500" />
    </div>
  )
}
