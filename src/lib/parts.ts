import { compareMathAnswers, compareNumericAnswers } from '@/lib/math-utils'

/**
 * Multi-part questions. Each part is graded on its own and carries marks; the
 * question's score is the marks earned over the marks available. The same
 * grading code runs in the browser (instant feedback) and on the server (the
 * recorded result), so they cannot disagree.
 */

export type PartAnswerType = 'numeric' | 'expression' | 'short_answer' | 'multiple_choice'

export interface QuestionPart {
  label: string
  prompt: string
  answer_type: PartAnswerType
  correct_answer_json: { value?: string | number; alternates?: string[]; choices?: (string | { text: string; latex?: string })[]; correct?: number }
  marks: number
  hints?: string[]
}

export interface PartResult {
  label: string
  correct: boolean
  marks: number
  earned: number
}

const TYPES: PartAnswerType[] = ['numeric', 'expression', 'short_answer', 'multiple_choice']

/** Validate and normalise parts from the editor, the API or the AI generator. */
export function parseParts(input: unknown): QuestionPart[] | null {
  if (!Array.isArray(input)) return null
  const parts = input
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p, i): QuestionPart | null => {
      const prompt = typeof p.prompt === 'string' ? p.prompt.trim() : ''
      const type = TYPES.includes(p.answer_type as PartAnswerType) ? (p.answer_type as PartAnswerType) : 'short_answer'
      const answer = (p.correct_answer_json && typeof p.correct_answer_json === 'object' ? p.correct_answer_json : {}) as QuestionPart['correct_answer_json']
      const marks = Math.max(1, Math.min(20, Math.round(Number(p.marks) || 1)))
      if (!prompt) return null
      if (type === 'multiple_choice' ? !Array.isArray(answer.choices) || typeof answer.correct !== 'number' : answer.value === undefined || answer.value === '') return null
      return {
        label: typeof p.label === 'string' && p.label.trim() ? p.label.trim().slice(0, 6) : String.fromCharCode(97 + i),
        prompt,
        answer_type: type,
        correct_answer_json: answer,
        marks,
        hints: Array.isArray(p.hints) ? (p.hints as unknown[]).filter((h): h is string => typeof h === 'string' && !!h.trim()).slice(0, 5) : undefined,
      }
    })
    .filter((p): p is QuestionPart => p !== null)
    .slice(0, 12)
  return parts.length > 0 ? parts : null
}

export function gradePart(part: QuestionPart, answer: string | null | undefined): boolean {
  const a = (answer ?? '').toString()
  if (!a.trim()) return false
  const c = part.correct_answer_json
  switch (part.answer_type) {
    case 'multiple_choice':
      return parseInt(a, 10) === c.correct
    case 'numeric': {
      const v = typeof c.value === 'number' ? c.value : parseFloat(String(c.value))
      if (Number.isNaN(v)) return false
      if (compareNumericAnswers(a, v)) return true
      return (c.alternates || []).some(alt => compareMathAnswers(a, alt))
    }
    default:
      return compareMathAnswers(a, String(c.value ?? ''), c.alternates)
  }
}

export function gradeParts(parts: QuestionPart[], answers: (string | null | undefined)[]) {
  const results: PartResult[] = parts.map((p, i) => {
    const correct = gradePart(p, answers[i])
    return { label: p.label, correct, marks: p.marks, earned: correct ? p.marks : 0 }
  })
  const total = results.reduce((n, r) => n + r.marks, 0)
  const earned = results.reduce((n, r) => n + r.earned, 0)
  return { results, total, earned, allCorrect: results.every(r => r.correct), credit: total > 0 ? earned / total : 0 }
}

export function totalMarks(parts: QuestionPart[] | null | undefined) {
  return (parts || []).reduce((n, p) => n + p.marks, 0)
}

/** The schema fragment handed to the AI generator. Keep in sync with QuestionPart. */
export const PARTS_SCHEMA_FOR_PROMPT = `
### Optional "parts" (exam-style questions with (a), (b), (c)):
Use parts when the question naturally builds in steps. The main "questionLatex" is then the shared stem.
"parts": [
  {"label": "a", "prompt": "Find \\\\(f'(x)\\\\).", "answer_type": "expression", "correct_answer_json": {"value": "6x - 4", "alternates": ["-4 + 6x"]}, "marks": 2},
  {"label": "b", "prompt": "Hence find the x-coordinate of the turning point.", "answer_type": "numeric", "correct_answer_json": {"value": 0.667, "alternates": ["2/3"]}, "marks": 2}
]
answer_type is one of: numeric, expression, short_answer, multiple_choice (multiple_choice uses {"choices": [...], "correct": index}).
When parts are present, the question-level "correctAnswer" should repeat the final part's answer.`
