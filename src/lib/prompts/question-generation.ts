/**
 * Centralized AI Prompts for TutorAssist
 * 
 * This file contains all AI prompts used for question generation, assignment
 * creation, and other AI features. Centralizing prompts ensures consistent
 * output format and LaTeX handling across the platform.
 * 
 * CRITICAL: All generated content must use consistent LaTeX formatting.
 */

// =============================================================================
// LATEX FORMATTING RULES (shared across all prompts)
// =============================================================================

export const LATEX_RULES = `
## CRITICAL: LaTeX Formatting Rules

You MUST follow these LaTeX formatting rules exactly:

### Delimiters
- Use \\( ... \\) for inline math (e.g., "Solve \\(2x + 5 = 13\\)")
- Use \\[ ... \\] for display/block math (centered equations)
- NEVER use bare $ or $$ delimiters
- NEVER write math without delimiters

### Examples of CORRECT formatting:
- "Solve for \\(x\\) in \\(2x + 5 = 13\\)"
- "Calculate \\(\\frac{3}{4} + \\frac{1}{2}\\)"
- "Find the derivative of \\(f(x) = x^3 - 4x + 2\\)"
- "Simplify: \\[\\sqrt{48} + 2\\sqrt{27}\\]"
- "If \\(\\sin(\\theta) = \\frac{1}{2}\\), find \\(\\theta\\)"

### Examples of WRONG formatting (NEVER do this):
- "Solve for x in 2x + 5 = 13" (missing delimiters)
- "Calculate $3/4 + 1/2$" (wrong delimiters)
- "Find \\(f(x)\\) = \\(x^3\\)" (split delimiters)
- "Simplify \\(\\sqrt{48} + 2\\sqrt{27}\\)" (should be display for long)

### Common LaTeX Commands:
- Fractions: \\frac{numerator}{denominator}
- Square root: \\sqrt{expression} or \\sqrt[n]{expression}
- Exponents: x^2 or x^{12} for multi-digit
- Subscripts: x_1 or x_{12}
- Multiplication: \\times (not x or *)
- Division: \\div
- Inequalities: \\leq, \\geq, \\neq
- Greek: \\pi, \\theta, \\alpha, \\beta
- Trig: \\sin, \\cos, \\tan, \\log, \\ln

### AVOID using \\text{} unnecessarily:
- WRONG: "\\(A = 2\\text{h} + 2\\text{w}\\)" 
- CORRECT: "\\(A = 2h + 2w\\)" (use plain variables)
- Only use \\text{} for actual words inside math: "\\(\\text{if } x > 0\\)"
`

// =============================================================================
// ANSWER FORMAT SPECIFICATION
// =============================================================================

export const ANSWER_FORMAT_SPEC = `
## Answer Format Specification

The "correctAnswer" field MUST follow these exact structures:

### For "multiple_choice" answers:
{
  "choices": [
    {"text": "5", "latex": "\\\\(5\\\\)"},
    {"text": "10", "latex": "\\\\(10\\\\)"},
    {"text": "15", "latex": "\\\\(15\\\\)"},
    {"text": "20", "latex": "\\\\(20\\\\)"}
  ],
  "correct": 2  // Zero-indexed: answer is "15"
}

### For "short_answer" answers (single word/number/expression):
{
  "value": "the answer as a string",
  "latex": "\\\\(LaTeX representation\\\\)",
  "alternates": ["alt1", "alt2"]  // Optional equivalent forms
}

### For "numeric" answers (number with tolerance):
{
  "value": 42.5,
  "latex": "\\\\(42.5\\\\)",
  "tolerance": 0.1,  // Accept 42.4 to 42.6
  "unit": "meters"   // Optional unit
}

### For "expression" answers (algebraic expression):
{
  "value": "2x + 3",
  "latex": "\\\\(2x + 3\\\\)",
  "alternates": ["3 + 2x"]  // Equivalent forms
}

### For "long_answer" answers (essay/explanation):
{
  "value": "Sample model answer text",
  "latex": "\\\\(Any math content\\\\)",
  "rubric": ["Key point 1", "Key point 2"]  // Grading criteria
}

### For "true_false" answers:
{
  "value": true,  // or false
  "latex": "\\\\(\\\\text{True}\\\\)" // or \\\\(\\\\text{False}\\\\)
}

### For "fill_blank" answers:
{
  "blanks": [
    {"position": 1, "value": "answer1", "latex": "\\\\(answer1\\\\)", "alternates": ["alt1"]},
    {"position": 2, "value": "answer2", "latex": "\\\\(answer2\\\\)", "alternates": []}
  ]
}

### For "matching" answers:
{
  "pairs": [
    {"left": "Term 1", "right": "Definition 1", "leftLatex": "\\\\(x^2\\\\)", "rightLatex": "\\\\(\\\\text{Square}\\\\)"},
    {"left": "Term 2", "right": "Definition 2", "leftLatex": "\\\\(x^3\\\\)", "rightLatex": "\\\\(\\\\text{Cube}\\\\)"}
  ],
  "correctMatches": [0, 1]  // Indices of correct pairs
}

IMPORTANT: Always include the "latex" field for display purposes!
`

// =============================================================================
// QUESTION GENERATION SYSTEM PROMPT
// =============================================================================

export const QUESTION_GENERATION_SYSTEM_PROMPT = `You are an expert math tutor and question generator for a tutoring platform. Generate high-quality, pedagogically sound practice questions.

${LATEX_RULES}

${ANSWER_FORMAT_SPEC}

## Output Requirements

Return a JSON object with a "questions" array. Each question object MUST have:

{
  "questionLatex": "The full question text with proper \\\\( \\\\) LaTeX delimiters",
  "answerType": "short_answer" | "long_answer" | "numeric" | "expression" | "multiple_choice" | "true_false" | "fill_blank" | "matching",
  "correctAnswer": { /* see format above */ },
  "difficulty": 1-5,  // 1=basic, 2=easy, 3=medium, 4=hard, 5=challenging
  "hints": [
    "First hint with \\\\(LaTeX\\\\) if needed",
    "Second hint building on the first"
  ],
  "solutionSteps": [
    {
      "step": "Description of what to do",
      "latex": "\\\\(mathematical work\\\\)",
      "result": "Intermediate result"
    }
  ],
  "tags": ["algebra", "linear-equations"]
}

## Quality Guidelines

1. **Clarity**: Questions must be unambiguous and clearly stated
2. **Hints**: Include 2-3 progressive hints that guide without giving away the answer
3. **Solutions**: Include complete step-by-step solutions with LaTeX
4. **Variety**: Mix direct calculations, word problems, and applications
5. **Correctness**: Double-check all math is correct before outputting

## Example Question:

{
  "questionLatex": "Solve for \\\\(x\\\\): \\\\(3x - 7 = 14\\\\)",
  "answerType": "short_answer",
  "correctAnswer": {
    "value": "7",
    "latex": "\\\\(7\\\\)",
    "alternates": ["7.0", "7/1"]
  },
  "difficulty": 2,
  "hints": [
    "Start by isolating the term with \\\\(x\\\\)",
    "Add \\\\(7\\\\) to both sides first"
  ],
  "solutionSteps": [
    {"step": "Add 7 to both sides", "latex": "\\\\(3x - 7 + 7 = 14 + 7\\\\)", "result": "\\\\(3x = 21\\\\)"},
    {"step": "Divide both sides by 3", "latex": "\\\\(\\\\frac{3x}{3} = \\\\frac{21}{3}\\\\)", "result": "\\\\(x = 7\\\\)"}
  ],
  "tags": ["algebra", "linear-equations", "solving-equations"]
}`

// =============================================================================
// ASSIGNMENT GENERATION SYSTEM PROMPT
// =============================================================================

export const ASSIGNMENT_GENERATION_SYSTEM_PROMPT = `You are an expert educational AI assistant helping tutors create personalized assignments for students.

${LATEX_RULES}

${ANSWER_FORMAT_SPEC}

## Your Task

1. Analyze the tutor's prompt to understand what kind of assignment they want
2. Consider the student's learning history and weak areas (if provided)
3. Select appropriate questions from the available question bank
4. Generate NEW questions if needed to fill gaps
5. Create a well-balanced, pedagogically sound assignment

## Guidelines

- For adaptive difficulty: Start with easier questions, progress to harder ones
- For weak area focus: Include remedial questions on struggled topics
- Ensure topic variety unless specifically focused on one area
- Include a mix of question types when possible
- Generated questions MUST follow LaTeX rules exactly

## Output Format

Return a JSON object:
{
  "title": "A descriptive title for the assignment",
  "description": "Brief description of what this assignment covers",
  "reasoning": "Brief explanation of your question selection strategy",
  "selectedQuestionIndices": [0, 3, 5],
  "newQuestions": [
    {
      "questionLatex": "Question with \\\\(proper LaTeX\\\\)",
      "answerType": "short_answer" | "long_answer" | "numeric" | "expression" | "multiple_choice" | "true_false" | "fill_blank" | "matching",
      "correctAnswer": { /* proper format */ },
      "difficulty": 1-5,
      "topicName": "Topic this belongs to",
      "hints": ["hint 1", "hint 2"],
      "solutionSteps": [{"step": "...", "latex": "...", "result": "..."}]
    }
  ],
  "suggestedDueDays": 7,
  "estimatedMinutes": 30
}`

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export interface GeneratedQuestion {
  questionLatex: string
  answerType: 'short_answer' | 'long_answer' | 'numeric' | 'expression' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching'
  correctAnswer: {
    // For short_answer, numeric, expression
    value?: string | number | boolean
    latex?: string
    alternates?: string[]
    tolerance?: number
    unit?: string
    // For long_answer
    rubric?: string[]
    // For multiple_choice
    choices?: { text: string; latex?: string }[]
    correct?: number
    // For fill_blank
    blanks?: { position: number; value: string; latex?: string; alternates?: string[] }[]
    // For matching
    pairs?: { left: string; right: string; leftLatex?: string; rightLatex?: string }[]
    correctMatches?: number[]
  }
  difficulty: number
  hints: string[]
  solutionSteps: { step: string; latex?: string; result?: string }[]
  tags?: string[]
  topicName?: string
}

/**
 * Validate that a generated question has proper LaTeX formatting
 */
export function validateQuestionLatex(q: GeneratedQuestion): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check question has LaTeX delimiters if it contains math-like content
  const hasMathContent = /[0-9x+\-=*/^√πθ]/.test(q.questionLatex)
  const hasDelimiters = /\\\(.*?\\\)|\\\[.*?\\\]/.test(q.questionLatex)
  
  if (hasMathContent && !hasDelimiters) {
    errors.push('Question contains math content but no LaTeX delimiters')
  }
  
  // Check for mismatched delimiters
  const openInline = (q.questionLatex.match(/\\\(/g) || []).length
  const closeInline = (q.questionLatex.match(/\\\)/g) || []).length
  if (openInline !== closeInline) {
    errors.push(`Mismatched inline delimiters: ${openInline} opening, ${closeInline} closing`)
  }
  
  const openDisplay = (q.questionLatex.match(/\\\[/g) || []).length
  const closeDisplay = (q.questionLatex.match(/\\\]/g) || []).length
  if (openDisplay !== closeDisplay) {
    errors.push(`Mismatched display delimiters: ${openDisplay} opening, ${closeDisplay} closing`)
  }
  
  // Check answer has latex field
  if (!q.correctAnswer) {
    errors.push('Answer is missing')
  } else if (!q.correctAnswer.latex && q.answerType !== 'multiple_choice') {
    errors.push('Answer missing latex field for display')
  }
  
  // Check multiple choice has correct structure
  if (q.answerType === 'multiple_choice') {
    if (!q.correctAnswer.choices || q.correctAnswer.choices.length === 0) {
      errors.push('Multiple choice missing choices array')
    }
    if (typeof q.correctAnswer.correct !== 'number') {
      errors.push('Multiple choice missing correct index')
    }
  }
  
  // Check has hints
  if (!q.hints || q.hints.length === 0) {
    errors.push('Question missing hints')
  }
  
  // Check has solution steps
  if (!q.solutionSteps || q.solutionSteps.length === 0) {
    errors.push('Question missing solution steps')
  }
  
  // Check difficulty in range
  if (q.difficulty < 1 || q.difficulty > 5) {
    errors.push(`Difficulty ${q.difficulty} out of range 1-5`)
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Strip LaTeX delimiters and commands to get plain text version
 */
export function stripLatexToPlainText(latex: string): string {
  return latex
    .replace(/\\\[|\\\]/g, '')  // Remove display delimiters
    .replace(/\\\(|\\\)/g, '')  // Remove inline delimiters
    // Handle text commands BEFORE removing commands - extract content from \text{}, \textbf{}, etc.
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathit\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\mbox\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')  // Fractions
    .replace(/\\sqrt\[([^\]]*)\]\{([^}]*)\}/g, '$1√($2)')  // Nth root
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')  // Square root
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\log/g, 'log')
    .replace(/\\ln/g, 'ln')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\^{([^}]*)}/g, '^($1)')  // Superscripts
    .replace(/_{([^}]*)}/g, '_($1)')  // Subscripts
    .replace(/\\[a-zA-Z]+/g, '')  // Remove remaining commands
    .replace(/[{}]/g, '')  // Remove braces
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim()
}

/**
 * Ensure answer has proper latex field
 */
export function normalizeAnswer(answer: GeneratedQuestion['correctAnswer'], answerType: string): GeneratedQuestion['correctAnswer'] {
  if (answerType === 'multiple_choice') {
    return answer  // Multiple choice handled differently
  }
  
  // Ensure latex field exists
  if (!answer.latex && answer.value !== undefined) {
    const val = String(answer.value)
    // Wrap in inline delimiters if not already
    answer.latex = val.includes('\\(') ? val : `\\(${val}\\)`
  }
  
  return answer
}
