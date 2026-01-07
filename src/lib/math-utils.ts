/**
 * Math answer normalization and comparison utilities
 * 
 * DESIGN PHILOSOPHY (Simplified January 2026):
 * - Use STRICT matching: exact equality after normalization
 * - Prioritize avoiding FALSE POSITIVES over false negatives
 * - Students can use "I was right" feature to flag false negatives
 * - Keep LaTeX/Unicode normalization for math symbol support
 * - Simple fraction-to-decimal conversion only
 * 
 * WHAT THIS DOES:
 * 1. Normalizes LaTeX and Unicode math symbols to plain text
 * 2. Compares normalized strings for exact equality
 * 3. Converts simple fractions to decimals for comparison
 * 
 * WHAT THIS DOES NOT DO (intentionally):
 * - Tolerance-based numeric matching
 * - Symbolic algebra equivalence (2x+1 ≠ 1+2x anymore)
 * - Expression evaluation (sqrt(4) ≠ 2)
 * - Scientific notation parsing
 * - Percentage conversion
 * - Mixed number parsing
 * - Multi-point expression evaluation
 * 
 * FUTURE EXPANSION:
 * To add more sophisticated matching for specific question types,
 * consider adding an optional `matchingMode` parameter to validation
 * functions with options like:
 * - 'strict' (default): exact match after normalization
 * - 'numeric_tolerance': allow small numeric differences
 * - 'algebraic': use symbolic algebra for equivalence
 * - 'expression': evaluate expressions before comparing
 * 
 * This would allow tutors to opt-in to looser matching per-question
 * rather than having it be the default behavior.
 */

/**
 * Normalize a mathematical expression to a canonical form for comparison.
 * Handles Unicode symbols, LaTeX commands, and various input formats.
 * 
 * Supports all symbols from the math-symbols-panel:
 * - Basic: + − × ÷ ± = ≠ < > ≤ ≥ ≈
 * - Fractions: ½ ⅓ ¼ ⅔ ¾ ⅕ ⅛
 * - Powers: ² ³ √ ∛
 * - Greek: π θ α β γ δ λ σ ω φ μ Δ
 * - Trig: sin cos tan sec csc cot log ln
 * - Calculus: ∫ ∬ ∑ ∏ lim ∞ ∂ ∇ → °
 * - Sets: ∈ ∉ ⊂ ⊃ ⊆ ∪ ∩ ∅ ℝ ℤ ℕ ℂ
 * - And corresponding LaTeX commands
 */
export function normalizeMathAnswer(answer: string): string {
  if (!answer || typeof answer !== 'string') return ''
  
  let normalized = answer.trim()
  
  // Step 1: Remove all whitespace
  normalized = normalized.replace(/\s+/g, '')
  
  // Step 2: Convert to lowercase for consistent comparison
  normalized = normalized.toLowerCase()
  
  // Step 3: Normalize Unicode math symbols to ASCII equivalents
  // (All symbols from math-symbols-panel plus common variants)
  const unicodeReplacements: [RegExp, string][] = [
    // Basic operators
    [/×/g, '*'],
    [/·/g, '*'],  // middle dot (from matrices panel)
    [/÷/g, '/'],
    [/−/g, '-'],  // Unicode minus
    [/–/g, '-'],  // En dash
    [/—/g, '-'],  // Em dash
    [/±/g, '+-'],
    
    // Comparison operators
    [/≤/g, '<='],
    [/≥/g, '>='],
    [/≠/g, '!='],
    [/≈/g, '~='],
    
    // Roots and powers
    [/√/g, 'sqrt'],
    [/∛/g, 'cbrt'],
    // Unicode superscripts (common from MathLive and other math input)
    [/¹/g, '^1'],
    [/²/g, '^2'],
    [/³/g, '^3'],
    [/⁴/g, '^4'],
    [/⁵/g, '^5'],
    [/⁶/g, '^6'],
    [/⁷/g, '^7'],
    [/⁸/g, '^8'],
    [/⁹/g, '^9'],
    [/⁰/g, '^0'],
    // Unicode subscripts
    [/₀/g, '_0'],
    [/₁/g, '_1'],
    [/₂/g, '_2'],
    [/₃/g, '_3'],
    [/₄/g, '_4'],
    [/₅/g, '_5'],
    [/₆/g, '_6'],
    [/₇/g, '_7'],
    [/₈/g, '_8'],
    [/₉/g, '_9'],
    
    // Fractions (convert to decimal for comparison)
    [/½/g, '0.5'],
    [/¼/g, '0.25'],
    [/¾/g, '0.75'],
    [/⅓/g, '0.333'],
    [/⅔/g, '0.667'],
    [/⅕/g, '0.2'],
    [/⅖/g, '0.4'],
    [/⅗/g, '0.6'],
    [/⅘/g, '0.8'],
    [/⅙/g, '0.167'],
    [/⅚/g, '0.833'],
    [/⅛/g, '0.125'],
    [/⅜/g, '0.375'],
    [/⅝/g, '0.625'],
    [/⅞/g, '0.875'],
    
    // Greek letters (from math-symbols-panel)
    [/π/g, 'pi'],
    [/θ/g, 'theta'],
    [/α/g, 'alpha'],
    [/β/g, 'beta'],
    [/γ/g, 'gamma'],
    [/δ/g, 'delta'],
    [/Δ/g, 'delta'],
    [/λ/g, 'lambda'],
    [/σ/g, 'sigma'],
    [/ω/g, 'omega'],
    [/φ/g, 'phi'],
    [/μ/g, 'mu'],
    
    // Calculus symbols
    [/∫/g, 'int'],
    [/∬/g, 'iint'],
    [/∑/g, 'sum'],
    [/∏/g, 'prod'],
    [/∞/g, 'infinity'],
    [/∂/g, 'partial'],
    [/∇/g, 'nabla'],
    [/→/g, '->'],
    [/°/g, 'deg'],
    
    // Set theory symbols
    [/∈/g, 'in'],
    [/∉/g, 'notin'],
    [/⊂/g, 'subset'],
    [/⊃/g, 'supset'],
    [/⊆/g, 'subseteq'],
    [/∪/g, 'union'],
    [/∩/g, 'intersect'],
    [/∅/g, 'emptyset'],
    [/ℝ/g, 'R'],
    [/ℤ/g, 'Z'],
    [/ℕ/g, 'N'],
    [/ℂ/g, 'C'],
    
    // Matrix/vector symbols
    [/⊗/g, 'otimes'],
    [/⟨/g, '<'],
    [/⟩/g, '>'],
  ]
  
  for (const [pattern, replacement] of unicodeReplacements) {
    normalized = normalized.replace(pattern, replacement)
  }
  
  // Step 4: Normalize LaTeX commands to plain forms
  const latexReplacements: [RegExp, string][] = [
    // Basic operators
    [/\\times/g, '*'],
    [/\\cdot/g, '*'],
    [/\\div/g, '/'],
    [/\\pm/g, '+-'],
    [/\\mp/g, '-+'],
    
    // Fractions - convert to division notation
    [/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    [/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    [/\\tfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    [/\\cfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    
    // Roots
    [/\\sqrt\[(\d+)\]\{([^}]*)\}/g, 'root($2,$1)'],
    [/\\sqrt\{([^}]*)\}/g, 'sqrt($1)'],
    [/\\sqrt/g, 'sqrt'],
    
    // Greek letters
    [/\\pi/g, 'pi'],
    [/\\theta/g, 'theta'],
    [/\\alpha/g, 'alpha'],
    [/\\beta/g, 'beta'],
    [/\\gamma/g, 'gamma'],
    [/\\delta/g, 'delta'],
    [/\\Delta/g, 'delta'],
    [/\\lambda/g, 'lambda'],
    [/\\sigma/g, 'sigma'],
    [/\\omega/g, 'omega'],
    [/\\phi/g, 'phi'],
    [/\\mu/g, 'mu'],
    
    // Trig and log functions
    [/\\sin/g, 'sin'],
    [/\\cos/g, 'cos'],
    [/\\tan/g, 'tan'],
    [/\\sec/g, 'sec'],
    [/\\csc/g, 'csc'],
    [/\\cot/g, 'cot'],
    [/\\arcsin/g, 'arcsin'],
    [/\\arccos/g, 'arccos'],
    [/\\arctan/g, 'arctan'],
    [/\\log/g, 'log'],
    [/\\ln/g, 'ln'],
    [/\\exp/g, 'exp'],
    
    // Calculus
    [/\\int/g, 'int'],
    [/\\iint/g, 'iint'],
    [/\\sum/g, 'sum'],
    [/\\prod/g, 'prod'],
    [/\\lim/g, 'lim'],
    [/\\infty/g, 'infinity'],
    [/\\partial/g, 'partial'],
    [/\\nabla/g, 'nabla'],
    [/\\to/g, '->'],
    [/\\circ/g, 'deg'],
    
    // Comparison operators (handle \left and \right before \le and \ge)
    // Order matters: longer patterns first (\leq before \le, etc.)
    [/\\left/g, ''],
    [/\\right/g, ''],
    [/\\leq/g, '<='],
    [/\\le(?!ft|q)/g, '<='],
    [/\\geq/g, '>='],
    [/\\ge(?!t|q)/g, '>='],
    [/\\neq/g, '!='],
    [/\\ne(?!q)/g, '!='],
    [/\\approx/g, '~='],
    
    // Set theory
    [/\\in/g, 'in'],
    [/\\notin/g, 'notin'],
    [/\\subset/g, 'subset'],
    [/\\supset/g, 'supset'],
    [/\\subseteq/g, 'subseteq'],
    [/\\cup/g, 'union'],
    [/\\cap/g, 'intersect'],
    [/\\emptyset/g, 'emptyset'],
    [/\\mathbb\{R\}/g, 'R'],
    [/\\mathbb\{Z\}/g, 'Z'],
    [/\\mathbb\{N\}/g, 'N'],
    [/\\mathbb\{C\}/g, 'C'],
    
    // Matrix/vector
    [/\\det/g, 'det'],
    [/\\vec\{([^}]*)\}/g, 'vec($1)'],
    [/\\otimes/g, 'otimes'],
    [/\\langle/g, '<'],
    [/\\rangle/g, '>'],
    
    // Text commands (strip formatting)
    [/\\text\{([^}]*)\}/g, '$1'],
    [/\\mathrm\{([^}]*)\}/g, '$1'],
    [/\\mathit\{([^}]*)\}/g, '$1'],
    [/\\mathbf\{([^}]*)\}/g, '$1'],
    
    // Spacing (remove)
    [/\\,/g, ''],
    [/\\:/g, ''],
    [/\\;/g, ''],
    [/\\!/g, ''],
    [/\\ /g, ''],
    
    // Superscripts and subscripts (with braces)
    [/\^\{([^}]*)\}/g, '^($1)'],
    [/_\{([^}]*)\}/g, '_($1)'],
  ]
  
  for (const [pattern, replacement] of latexReplacements) {
    normalized = normalized.replace(pattern, replacement)
  }
  
  // Step 5: Remove LaTeX delimiters
  normalized = normalized.replace(/\\\[|\\\]/g, '')
  normalized = normalized.replace(/\\\(|\\\)/g, '')
  normalized = normalized.replace(/\$\$/g, '')
  normalized = normalized.replace(/\$/g, '')
  
  // Step 6: Remove remaining backslashes and braces
  normalized = normalized.replace(/\\/g, '')
  normalized = normalized.replace(/[{}]/g, '')
  
  // Step 7: Clean up unnecessary parentheses around single numbers/terms
  normalized = normalized.replace(/\((\d+)\)/g, '$1')
  // Also clean up ^(n) to ^n for single digits
  normalized = normalized.replace(/\^\((\d)\)/g, '^$1')
  
  // Step 8: Normalize decimal representation
  normalized = normalized.replace(/\.0+$/g, '') // Remove trailing zeros after decimal
  
  return normalized
}

/**
 * Parse a simple fraction string (a/b) into its decimal value.
 * Only handles explicit fractions, not mixed numbers or complex expressions.
 */
function parseFraction(str: string): number | null {
  // Match simple fractions: "1/2", "3/4", "(1)/(2)"
  const slashMatch = str.match(/^\(?(-?\d+)\)?\s*\/\s*\(?(-?\d+)\)?$/)
  if (slashMatch) {
    const [, num, den] = slashMatch
    const denominator = parseFloat(den)
    if (denominator === 0) return null
    return parseFloat(num) / denominator
  }
  return null
}

/**
 * Compare two mathematical answers for equality.
 * Uses STRICT matching after normalization.
 * 
 * Only accepts:
 * 1. Exact match after normalization
 * 2. Fraction-to-decimal equivalence (1/2 = 0.5)
 * 3. Alternate answers if provided
 */
export function compareMathAnswers(
  userAnswer: string, 
  correctAnswer: string, 
  alternates?: string[]
): boolean {
  const normalizedUser = normalizeMathAnswer(userAnswer)
  const normalizedCorrect = normalizeMathAnswer(correctAnswer)
  
  // Empty check
  if (!normalizedUser || !normalizedCorrect) {
    return false
  }
  
  // 1. Direct exact match after normalization
  if (normalizedUser === normalizedCorrect) {
    return true
  }
  
  // 2. Try fraction-to-decimal comparison
  // Convert both to numbers if possible and compare
  const userFraction = parseFraction(normalizedUser)
  const correctFraction = parseFraction(normalizedCorrect)
  const userNum = parseFloat(normalizedUser)
  const correctNum = parseFloat(normalizedCorrect)
  
  // If user gave fraction and correct is decimal (or vice versa)
  if (userFraction !== null && !isNaN(correctNum)) {
    // Round to 3 decimal places for comparison
    if (Math.abs(userFraction - correctNum) < 0.001) {
      return true
    }
  }
  if (!isNaN(userNum) && correctFraction !== null) {
    if (Math.abs(userNum - correctFraction) < 0.001) {
      return true
    }
  }
  // Both are fractions
  if (userFraction !== null && correctFraction !== null) {
    if (Math.abs(userFraction - correctFraction) < 0.001) {
      return true
    }
  }
  
  // 3. Check alternate answers (also apply fraction comparison to alternates)
  if (alternates && Array.isArray(alternates)) {
    for (const alt of alternates) {
      const normalizedAlt = normalizeMathAnswer(String(alt))
      // Direct match
      if (normalizedAlt === normalizedUser) {
        return true
      }
      // Also try fraction comparison for alternates
      const altFraction = parseFraction(normalizedAlt)
      const altNum = parseFloat(normalizedAlt)
      if (userFraction !== null && !isNaN(altNum) && Math.abs(userFraction - altNum) < 0.001) {
        return true
      }
      if (!isNaN(userNum) && altFraction !== null && Math.abs(userNum - altFraction) < 0.001) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Compare a user's numeric answer against an expected number.
 * Simple exact comparison after normalization.
 */
export function compareNumericAnswers(
  userAnswer: string, 
  correctAnswer: number
): boolean {
  // Try fraction on ORIGINAL input first (before normalization)
  const originalFraction = parseFraction(userAnswer.trim())
  if (originalFraction !== null) {
    return Math.abs(originalFraction - correctAnswer) < 0.0001
  }
  
  const normalized = normalizeMathAnswer(userAnswer)
  
  // Try direct parse
  let userNum = parseFloat(normalized)
  
  // If direct parse fails, try fraction on normalized form
  if (isNaN(userNum)) {
    const fraction = parseFraction(normalized)
    if (fraction !== null) {
      userNum = fraction
    }
  }
  
  if (isNaN(userNum)) {
    return false
  }
  
  // Exact comparison (allow tiny floating point tolerance)
  return Math.abs(userNum - correctAnswer) < 0.0001
}

/**
 * Format a math expression for proper LaTeX display.
 * Converts Unicode symbols and plain text to LaTeX.
 */
export function formatMathForDisplay(answer: string): string {
  if (!answer || typeof answer !== 'string') return ''
  
  // If already has LaTeX delimiters, return as-is
  if (/\$|\\\(|\\\[/.test(answer)) {
    return answer
  }
  
  let latex = answer.trim()
  
  // Check if it has math content worth formatting
  if (!/[\d√×÷π∞±²³⁴αβγθΔ∑^_]/.test(latex) && !/[a-z]/i.test(latex)) {
    return latex
  }
  
  // Convert Unicode math symbols to LaTeX
  const conversions: [RegExp, string][] = [
    [/√(\d+)/g, '\\sqrt{$1}'],
    [/√\(([^)]+)\)/g, '\\sqrt{$1}'],
    [/√/g, '\\sqrt{'],
    [/×/g, '\\times '],
    [/÷/g, '\\div '],
    [/−/g, '-'],
    [/π/g, '\\pi '],
    [/∞/g, '\\infty '],
    [/≤/g, '\\leq '],
    [/≥/g, '\\geq '],
    [/≠/g, '\\neq '],
    [/±/g, '\\pm '],
    [/°/g, '^\\circ '],
    [/²/g, '^2'],
    [/³/g, '^3'],
    [/⁴/g, '^4'],
    [/α/g, '\\alpha '],
    [/β/g, '\\beta '],
    [/γ/g, '\\gamma '],
    [/θ/g, '\\theta '],
    [/Δ/g, '\\Delta '],
  ]
  
  for (const [pattern, replacement] of conversions) {
    latex = latex.replace(pattern, replacement)
  }
  
  // Close any unclosed braces
  const openBraces = (latex.match(/\{/g) || []).length
  const closeBraces = (latex.match(/\}/g) || []).length
  if (openBraces > closeBraces) {
    latex += '}'.repeat(openBraces - closeBraces)
  }
  
  // Wrap in LaTeX delimiters if it contains LaTeX commands or math content
  if (/\\[a-zA-Z]+/.test(latex) || /[_^]/.test(latex) || /\d/.test(latex)) {
    return `\\(${latex}\\)`
  }
  
  return answer
}

/**
 * Answer validation result for server-side validation
 */
export interface AnswerValidationResult {
  isCorrect: boolean
  normalizedUser: string
  normalizedCorrect: string
  matchType: 'exact' | 'fraction' | 'alternate' | 'none'
}

/**
 * Validate an answer and return detailed results.
 * Used for server-side validation in API routes.
 */
export function validateAnswer(
  userAnswer: string,
  correctAnswer: string,
  answerType: string,
  correctAnswerData?: {
    value?: string | number
    alternates?: string[]
    tolerance?: number  // Kept for API compatibility but ignored
    latex?: string
  }
): AnswerValidationResult {
  const normalizedUser = normalizeMathAnswer(userAnswer)
  const normalizedCorrect = normalizeMathAnswer(correctAnswer)
  
  const result: AnswerValidationResult = {
    isCorrect: false,
    normalizedUser,
    normalizedCorrect,
    matchType: 'none'
  }
  
  // Empty check
  if (!normalizedUser || !normalizedCorrect) {
    return result
  }
  
  // Exact match
  if (normalizedUser === normalizedCorrect) {
    result.isCorrect = true
    result.matchType = 'exact'
    return result
  }
  
  // For numeric types, try numeric comparison
  if (answerType === 'numeric') {
    const correctNum = typeof correctAnswerData?.value === 'number' 
      ? correctAnswerData.value 
      : parseFloat(normalizedCorrect)
    
    if (!isNaN(correctNum) && compareNumericAnswers(userAnswer, correctNum)) {
      result.isCorrect = true
      result.matchType = 'fraction'
      return result
    }
  }
  
  // Full comparison (includes fraction-to-decimal and alternates)
  const isMatch = compareMathAnswers(userAnswer, correctAnswer, correctAnswerData?.alternates)
  
  if (isMatch) {
    result.isCorrect = true
    
    // Determine match type
    if (correctAnswerData?.alternates?.some(alt => 
      normalizeMathAnswer(alt) === normalizedUser
    )) {
      result.matchType = 'alternate'
    } else if (parseFraction(normalizedUser) !== null || parseFraction(normalizedCorrect) !== null) {
      result.matchType = 'fraction'
    } else {
      result.matchType = 'exact'
    }
  }
  
  return result
}

/**
 * Get simple feedback about an answer
 */
export function getAnswerFeedback(
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean
): string {
  if (isCorrect) {
    return 'Correct!'
  }
  return 'Incorrect. Try again!'
}

// Export parseFraction for potential use elsewhere
export { parseFraction }

// =============================================================================
// FILL-IN-THE-BLANK AND MATCHING VALIDATION
// =============================================================================

export interface BlankAnswer {
  position?: number
  value: string
  latex?: string
  alternates?: string[]
}

export interface FillBlankValidationResult {
  isCorrect: boolean
  blanksCorrect: number
  blanksTotal: number
  details: { position: number; isCorrect: boolean; userAnswer: string; correctAnswer: string }[]
}

/**
 * Validate a fill-in-the-blank answer
 */
export function validateFillBlank(
  userAnswers: string | string[],
  correctBlanks: BlankAnswer[]
): FillBlankValidationResult {
  const userAnswerArray = Array.isArray(userAnswers) 
    ? userAnswers 
    : userAnswers.split(/[,;|]/).map(a => a.trim())
  
  const details: FillBlankValidationResult['details'] = []
  let blanksCorrect = 0
  
  for (let i = 0; i < correctBlanks.length; i++) {
    const blank = correctBlanks[i]
    const position = blank.position ?? i
    const userAnswer = userAnswerArray[i] || ''
    const correctValue = blank.value || blank.latex || ''
    
    const isMatch = compareMathAnswers(userAnswer, correctValue, blank.alternates)
    
    if (isMatch) {
      blanksCorrect++
    }
    
    details.push({
      position,
      isCorrect: isMatch,
      userAnswer,
      correctAnswer: correctValue
    })
  }
  
  return {
    isCorrect: blanksCorrect === correctBlanks.length,
    blanksCorrect,
    blanksTotal: correctBlanks.length,
    details
  }
}

export interface MatchingPair {
  left: string
  right: string
  leftLatex?: string
  rightLatex?: string
}

export interface MatchingValidationResult {
  isCorrect: boolean
  matchesCorrect: number
  matchesTotal: number
  details: { leftIndex: number; userRightIndex: number; correctRightIndex: number; isCorrect: boolean }[]
}

/**
 * Validate a matching answer
 */
export function validateMatching(
  userMatches: number[],
  correctMatches: number[],
  pairs?: MatchingPair[]
): MatchingValidationResult {
  const details: MatchingValidationResult['details'] = []
  let matchesCorrect = 0
  const matchesTotal = correctMatches.length
  
  for (let i = 0; i < correctMatches.length; i++) {
    const userRightIndex = userMatches[i] ?? -1
    const correctRightIndex = correctMatches[i]
    const isMatch = userRightIndex === correctRightIndex
    
    if (isMatch) {
      matchesCorrect++
    }
    
    details.push({
      leftIndex: i,
      userRightIndex,
      correctRightIndex,
      isCorrect: isMatch
    })
  }
  
  return {
    isCorrect: matchesCorrect === matchesTotal,
    matchesCorrect,
    matchesTotal,
    details
  }
}

/**
 * Sanitize user input
 */
export function sanitizeAnswerInput(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  const maxLength = 10000
  let sanitized = input.slice(0, maxLength)
  
  // Remove zero-width characters
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
  
  // Remove control characters (except normal whitespace)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  return sanitized
}
