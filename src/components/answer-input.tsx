'use client'

import LatexRenderer from './latex-renderer'
import MathSymbolsPanel from './math-symbols-panel'

// Helper to normalize choices - handles both string arrays and object arrays
function normalizeChoice(choice: string | { text: string; latex?: string }): { text: string; latex?: string } {
  if (typeof choice === 'string') {
    return { text: choice }
  }
  return choice
}

interface AnswerInputProps {
  answerType: 'multiple_choice' | 'short_answer' | 'long_answer' | 'true_false' | 'fill_blank' | 'matching'
  correctAnswerJson: Record<string, unknown>
  value: string
  onChange: (value: string) => void
  selectedChoice: number | null
  onChoiceSelect: (index: number) => void
  disabled?: boolean
  showCorrect?: boolean
  userAnswer?: string
}

export function AnswerInput({
  answerType,
  correctAnswerJson,
  value,
  onChange,
  selectedChoice,
  onChoiceSelect,
  disabled = false,
  showCorrect = false,
  userAnswer,
}: AnswerInputProps) {
  
  const formatMathForDisplay = (text: string) => {
    if (!text) return text
    return text.replace(/\*/g, '×').replace(/\//g, '÷')
  }

  // Multiple Choice
  if (answerType === 'multiple_choice' && correctAnswerJson.choices) {
    const rawChoices = correctAnswerJson.choices as Array<string | { text: string; latex?: string }>
    const choices = rawChoices.map(normalizeChoice)
    return (
      <div className="space-y-3">
        {choices.map((choice, idx: number) => (
          <button
            key={idx}
            onClick={() => !disabled && onChoiceSelect(idx)}
            disabled={disabled}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedChoice === idx
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'} ${
              showCorrect && idx === correctAnswerJson.correct
                ? 'border-green-500 bg-green-50'
                : showCorrect && idx === parseInt(userAnswer || '-1') && idx !== correctAnswerJson.correct
                ? 'border-red-500 bg-red-50'
                : ''
            }`}
          >
            <span className="font-medium mr-3">{String.fromCharCode(65 + idx)}.</span>
            <LatexRenderer content={choice.latex || choice.text} />
          </button>
        ))}
      </div>
    )
  }

  // True/False
  if (answerType === 'true_false') {
    return (
      <div className="flex gap-4">
        {[{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }].map((option) => (
          <button
            key={option.value}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`flex-1 p-4 rounded-lg border-2 transition-all ${
              value === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'} ${
              showCorrect && String(correctAnswerJson.value) === option.value
                ? 'border-green-500 bg-green-50'
                : showCorrect && value === option.value && String(correctAnswerJson.value) !== option.value
                ? 'border-red-500 bg-red-50'
                : ''
            }`}
          >
            <span className="text-lg font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    )
  }

  // Long Answer (textarea)
  if (answerType === 'long_answer') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Answer
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          placeholder="Type your detailed answer here..."
        />
        {showCorrect && correctAnswerJson.value !== undefined && correctAnswerJson.value !== null && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm font-medium text-green-800">Model Answer:</p>
            <p className="text-sm text-green-700 mt-1">{String(correctAnswerJson.value)}</p>
          </div>
        )}
      </div>
    )
  }

  // Short Answer (default)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Your Answer
      </label>
      <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 px-4 py-3 text-lg bg-transparent focus:outline-none disabled:bg-gray-50 min-w-0"
          placeholder="Type your answer"
        />
        <MathSymbolsPanel
          onInsert={(symbol) => onChange(value + symbol)}
          disabled={disabled}
        />
      </div>
      {showCorrect && userAnswer && (
        <div className="mt-2 text-sm text-gray-600">
          Your answer: <span className="font-medium"><LatexRenderer content={formatMathForDisplay(userAnswer)} /></span>
          {correctAnswerJson.value !== undefined && correctAnswerJson.value !== null && (
            <span className="ml-2">
              | Correct: <span className="font-medium text-green-600">
                <LatexRenderer content={formatMathForDisplay(String(correctAnswerJson.value))} />
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function getAnswerTypeLabel(answerType: string): string {
  const labels: Record<string, string> = {
    'multiple_choice': 'Multiple Choice',
    'short_answer': 'Short Answer',
    'long_answer': 'Long Answer',
    'true_false': 'True/False',
    'fill_blank': 'Fill in the Blank',
    'matching': 'Matching',
  }
  return labels[answerType] || answerType
}
