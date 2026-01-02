import { LatexRenderer } from './latex-renderer'

// Helper to normalize choices - handles both string arrays and object arrays
function normalizeChoice(choice: string | { text: string; latex?: string }): { text: string; latex?: string } {
  if (typeof choice === 'string') {
    return { text: choice }
  }
  return choice
}

interface CorrectAnswer {
  value?: string | number | boolean
  latex?: string
  alternates?: string[]
  tolerance?: number
  unit?: string
  rubric?: string[]
  choices?: Array<string | { text: string; latex?: string }>
  correct?: number
  blanks?: Array<{ position?: number; value: string; latex?: string; alternates?: string[] }>
  pairs?: Array<{ left: string; right: string; leftLatex?: string; rightLatex?: string }>
  correctMatches?: number[]
}

interface AnswerDisplayProps {
  answerType: string
  correctAnswer: CorrectAnswer
  className?: string
}

/**
 * Displays the correct answer for different question types
 */
export function AnswerDisplay({ answerType, correctAnswer, className = '' }: AnswerDisplayProps) {
  if (!correctAnswer) return null

  switch (answerType) {
    case 'multiple_choice':
      if (correctAnswer.choices && typeof correctAnswer.correct === 'number') {
        const rawChoice = correctAnswer.choices[correctAnswer.correct]
        const correctChoice = normalizeChoice(rawChoice)
        return (
          <div className={className}>
            <LatexRenderer content={correctChoice?.latex || correctChoice?.text || ''} />
          </div>
        )
      }
      return null

    case 'short_answer':
    case 'numeric':
    case 'expression':
      return (
        <div className={className}>
          <LatexRenderer content={correctAnswer.latex || `\\(${correctAnswer.value}\\)`} />
          {correctAnswer.unit && <span className="ml-1 text-gray-600">{correctAnswer.unit}</span>}
          {correctAnswer.alternates && correctAnswer.alternates.length > 0 && (
            <div className="text-sm text-gray-500 mt-1">
              Also accept: {correctAnswer.alternates.join(', ')}
            </div>
          )}
        </div>
      )

    case 'true_false':
      return (
        <div className={className}>
          <span className="font-semibold">{correctAnswer.value ? 'True' : 'False'}</span>
        </div>
      )

    case 'long_answer':
      return (
        <div className={className}>
          {correctAnswer.latex && <LatexRenderer content={correctAnswer.latex} />}
          {correctAnswer.value && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{String(correctAnswer.value)}</p>
          )}
          {correctAnswer.rubric && correctAnswer.rubric.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium">Key points:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {correctAnswer.rubric.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )

    case 'fill_blank':
      if (correctAnswer.blanks && Array.isArray(correctAnswer.blanks)) {
        return (
          <div className={className}>
            {correctAnswer.blanks.map((blank, i) => (
              <div key={i} className="inline-block mr-2">
                <span className="font-medium">#{blank.position || i + 1}:</span>{' '}
                <LatexRenderer content={blank.latex || `\\(${blank.value}\\)`} />
              </div>
            ))}
          </div>
        )
      }
      return null

    case 'matching':
      if (correctAnswer.pairs && Array.isArray(correctAnswer.pairs)) {
        return (
          <div className={className}>
            {correctAnswer.pairs.map((pair, i) => (
              <div key={i} className="inline-block mr-3 text-sm">
                <LatexRenderer content={pair.leftLatex || pair.left} /> → <LatexRenderer content={pair.rightLatex || pair.right} />
              </div>
            ))}
          </div>
        )
      }
      return null

    default:
      // Fallback for unknown types
      if (correctAnswer.latex) {
        return (
          <div className={className}>
            <LatexRenderer content={correctAnswer.latex} />
          </div>
        )
      }
      if (correctAnswer.value) {
        return <div className={className}>{String(correctAnswer.value)}</div>
      }
      return null
  }
}

/**
 * Displays answer type badge
 */
export function AnswerTypeBadge({ answerType }: { answerType: string }) {
  const typeLabels: Record<string, string> = {
    multiple_choice: 'Multiple Choice',
    short_answer: 'Short Answer',
    long_answer: 'Long Answer',
    numeric: 'Numeric',
    expression: 'Expression',
    true_false: 'True/False',
    fill_blank: 'Fill in Blank',
    matching: 'Matching',
    exact: 'Short Answer', // Legacy
  }

  const typeColors: Record<string, string> = {
    multiple_choice: 'bg-blue-100 text-blue-800',
    short_answer: 'bg-green-100 text-green-800',
    long_answer: 'bg-purple-100 text-purple-800',
    numeric: 'bg-orange-100 text-orange-800',
    expression: 'bg-pink-100 text-pink-800',
    true_false: 'bg-yellow-100 text-yellow-800',
    fill_blank: 'bg-indigo-100 text-indigo-800',
    matching: 'bg-teal-100 text-teal-800',
    exact: 'bg-green-100 text-green-800', // Legacy
  }

  const label = typeLabels[answerType] || answerType
  const colorClass = typeColors[answerType] || 'bg-gray-100 text-gray-800'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  )
}
