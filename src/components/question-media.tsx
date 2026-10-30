'use client'

import { Figure } from '@/components/figure'
import { parseFigure } from '@/lib/figures'

/** Image and/or figure that belongs to a question, shown under the prompt. */
export function QuestionMedia({ imageKey, figure, className = '' }: { imageKey?: string | null; figure?: unknown; className?: string }) {
  const spec = parseFigure(figure)
  if (!imageKey && !spec) return null
  return (
    <div className={`space-y-4 ${className}`}>
      {imageKey && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/${imageKey}`} alt="Question illustration" className="max-h-80 w-auto max-w-full rounded-2xl border border-line bg-white" loading="lazy" />
      )}
      {spec && <Figure spec={spec} />}
    </div>
  )
}
