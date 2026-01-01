/**
 * Math answer normalization and comparison utilities
 * Inspired by Khan Academy and Desmos approaches to answer validation
 * 
 * Key design principles:
 * 1. Be generous with student input - accept multiple equivalent forms
 * 2. Handle LaTeX, Unicode, and plain text uniformly
 * 3. Support fractions, expressions, and numeric answers
 */

/**
 * Normalize a mathematical expression to a canonical form for comparison.
 * Handles Unicode symbols, LaTeX commands, and various input formats.
 */
export function normalizeMathAnswer(answer: string): string {
  if (!answer || typeof answer !== 'string') return ''
  
  let normalized = answer.trim()
  
  // Step 1: Remove all whitespace
  normalized = normalized.replace(/\s+/g, '')
  
  // Step 2: Convert to lowercase for consistent comparison
  normalized = normalized.toLowerCase()
  
  // Step 3: Normalize Unicode math symbols to ASCII equivalents
  const unicodeReplacements: [RegExp, string][] = [
    [/×/g, '*'],
    [/·/g, '*'],  // middle dot
    [/÷/g, '/'],
    [/−/g, '-'],  // Unicode minus
    [/–/g, '-'],  // En dash
    [/—/g, '-'],  // Em dash
    [/√/g, 'sqrt'],
    [/∛/g, 'cbrt'],
    [/π/g, 'pi'],
    [/∞/g, 'infinity'],
    [/≤/g, '<='],
    [/≥/g, '>='],
    [/≠/g, '!='],
    [/≈/g, '~='],
    [/±/g, '+-'],
    [/°/g, 'deg'],
    [/²/g, '^2'],
    [/³/g, '^3'],
    [/⁴/g, '^4'],
    [/⁵/g, '^5'],
    [/⁶/g, '^6'],
    [/⁷/g, '^7'],
    [/⁸/g, '^8'],
    [/⁹/g, '^9'],
    [/⁰/g, '^0'],
    [/½/g, '(1/2)'],
    [/¼/g, '(1/4)'],
    [/¾/g, '(3/4)'],
    [/⅓/g, '(1/3)'],
    [/⅔/g, '(2/3)'],
    [/⅕/g, '(1/5)'],
    [/⅖/g, '(2/5)'],
    [/⅗/g, '(3/5)'],
    [/⅘/g, '(4/5)'],
    [/⅙/g, '(1/6)'],
    [/⅚/g, '(5/6)'],
    [/⅛/g, '(1/8)'],
    [/⅜/g, '(3/8)'],
    [/⅝/g, '(5/8)'],
    [/⅞/g, '(7/8)'],
    [/α/g, 'alpha'],
    [/β/g, 'beta'],
    [/γ/g, 'gamma'],
    [/θ/g, 'theta'],
    [/Δ/g, 'delta'],
    [/δ/g, 'delta'],
    [/σ/g, 'sigma'],
    [/Σ/g, 'sum'],
    [/∑/g, 'sum'],
    [/λ/g, 'lambda'],
    [/μ/g, 'mu'],
    [/ω/g, 'omega'],
  ]
  
  for (const [pattern, replacement] of unicodeReplacements) {
    normalized = normalized.replace(pattern, replacement)
  }
  
  // Step 4: Normalize LaTeX commands to plain forms
  const latexReplacements: [RegExp, string][] = [
    [/\\times/g, '*'],
    [/\\cdot/g, '*'],
    [/\\div/g, '/'],
    [/\\pm/g, '+-'],
    [/\\mp/g, '-+'],
    [/\\sqrt\[(\d+)\]\{([^}]*)\}/g, 'root($1,$2)'], // nth root
    [/\\sqrt\{([^}]*)\}/g, 'sqrt($1)'],
    [/\\sqrt/g, 'sqrt'],
    [/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    [/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    [/\\tfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    [/\\cfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
    [/\\pi/g, 'pi'],
    [/\\infty/g, 'infinity'],
    [/\\alpha/g, 'alpha'],
    [/\\beta/g, 'beta'],
    [/\\gamma/g, 'gamma'],
    [/\\theta/g, 'theta'],
    [/\\delta/g, 'delta'],
    [/\\sigma/g, 'sigma'],
    [/\\lambda/g, 'lambda'],
    [/\\mu/g, 'mu'],
    [/\\omega/g, 'omega'],
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
    [/\\le/g, '<='],
    [/\\leq/g, '<='],
    [/\\ge/g, '>='],
    [/\\geq/g, '>='],
    [/\\ne/g, '!='],
    [/\\neq/g, '!='],
    [/\\approx/g, '~='],
    [/\\left/g, ''],
    [/\\right/g, ''],
    [/\\text\{([^}]*)\}/g, '$1'],
    [/\\mathrm\{([^}]*)\}/g, '$1'],
    [/\\mathit\{([^}]*)\}/g, '$1'],
    [/\\mathbf\{([^}]*)\}/g, '$1'],
    [/\\circ/g, 'deg'],
    [/\^\{([^}]*)\}/g, '^($1)'],  // x^{2} -> x^(2)
    [/_\{([^}]*)\}/g, '_($1)'],  // x_{i} -> x_(i)
    [/\\,/g, ''],  // thin space
    [/\\:/g, ''],  // medium space
    [/\\;/g, ''],  // thick space
    [/\\!/g, ''],  // negative thin space
    [/\\ /g, ''],  // regular space
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
  
  // Step 7: Normalize common equivalent expressions
  // Remove unnecessary parentheses around single terms
  normalized = normalized.replace(/\((\d+)\)/g, '$1')
  
  // Normalize multiplication: 5*sqrt -> 5sqrt, but keep explicit multiplication where needed
  // Only remove * between number and letter/function
  normalized = normalized.replace(/(\d)\*([a-z])/g, '$1$2')
  
  // Remove leading zeros in decimals
  normalized = normalized.replace(/\b0+(\d)/g, '$1')
  
  // Normalize decimal representation
  normalized = normalized.replace(/\.0+$/g, '') // Remove trailing zeros after decimal
  
  // Step 8: Handle units at the end (remove them for pure numeric comparison)
  // Common units: cm, m, km, s, min, hr, kg, g, l, ml, etc.
  // Only strip if the rest is numeric
  const withoutUnits = normalized.replace(/\s*(square|cubic|sq|cu)?\s*(meters?|metres?|centimeters?|centimetres?|kilometers?|kilometres?|cm|mm|km|m|feet|ft|inches?|in|yards?|yd|miles?|mi|seconds?|sec|s|minutes?|min|hours?|hr|h|days?|d|years?|yr|kilograms?|kg|grams?|g|pounds?|lb|ounces?|oz|liters?|litres?|l|milliliters?|millilitres?|ml|gallons?|gal|degrees?|deg|radians?|rad)$/i, '')
  
  // Step 9: Normalize coordinate-style answers for roots/zeros
  // "(-2, 2)" -> "-2,2", "(−2, 2)" -> "-2,2", "x = -2, x = 2" -> "-2,2"
  let result = withoutUnits
  
  // Remove "x=" prefix from answers like "x=5" or "x = 5"
  result = result.replace(/x\s*=\s*/g, '')
  
  // Normalize "and" to comma
  result = result.replace(/\band\b/g, ',')
  
  // Normalize "or" to comma  
  result = result.replace(/\bor\b/g, ',')
  
  // Remove outer parentheses from comma-separated lists like "(2, 3)"
  if (/^\([^()]+,[^()]+\)$/.test(result)) {
    result = result.slice(1, -1)
  }
  
  // Normalize ± notation: "±2" -> "-2,2" for comparison
  if (/^\+?-?[0-9.]+$/.test(result.replace(/[+-]/g, ''))) {
    const plusMinusMatch = withoutUnits.match(/^\+?-?\s*(\d+\.?\d*)$/)
    if (plusMinusMatch) {
      // Check if original had ± 
      if (answer.includes('±') || answer.includes('+-')) {
        const num = plusMinusMatch[1]
        result = `-${num},${num}`
      }
    }
  }
  
  // Sort comma-separated values for consistent comparison
  if (result.includes(',')) {
    const parts = result.split(',').map(p => p.trim()).filter(p => p)
    // Try to sort numerically if all parts are numbers
    const allNumeric = parts.every(p => !isNaN(parseFloat(p)))
    if (allNumeric) {
      parts.sort((a, b) => parseFloat(a) - parseFloat(b))
    } else {
      parts.sort()
    }
    result = parts.join(',')
  }
  
  return result
}

/**
 * Compare two mathematical answers for equality.
 * Returns true if the answers are mathematically equivalent.
 * 
 * This function is generous with student input:
 * - Handles LaTeX, Unicode, and plain text
 * - Accepts equivalent forms (3/4 = 0.75, etc.)
 * - Normalizes before comparison
 */
export function compareMathAnswers(userAnswer: string, correctAnswer: string, alternates?: string[]): boolean {
  const normalizedUser = normalizeMathAnswer(userAnswer)
  const normalizedCorrect = normalizeMathAnswer(correctAnswer)
  
  // Empty check
  if (!normalizedUser || !normalizedCorrect) {
    return false
  }
  
  // Direct match (after normalization)
  if (normalizedUser === normalizedCorrect) {
    return true
  }
  
  // Try numeric comparison for decimal equivalence
  const userNum = parseFloat(normalizedUser)
  const correctNum = parseFloat(normalizedCorrect)
  if (!isNaN(userNum) && !isNaN(correctNum)) {
    // Allow small floating point tolerance (0.01% or absolute 0.0001)
    const tolerance = Math.max(0.0001, Math.abs(correctNum) * 0.0001)
    if (Math.abs(userNum - correctNum) <= tolerance) {
      return true
    }
  }
  
  // Check alternates
  if (alternates && Array.isArray(alternates)) {
    for (const alt of alternates) {
      const normalizedAlt = normalizeMathAnswer(String(alt))
      if (normalizedAlt === normalizedUser) {
        return true
      }
      // Also try numeric comparison with alternates
      const altNum = parseFloat(normalizedAlt)
      if (!isNaN(userNum) && !isNaN(altNum)) {
        const tolerance = Math.max(0.0001, Math.abs(altNum) * 0.0001)
        if (Math.abs(userNum - altNum) <= tolerance) {
          return true
        }
      }
    }
  }
  
  // Try fraction to decimal comparison
  const userFraction = parseFraction(normalizedUser)
  const correctFraction = parseFraction(normalizedCorrect)
  if (userFraction !== null && correctFraction !== null) {
    if (Math.abs(userFraction - correctFraction) < 0.0001) {
      return true
    }
  }
  
  // Also try comparing user input as fraction to correct numeric
  if (userFraction !== null && !isNaN(correctNum)) {
    if (Math.abs(userFraction - correctNum) < 0.0001) {
      return true
    }
  }
  if (!isNaN(userNum) && correctFraction !== null) {
    if (Math.abs(userNum - correctFraction) < 0.0001) {
      return true
    }
  }
  
  return false
}

/**
 * Parse a fraction string into a decimal number
 * Handles: "3/4", "(3)/(4)", "3:4", etc.
 */
function parseFraction(str: string): number | null {
  // Try a/b format
  const fractionMatch = str.match(/^\(?(-?\d+(?:\.\d+)?)\)?[/:]?\(?(-?\d+(?:\.\d+)?)\)?$/)
  if (!fractionMatch) {
    // Try explicit fraction format
    const slashMatch = str.match(/^(-?\d+(?:\.\d+)?)\s*[/:]\s*(-?\d+(?:\.\d+)?)$/)
    if (!slashMatch) return null
    const [, num, den] = slashMatch
    const denominator = parseFloat(den)
    if (denominator === 0) return null
    return parseFloat(num) / denominator
  }
  const [, num, den] = fractionMatch
  const denominator = parseFloat(den)
  if (denominator === 0) return null
  return parseFloat(num) / denominator
}

/**
 * Format a math expression for proper LaTeX display.
 * Converts Unicode symbols and plain text to LaTeX.
 */
export function formatMathForDisplay(answer: string): string {
  if (!answer || typeof answer !== 'string') return ''
  
  // If already has LaTeX delimiters, just clean it up
  if (/\$|\\\(|\\\[/.test(answer)) {
    // Ensure it has proper closing delimiters
    return answer
  }
  
  let latex = answer.trim()
  
  // Check if it's just plain text with no math content
  if (!/[\d√×÷π∞±²³⁴αβγθΔ∑^_]/.test(latex) && !/[a-z]/i.test(latex)) {
    return latex
  }
  
  // Convert Unicode math symbols to LaTeX
  const conversions: [RegExp, string][] = [
    [/√(\d+)/g, '\\sqrt{$1}'],  // √2 -> \sqrt{2}
    [/√\(([^)]+)\)/g, '\\sqrt{$1}'],  // √(2+3) -> \sqrt{2+3}
    [/√/g, '\\sqrt{'],  // Remaining √ (will need closing brace)
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
  
  // Wrap in $ if it contains LaTeX commands or math-like content
  if (/\\[a-zA-Z]+/.test(latex) || /[_^]/.test(latex) || /\d/.test(latex)) {
    return `\\(${latex}\\)`
  }
  
  return answer
}

/**
 * Parse a numeric answer with tolerance checking.
 */
export function compareNumericAnswers(
  userAnswer: string, 
  correctAnswer: number, 
  tolerance: number = 0.01
): boolean {
  const normalized = normalizeMathAnswer(userAnswer)
  const userNum = parseFloat(normalized)
  
  if (isNaN(userNum)) {
    return false
  }
  
  return Math.abs(userNum - correctAnswer) <= tolerance
}
