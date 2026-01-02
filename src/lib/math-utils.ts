/**
 * Math answer normalization and comparison utilities
 * Inspired by Khan Academy and Desmos approaches to answer validation
 * 
 * Key design principles:
 * 1. Be generous with student input - accept multiple equivalent forms
 * 2. Handle LaTeX, Unicode, and plain text uniformly
 * 3. Support fractions, expressions, and numeric answers
 * 4. Use symbolic algebra for expression equivalence
 * 5. Smart tolerance based on answer magnitude
 */

import { create, all, MathNode, SymbolNode } from 'mathjs'

// Create mathjs instance with all functions
const math = create(all)

/**
 * Normalize a mathematical expression to a canonical form for comparison.
 * Handles Unicode symbols, LaTeX commands, and various input formats.
 */
export function normalizeMathAnswer(answer: string): string {
  if (!answer || typeof answer !== 'string') return ''
  
  let normalized = answer.trim()
  
  // Step 0: Handle "and"/"or" BEFORE removing whitespace (they need word boundaries)
  normalized = normalized.replace(/\band\b/gi, ',')
  normalized = normalized.replace(/\bor\b/gi, ',')
  
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
    [/\\sqrt\[(\d+)\]\{([^}]*)\}/g, 'nthRoot($2,$1)'], // nth root
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
    [/\\arcsin/g, 'asin'],
    [/\\arccos/g, 'acos'],
    [/\\arctan/g, 'atan'],
    [/\\log/g, 'log10'],
    [/\\ln/g, 'log'],
    [/\\exp/g, 'exp'],
    // IMPORTANT: \left and \right must come BEFORE \le and \ge to avoid partial matches
    [/\\left/g, ''],
    [/\\right/g, ''],
    [/\\le(?!ft)/g, '<='],  // \le but not \left
    [/\\leq/g, '<='],
    [/\\ge(?!t)/g, '>='],   // \ge but not part of other commands
    [/\\geq/g, '>='],
    [/\\ne(?!q)/g, '!='],   // \ne but not \neq (though \neq also maps to !=)
    [/\\neq/g, '!='],
    [/\\approx/g, '~='],
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
  
  // Remove leading zeros in whole numbers (not after decimal point)
  // e.g., 007 -> 7, but 5.007 stays as 5.007
  normalized = normalized.replace(/^0+(\d)/, '$1')  // Only at start of string
  
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
 * Parse a mixed number like "1 1/2" or "2 3/4" to decimal
 * Called BEFORE normalization to preserve spaces
 */
function parseMixedNumber(str: string): number | null {
  // Pattern: whole number followed by fraction
  // Matches: "1 1/2", "2 3/4", "1-1/2", "10 2/3", "1 1 / 2"
  const cleaned = str.trim()
  const mixedMatch = cleaned.match(/^(-?\d+)\s+(\d+)\s*[/:]\s*(\d+)$/)
  if (mixedMatch) {
    const [, whole, num, den] = mixedMatch
    const denominator = parseFloat(den)
    if (denominator === 0) return null
    const wholeNum = parseFloat(whole)
    const fraction = parseFloat(num) / denominator
    // Handle negative: -1 1/2 = -1.5
    return wholeNum < 0 ? wholeNum - fraction : wholeNum + fraction
  }
  // Also try hyphenated format: 1-1/2
  const hyphenMatch = cleaned.match(/^(-?\d+)-(\d+)\s*[/:]\s*(\d+)$/)
  if (hyphenMatch) {
    const [, whole, num, den] = hyphenMatch
    const denominator = parseFloat(den)
    if (denominator === 0) return null
    const wholeNum = parseFloat(whole)
    const fraction = parseFloat(num) / denominator
    return wholeNum < 0 ? wholeNum - fraction : wholeNum + fraction
  }
  return null
}

/**
 * Parse a fraction string into a decimal number
 * Handles: "3/4", "(3)/(4)", "3:4", mixed numbers "1 1/2", etc.
 */
function parseFraction(str: string): number | null {
  // First try mixed number
  const mixed = parseMixedNumber(str)
  if (mixed !== null) return mixed
  
  // Try explicit fraction format first (most common): "1/2", "3:4"
  const slashMatch = str.match(/^(-?\d+(?:\.\d+)?)\s*[/:]\s*(-?\d+(?:\.\d+)?)$/)
  if (slashMatch) {
    const [, num, den] = slashMatch
    const denominator = parseFloat(den)
    if (denominator === 0) return null
    return parseFloat(num) / denominator
  }
  
  // Try parenthesized format: "(1)/(2)"
  const parenMatch = str.match(/^\((-?\d+(?:\.\d+)?)\)\s*[/:]\s*\((-?\d+(?:\.\d+)?)\)$/)
  if (parenMatch) {
    const [, num, den] = parenMatch
    const denominator = parseFloat(den)
    if (denominator === 0) return null
    return parseFloat(num) / denominator
  }
  
  return null
}

/**
 * Parse scientific notation: 3.14e2, 3.14E2, 3.14×10^2, 3.14*10^2
 */
function parseScientificNotation(str: string): number | null {
  // Standard notation: 3.14e2, 3.14E2, 3.14e-2
  const standardMatch = str.match(/^(-?\d+\.?\d*)[eE]([+-]?\d+)$/)
  if (standardMatch) {
    const [, mantissa, exponent] = standardMatch
    return parseFloat(mantissa) * Math.pow(10, parseInt(exponent))
  }
  
  // Written notation: 3.14×10^2, 3.14*10^2, 3.14x10^2
  const writtenMatch = str.match(/^(-?\d+\.?\d*)\s*[×x\*]\s*10\s*\^\s*\(?([+-]?\d+)\)?$/)
  if (writtenMatch) {
    const [, mantissa, exponent] = writtenMatch
    return parseFloat(mantissa) * Math.pow(10, parseInt(exponent))
  }
  
  return null
}

/**
 * Parse percentage: 50%, 0.5 as 50%, etc.
 * Returns the decimal value (50% -> 0.5)
 */
function parsePercentage(str: string): { value: number; isPercent: boolean } | null {
  const percentMatch = str.match(/^(-?\d+\.?\d*)\s*%$/)
  if (percentMatch) {
    return { value: parseFloat(percentMatch[1]) / 100, isPercent: true }
  }
  return null
}

/**
 * Calculate smart tolerance based on the magnitude of the answer
 * - For small numbers (< 1): use absolute tolerance of 0.001
 * - For medium numbers (1-100): use 0.01
 * - For large numbers (> 100): use percentage-based tolerance (0.1%)
 */
function getSmartTolerance(correctAnswer: number): number {
  const magnitude = Math.abs(correctAnswer)
  
  if (magnitude === 0) return 0.001
  if (magnitude < 1) return 0.001  // For 0.5, tolerance is 0.001
  if (magnitude < 10) return 0.01  // For 5, tolerance is 0.01
  if (magnitude < 100) return 0.05 // For 50, tolerance is 0.05
  if (magnitude < 1000) return magnitude * 0.001  // 0.1% tolerance
  
  // For very large numbers, use 0.1% tolerance
  return magnitude * 0.001
}

/**
 * Try to evaluate an expression to a numeric value using mathjs
 */
function tryEvaluateExpression(expr: string): number | null {
  try {
    // Clean the expression for mathjs
    let cleanExpr = expr
      .replace(/\^/g, '**')  // Use ** for power
      .replace(/(\d)([a-z])/gi, '$1*$2')  // 2x -> 2*x
      .replace(/\)(\d)/g, ')*$1')  // )2 -> )*2
      .replace(/(\d)\(/g, '$1*(')  // 2( -> 2*(
    
    // Replace common constants
    cleanExpr = cleanExpr.replace(/\bpi\b/gi, String(Math.PI))
    cleanExpr = cleanExpr.replace(/\be\b/g, String(Math.E))
    
    // Handle sqrt and cbrt functions (mathjs uses sqrt and cbrt natively)
    // Already supported by mathjs, but ensure proper syntax
    cleanExpr = cleanExpr.replace(/sqrt(\d+)/g, 'sqrt($1)')  // sqrt4 -> sqrt(4)
    cleanExpr = cleanExpr.replace(/cbrt(\d+)/g, 'cbrt($1)')  // cbrt8 -> cbrt(8)
    
    const result = math.evaluate(cleanExpr)
    if (typeof result === 'number' && isFinite(result)) {
      return result
    }
    return null
  } catch {
    return null
  }
}

/**
 * Simplify a fraction to lowest terms using mathjs
 * Returns simplified fraction as string "num/den" or null if not a fraction
 */
function simplifyFraction(str: string): string | null {
  const match = str.match(/^(-?\d+)\s*[/:]\s*(\d+)$/)
  if (!match) return null
  
  try {
    const [, num, den] = match
    const fraction = math.fraction(parseInt(num), parseInt(den))
    // mathjs fraction has n (numerator) and d (denominator) properties
    const f = fraction as unknown as { n: number; d: number; s: number }
    const sign = f.s < 0 ? '-' : ''
    return `${sign}${Math.abs(f.n)}/${f.d}`
  } catch {
    return null
  }
}

/**
 * Check if two expressions are symbolically equivalent using mathjs
 * Handles algebraic equivalence like 2x+1 = 1+2x = x+x+1
 */
function areExpressionsEquivalent(expr1: string, expr2: string): boolean {
  try {
    // Parse both expressions
    const parsed1 = math.parse(expr1)
    const parsed2 = math.parse(expr2)
    
    // Simplify both
    const simplified1 = math.simplify(parsed1)
    const simplified2 = math.simplify(parsed2)
    
    // Compare simplified string representations
    if (simplified1.toString() === simplified2.toString()) {
      return true
    }
    
    // Try subtracting them - if result simplifies to 0, they're equivalent
    const difference = math.simplify(math.parse(`(${expr1}) - (${expr2})`))
    const diffStr = difference.toString()
    
    if (diffStr === '0') return true
    
    // Try evaluating at several test points if expressions contain variables
    const hasVariables = containsVariables(parsed1) || containsVariables(parsed2)
    if (hasVariables) {
      // Test at multiple points
      const testPoints = [-2, -1, 0, 0.5, 1, 2, 3, 10]
      const variables = extractVariables(parsed1).concat(extractVariables(parsed2))
      const uniqueVars = [...new Set(variables)]
      
      if (uniqueVars.length === 1) {
        const varName = uniqueVars[0]
        let allMatch = true
        
        for (const testVal of testPoints) {
          try {
            const scope = { [varName]: testVal }
            const result1 = parsed1.evaluate(scope)
            const result2 = parsed2.evaluate(scope)
            
            if (typeof result1 === 'number' && typeof result2 === 'number') {
              const tolerance = getSmartTolerance(result1)
              if (Math.abs(result1 - result2) > tolerance) {
                allMatch = false
                break
              }
            }
          } catch {
            // Skip this test point if evaluation fails
          }
        }
        
        if (allMatch) return true
      }
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * Check if a parsed expression contains variables
 */
function containsVariables(node: MathNode): boolean {
  let hasVars = false
  node.traverse((n: MathNode) => {
    if (n.type === 'SymbolNode') {
      const sym = n as SymbolNode
      // Exclude known constants and functions
      const constants = ['pi', 'e', 'i', 'infinity', 'NaN']
      const funcs = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs', 'exp', 'asin', 'acos', 'atan']
      if (!constants.includes(sym.name) && !funcs.includes(sym.name)) {
        hasVars = true
      }
    }
  })
  return hasVars
}

/**
 * Extract variable names from a parsed expression
 */
function extractVariables(node: MathNode): string[] {
  const vars: string[] = []
  const constants = ['pi', 'e', 'i', 'infinity', 'NaN']
  const funcs = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs', 'exp', 'asin', 'acos', 'atan', 'nthRoot']
  
  node.traverse((n: MathNode) => {
    if (n.type === 'SymbolNode') {
      const sym = n as SymbolNode
      if (!constants.includes(sym.name) && !funcs.includes(sym.name)) {
        vars.push(sym.name)
      }
    }
  })
  return vars
}

/**
 * Compare two mathematical answers for equality.
 * Returns true if the answers are mathematically equivalent.
 * 
 * This function is generous with student input:
 * - Handles LaTeX, Unicode, and plain text
 * - Accepts equivalent forms (3/4 = 0.75, 1/2 = 0.5, 1 1/2 = 1.5, etc.)
 * - Handles scientific notation (3.14e2 = 314)
 * - Handles percentages (50% = 0.5 when comparing to decimal context)
 * - Uses symbolic algebra for expression equivalence
 * - Smart tolerance based on answer magnitude
 * - Normalizes before comparison
 */
export function compareMathAnswers(userAnswer: string, correctAnswer: string, alternates?: string[]): boolean {
  // Try mixed number parsing BEFORE normalization (preserves spaces)
  const userMixed = parseMixedNumber(userAnswer)
  const correctMixed = parseMixedNumber(correctAnswer)
  
  // If either is a mixed number, compare as decimals
  if (userMixed !== null || correctMixed !== null) {
    const userVal = userMixed ?? parseFloat(normalizeMathAnswer(userAnswer))
    const correctVal = correctMixed ?? parseFloat(normalizeMathAnswer(correctAnswer))
    
    if (!isNaN(userVal) && !isNaN(correctVal)) {
      const tolerance = getSmartTolerance(correctVal)
      if (Math.abs(userVal - correctVal) <= tolerance) {
        return true
      }
    }
  }
  
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
  
  // Try simplified fraction comparison (4/8 should equal 1/2)
  const userSimplified = simplifyFraction(normalizedUser)
  const correctSimplified = simplifyFraction(normalizedCorrect)
  if (userSimplified && correctSimplified && userSimplified === correctSimplified) {
    return true
  }
  
  // Try numeric comparison for decimal equivalence
  // Only use parseFloat if the string is actually a pure number (not a fraction like "1/4")
  const userNum = parseFloat(normalizedUser)
  const correctNum = parseFloat(normalizedCorrect)
  const userIsPureNumber = !isNaN(userNum) && String(userNum) === normalizedUser || /^-?\d+\.?\d*$/.test(normalizedUser)
  const correctIsPureNumber = !isNaN(correctNum) && String(correctNum) === normalizedCorrect || /^-?\d+\.?\d*$/.test(normalizedCorrect)
  if (userIsPureNumber && correctIsPureNumber) {
    const tolerance = getSmartTolerance(correctNum)
    if (Math.abs(userNum - correctNum) <= tolerance) {
      return true
    }
  }
  
  // Try fraction to decimal comparison (including mixed numbers)
  const userFraction = parseFraction(normalizedUser)
  const correctFraction = parseFraction(normalizedCorrect)
  if (userFraction !== null && correctFraction !== null) {
    const tolerance = getSmartTolerance(correctFraction)
    if (Math.abs(userFraction - correctFraction) <= tolerance) {
      return true
    }
  }
  
  // Cross-compare fraction and decimal
  if (userFraction !== null && correctIsPureNumber) {
    const tolerance = getSmartTolerance(correctNum)
    if (Math.abs(userFraction - correctNum) <= tolerance) {
      return true
    }
  }
  if (userIsPureNumber && correctFraction !== null) {
    const tolerance = getSmartTolerance(correctFraction)
    if (Math.abs(userNum - correctFraction) <= tolerance) {
      return true
    }
  }
  
  // Try scientific notation comparison
  const userScientific = parseScientificNotation(normalizedUser)
  const correctScientific = parseScientificNotation(normalizedCorrect)
  
  if (userScientific !== null) {
    const compareTarget = correctScientific ?? (correctIsPureNumber ? correctNum : null)
    if (compareTarget !== null) {
      const tolerance = getSmartTolerance(compareTarget)
      if (Math.abs(userScientific - compareTarget) <= tolerance) {
        return true
      }
    }
  }
  if (correctScientific !== null && userIsPureNumber) {
    const tolerance = getSmartTolerance(correctScientific)
    if (Math.abs(userNum - correctScientific) <= tolerance) {
      return true
    }
  }
  
  // Try percentage comparison
  const userPercent = parsePercentage(normalizedUser)
  const correctPercent = parsePercentage(normalizedCorrect)
  
  if (userPercent && correctPercent) {
    // Both are percentages
    const tolerance = getSmartTolerance(correctPercent.value)
    if (Math.abs(userPercent.value - correctPercent.value) <= tolerance) {
      return true
    }
  }
  // User gave percentage, correct is decimal (50% vs 0.5)
  if (userPercent && correctIsPureNumber) {
    const tolerance = getSmartTolerance(correctNum)
    if (Math.abs(userPercent.value - correctNum) <= tolerance) {
      return true
    }
  }
  // User gave decimal, correct is percentage
  if (userIsPureNumber && correctPercent) {
    const tolerance = getSmartTolerance(correctPercent.value)
    if (Math.abs(userNum - correctPercent.value) <= tolerance) {
      return true
    }
  }
  
  // Try evaluating expressions to numeric values
  // This is useful when BOTH are expressions that should be equivalent
  const userEvaluated = tryEvaluateExpression(normalizedUser)
  const correctEvaluated = tryEvaluateExpression(normalizedCorrect)
  
  if (userEvaluated !== null && correctEvaluated !== null) {
    const tolerance = getSmartTolerance(correctEvaluated)
    if (Math.abs(userEvaluated - correctEvaluated) <= tolerance) {
      return true
    }
  }
  
  // Try symbolic algebra comparison for expressions (2x+1 = 1+2x)
  if (areExpressionsEquivalent(normalizedUser, normalizedCorrect)) {
    return true
  }
  
  // Check alternates
  if (alternates && Array.isArray(alternates)) {
    for (const alt of alternates) {
      const normalizedAlt = normalizeMathAnswer(String(alt))
      if (normalizedAlt === normalizedUser) {
        return true
      }
      
      // Try numeric comparison with alternates
      const altNum = parseFloat(normalizedAlt)
      if (!isNaN(userNum) && !isNaN(altNum)) {
        const tolerance = getSmartTolerance(altNum)
        if (Math.abs(userNum - altNum) <= tolerance) {
          return true
        }
      }
      
      // Try fraction comparison with alternates
      const altFraction = parseFraction(normalizedAlt)
      if (userFraction !== null && altFraction !== null) {
        const tolerance = getSmartTolerance(altFraction)
        if (Math.abs(userFraction - altFraction) <= tolerance) {
          return true
        }
      }
      
      // Try symbolic comparison with alternates
      if (areExpressionsEquivalent(normalizedUser, normalizedAlt)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Check if a string is an unevaluated mathematical expression
 * (contains operators that should be computed, not just stated)
 * Used to reject answers like "2^5" when the question asks for the value (32)
 */
function isUnevaluatedExpression(str: string): boolean {
  const normalized = str.trim().toLowerCase()
  
  // Skip if it's just a number (possibly with decimal)
  if (/^-?\d+\.?\d*$/.test(normalized)) {
    return false
  }
  
  // Skip fractions like "1/2" - these are valid numeric representations
  if (/^-?\d+\s*\/\s*\d+$/.test(normalized)) {
    return false
  }
  
  // Skip mixed numbers like "1 1/2"
  if (/^-?\d+\s+\d+\s*\/\s*\d+$/.test(normalized)) {
    return false
  }
  
  // Skip scientific notation like "3.14e2"
  if (/^-?\d+\.?\d*[eE][+-]?\d+$/.test(normalized)) {
    return false
  }
  
  // Check for operations that should be computed:
  // Powers: 2^5, 2**5
  if (/\^|\*\*/.test(normalized)) {
    return true
  }
  
  // Square roots: sqrt(4), √4
  if (/sqrt|√|cbrt|∛/.test(normalized)) {
    return true
  }
  
  // Addition/subtraction in numeric context: 2+3, 10-5
  // But not negative numbers like -5
  if (/\d\s*[\+]\s*\d/.test(normalized)) {
    return true
  }
  if (/\d\s*[\-]\s*\d/.test(normalized)) {
    return true
  }
  
  // Multiplication in numeric context: 2*3, 2×3 (but not 2x as variable)
  if (/\d\s*[\*×·]\s*\d/.test(normalized)) {
    return true
  }
  
  // Division that's not a simple fraction: 10÷2
  if (/÷/.test(normalized)) {
    return true
  }
  
  // Parentheses with operations inside: (2+3), (4*5)
  if (/\([^)]*[\+\-\*\/\^][^)]*\)/.test(normalized)) {
    return true
  }
  
  // Function calls that compute values: sin(0), log(10), abs(-5)
  if (/\b(sin|cos|tan|log|ln|exp|abs|floor|ceil|round)\s*\(/.test(normalized)) {
    return true
  }
  
  return false
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
 * Parse a numeric answer with smart tolerance checking.
 * Tolerance is automatically determined based on the magnitude of the correct answer.
 * 
 * IMPORTANT: For numeric answers, we reject unevaluated expressions.
 * If the question asks "what is 2^5?", the answer must be "32", not "2^5".
 * Students must compute the result, not just restate the expression.
 */
export function compareNumericAnswers(
  userAnswer: string, 
  correctAnswer: number, 
  tolerance?: number,
  options?: { allowExpressions?: boolean }
): boolean {
  // STRICT MODE: Reject unevaluated expressions for numeric questions
  // This ensures students actually compute the answer rather than restating the problem
  if (!options?.allowExpressions && isUnevaluatedExpression(userAnswer)) {
    return false
  }
  
  // Try fraction on original input first (before normalization might change things)
  const fractionFromOriginal = parseFraction(userAnswer.trim())
  if (fractionFromOriginal !== null) {
    const effectiveTolerance = tolerance ?? getSmartTolerance(correctAnswer)
    return Math.abs(fractionFromOriginal - correctAnswer) <= effectiveTolerance
  }
  
  // Try mixed number on original input
  const mixedFromOriginal = parseMixedNumber(userAnswer)
  if (mixedFromOriginal !== null) {
    const effectiveTolerance = tolerance ?? getSmartTolerance(correctAnswer)
    return Math.abs(mixedFromOriginal - correctAnswer) <= effectiveTolerance
  }
  
  const normalized = normalizeMathAnswer(userAnswer)
  
  // Try direct parse
  let userNum = parseFloat(normalized)
  
  // If direct parse fails, try fraction on normalized
  if (isNaN(userNum)) {
    const fraction = parseFraction(normalized)
    if (fraction !== null) {
      userNum = fraction
    }
  }
  
  // Try scientific notation
  if (isNaN(userNum)) {
    const scientific = parseScientificNotation(normalized)
    if (scientific !== null) {
      userNum = scientific
    }
  }
  
  // Try evaluating as expression
  if (isNaN(userNum)) {
    const evaluated = tryEvaluateExpression(normalized)
    if (evaluated !== null) {
      userNum = evaluated
    }
  }
  
  if (isNaN(userNum)) {
    return false
  }
  
  // Use provided tolerance or smart tolerance
  const effectiveTolerance = tolerance ?? getSmartTolerance(correctAnswer)
  
  return Math.abs(userNum - correctAnswer) <= effectiveTolerance
}

/**
 * Validate and provide detailed feedback about an answer comparison.
 * Useful for server-side validation and debugging.
 */
export interface AnswerValidationResult {
  isCorrect: boolean
  normalizedUser: string
  normalizedCorrect: string
  matchType: 'exact' | 'numeric' | 'fraction' | 'expression' | 'alternate' | 'scientific' | 'percentage' | 'none'
  tolerance?: number
  userValue?: number
  correctValue?: number
  confidence: 'high' | 'medium' | 'low'
}

export function validateAnswer(
  userAnswer: string,
  correctAnswer: string,
  answerType: string,
  correctAnswerData?: {
    value?: string | number
    alternates?: string[]
    tolerance?: number
    latex?: string
  }
): AnswerValidationResult {
  const normalizedUser = normalizeMathAnswer(userAnswer)
  const normalizedCorrect = normalizeMathAnswer(correctAnswer)
  
  const result: AnswerValidationResult = {
    isCorrect: false,
    normalizedUser,
    normalizedCorrect,
    matchType: 'none',
    confidence: 'high'
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
  
  // For numeric answer types, use numeric comparison
  if (answerType === 'numeric' || answerType === 'expression') {
    // STRICT MODE for numeric: reject unevaluated expressions
    // If the question asks "what is 2^5?" the answer must be "32", not "2^5"
    if (answerType === 'numeric' && isUnevaluatedExpression(userAnswer)) {
      result.matchType = 'none'
      result.confidence = 'high'
      return result
    }
    
    const userNum = parseFloat(normalizedUser) || parseFraction(normalizedUser) || parseScientificNotation(normalizedUser)
    const correctNum = typeof correctAnswerData?.value === 'number' 
      ? correctAnswerData.value 
      : parseFloat(normalizedCorrect) || parseFraction(normalizedCorrect) || parseScientificNotation(normalizedCorrect)
    
    if (userNum !== null && correctNum !== null) {
      const tolerance = correctAnswerData?.tolerance ?? getSmartTolerance(correctNum)
      result.tolerance = tolerance
      result.userValue = userNum
      result.correctValue = correctNum
      
      if (Math.abs(userNum - correctNum) <= tolerance) {
        result.isCorrect = true
        result.matchType = 'numeric'
        return result
      }
    }
  }
  
  // Full comparison for short_answer and other types
  // STRICT MODE for short_answer: If the correct answer is a simple number,
  // reject unevaluated expressions (student must compute the result)
  if (answerType === 'short_answer') {
    const correctIsSimpleNumber = /^-?\d+\.?\d*$/.test(normalizedCorrect)
    if (correctIsSimpleNumber && isUnevaluatedExpression(userAnswer)) {
      result.matchType = 'none'
      result.confidence = 'high'
      return result
    }
  }
  
  const isMatch = compareMathAnswers(userAnswer, correctAnswer, correctAnswerData?.alternates)
  
  if (isMatch) {
    result.isCorrect = true
    
    // Determine match type
    if (parseFraction(normalizedUser) !== null && !isNaN(parseFloat(normalizedCorrect))) {
      result.matchType = 'fraction'
    } else if (parseScientificNotation(normalizedUser) !== null) {
      result.matchType = 'scientific'
    } else if (parsePercentage(normalizedUser) !== null) {
      result.matchType = 'percentage'
    } else if (!isNaN(parseFloat(normalizedUser))) {
      result.matchType = 'numeric'
    } else if (areExpressionsEquivalent(normalizedUser, normalizedCorrect)) {
      result.matchType = 'expression'
      result.confidence = 'medium' // Symbolic comparison is less certain
    } else if (correctAnswerData?.alternates?.some(alt => 
      normalizeMathAnswer(alt) === normalizedUser
    )) {
      result.matchType = 'alternate'
    }
  }
  
  return result
}

/**
 * Get detailed explanation of why an answer was marked correct or incorrect
 * Useful for providing feedback to students
 */
export function getAnswerFeedback(
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean
): string {
  if (isCorrect) {
    const normalizedUser = normalizeMathAnswer(userAnswer)
    const normalizedCorrect = normalizeMathAnswer(correctAnswer)
    
    if (normalizedUser === normalizedCorrect) {
      return 'Exact match!'
    }
    
    // Check what type of equivalence was used
    const userFraction = parseFraction(normalizedUser)
    const correctNum = parseFloat(normalizedCorrect)
    
    if (userFraction !== null && !isNaN(correctNum)) {
      return `Correct! ${userAnswer} equals ${correctAnswer}`
    }
    
    const userScientific = parseScientificNotation(normalizedUser)
    if (userScientific !== null) {
      return `Correct! Scientific notation accepted`
    }
    
    const userPercent = parsePercentage(normalizedUser)
    if (userPercent !== null) {
      return `Correct! Percentage form accepted`
    }
    
    return 'Correct!'
  }
  
  return 'Incorrect. Try again!'
}

// Export parseFraction for use in other modules
export { parseFraction, parseScientificNotation, parsePercentage, getSmartTolerance }

// =============================================================================
// FILL-IN-THE-BLANK AND MATCHING VALIDATION
// =============================================================================

/**
 * Validate a fill-in-the-blank answer
 * Supports multiple blanks with position tracking
 */
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

export function validateFillBlank(
  userAnswers: string | string[],
  correctBlanks: BlankAnswer[]
): FillBlankValidationResult {
  // Normalize user answers to array
  const userAnswerArray = Array.isArray(userAnswers) 
    ? userAnswers 
    : userAnswers.split(/[,;|]/).map(a => a.trim())
  
  const details: FillBlankValidationResult['details'] = []
  let blanksCorrect = 0
  
  for (let i = 0; i < correctBlanks.length; i++) {
    const blank = correctBlanks[i]
    const position = blank.position ?? i
    // Use the sequential index (i) to get the user's answer at that position in the array
    const userAnswer = userAnswerArray[i] || ''
    const correctValue = blank.value || blank.latex || ''
    
    // Check if answer matches using math comparison
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

/**
 * Validate a matching answer
 * User provides an array of indices mapping left items to right items
 */
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

export function validateMatching(
  userMatches: number[],  // Array where index is left item, value is selected right item index
  correctMatches: number[], // Array where index is left item, value is correct right item index
  pairs?: MatchingPair[] // Optional pairs for detailed feedback
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
 * Sanitize user input to prevent potential issues
 * Removes potentially dangerous patterns while preserving math content
 */
export function sanitizeAnswerInput(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  // Limit input length to prevent DoS
  const maxLength = 10000
  let sanitized = input.slice(0, maxLength)
  
  // Remove zero-width characters that could cause comparison issues
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
  
  // Remove control characters (except normal whitespace)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  return sanitized
}
