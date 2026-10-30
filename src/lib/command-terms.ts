import type { AnswerForm } from '@/lib/grading/cas'

/**
 * IB mathematics command terms (the verbs exam questions start with). The
 * list is a fact of the syllabus; the one-line meanings are our own wording.
 * `form` is the answer form a command implies for auto-grading.
 */
export interface CommandTerm {
  term: string
  meaning: string
  form?: AnswerForm
  /** Needs a written argument a tutor marks, not a single final answer */
  needsWorking?: boolean
}

export const COMMAND_TERMS: CommandTerm[] = [
  { term: 'Calculate', meaning: 'Work out a numerical answer, showing the working.' },
  { term: 'Comment', meaning: 'Give a judgement based on a result.', needsWorking: true },
  { term: 'Compare', meaning: 'Say how two or more things are alike.', needsWorking: true },
  { term: 'Construct', meaning: 'Display information in a diagram or logical form.', needsWorking: true },
  { term: 'Deduce', meaning: 'Reach a conclusion from the information given.' },
  { term: 'Describe', meaning: 'Give a detailed account.', needsWorking: true },
  { term: 'Determine', meaning: 'Obtain the only possible answer.' },
  { term: 'Differentiate', meaning: 'Find the derivative of a function.' },
  { term: 'Draw', meaning: 'Represent accurately with a labelled diagram or graph.', needsWorking: true },
  { term: 'Estimate', meaning: 'Find an approximate value.' },
  { term: 'Expand', meaning: 'Multiply out brackets.', form: 'expanded' },
  { term: 'Explain', meaning: 'Give reasons or causes.', needsWorking: true },
  { term: 'Factorise', meaning: 'Write as a product of factors.', form: 'factorised' },
  { term: 'Find', meaning: 'Obtain an answer, showing relevant stages in the working.' },
  { term: 'Hence', meaning: 'Use the previous part to get the answer.' },
  { term: 'Hence or otherwise', meaning: 'The previous part helps, but other methods are allowed.' },
  { term: 'Integrate', meaning: 'Find the integral of a function.' },
  { term: 'Interpret', meaning: 'Use knowledge to draw a conclusion from given information.', needsWorking: true },
  { term: 'Justify', meaning: 'Give valid reasons for an answer or conclusion.', needsWorking: true },
  { term: 'Label', meaning: 'Add labels to a diagram.', needsWorking: true },
  { term: 'Plot', meaning: 'Mark points on a graph.', needsWorking: true },
  { term: 'Predict', meaning: 'Give an expected result.' },
  { term: 'Prove', meaning: 'Use a sequence of logical steps to establish a result.', needsWorking: true },
  { term: 'Show that', meaning: 'Get to the given result; the answer is already known.', needsWorking: true },
  { term: 'Simplify', meaning: 'Write in the simplest equivalent form.' },
  { term: 'Sketch', meaning: 'Draw a graph showing its key features, not to scale.', needsWorking: true },
  { term: 'Solve', meaning: 'Find the values that satisfy an equation or inequality.' },
  { term: 'State', meaning: 'Give a specific answer without explanation.' },
  { term: 'Verify', meaning: 'Check that a result is correct.', needsWorking: true },
  { term: 'Write down', meaning: 'Little or no working needed; the answer is quick to see.' },
]

export function commandTerm(term: string | null | undefined): CommandTerm | undefined {
  if (!term) return undefined
  const t = term.trim().toLowerCase()
  return COMMAND_TERMS.find(c => c.term.toLowerCase() === t)
}

/** Detect the command term a prompt starts with ("Hence find…" -> "Hence"). */
export function detectCommandTerm(prompt: string): string | undefined {
  const text = prompt.replace(/\\\(|\\\)|\$/g, '').trim().toLowerCase()
  const sorted = [...COMMAND_TERMS].sort((a, b) => b.term.length - a.term.length)
  return sorted.find(c => text.startsWith(c.term.toLowerCase()))?.term
}
