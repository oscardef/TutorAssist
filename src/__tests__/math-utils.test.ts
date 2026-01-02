/**
 * Tests for simplified math-utils.ts
 * 
 * Design philosophy:
 * - STRICT matching: exact equality after normalization
 * - False negatives are acceptable (students can use "I was right")
 * - False positives are NOT acceptable
 * - Fraction-to-decimal conversion is the only "fuzzy" matching allowed
 */

import {
  normalizeMathAnswer,
  compareMathAnswers,
  compareNumericAnswers,
  validateAnswer,
  formatMathForDisplay,
  parseFraction,
  validateFillBlank,
  validateMatching,
  sanitizeAnswerInput,
} from '@/lib/math-utils'

describe('normalizeMathAnswer', () => {
  describe('basic normalization', () => {
    it('should trim whitespace', () => {
      expect(normalizeMathAnswer('  5  ')).toBe('5')
      expect(normalizeMathAnswer('  2 + 3  ')).toBe('2+3')
    })

    it('should convert to lowercase', () => {
      expect(normalizeMathAnswer('X + Y')).toBe('x+y')
    })

    it('should handle empty input', () => {
      expect(normalizeMathAnswer('')).toBe('')
      expect(normalizeMathAnswer(null as unknown as string)).toBe('')
    })
  })

  describe('Unicode symbol normalization', () => {
    it('should convert multiplication symbols', () => {
      expect(normalizeMathAnswer('5×3')).toBe('5*3')
      expect(normalizeMathAnswer('5·3')).toBe('5*3')
    })

    it('should convert division symbols', () => {
      expect(normalizeMathAnswer('6÷2')).toBe('6/2')
    })

    it('should convert minus signs', () => {
      expect(normalizeMathAnswer('5−3')).toBe('5-3')
      expect(normalizeMathAnswer('5–3')).toBe('5-3')
      expect(normalizeMathAnswer('5—3')).toBe('5-3')
    })

    it('should convert superscript numbers', () => {
      expect(normalizeMathAnswer('x²')).toBe('x^2')
      expect(normalizeMathAnswer('x³')).toBe('x^3')
    })

    it('should convert Greek letters', () => {
      expect(normalizeMathAnswer('π')).toBe('pi')
      expect(normalizeMathAnswer('θ')).toBe('theta')
      expect(normalizeMathAnswer('α')).toBe('alpha')
      expect(normalizeMathAnswer('β')).toBe('beta')
      expect(normalizeMathAnswer('γ')).toBe('gamma')
      expect(normalizeMathAnswer('δ')).toBe('delta')
      expect(normalizeMathAnswer('λ')).toBe('lambda')
      expect(normalizeMathAnswer('σ')).toBe('sigma')
      expect(normalizeMathAnswer('ω')).toBe('omega')
      expect(normalizeMathAnswer('φ')).toBe('phi')
      expect(normalizeMathAnswer('μ')).toBe('mu')
      expect(normalizeMathAnswer('Δ')).toBe('delta')
    })

    it('should convert fraction symbols to decimals', () => {
      expect(normalizeMathAnswer('½')).toBe('0.5')
      expect(normalizeMathAnswer('¼')).toBe('0.25')
      expect(normalizeMathAnswer('¾')).toBe('0.75')
      expect(normalizeMathAnswer('⅓')).toBe('0.333')
      expect(normalizeMathAnswer('⅔')).toBe('0.667')
    })

    it('should convert comparison operators', () => {
      expect(normalizeMathAnswer('x≤5')).toBe('x<=5')
      expect(normalizeMathAnswer('x≥5')).toBe('x>=5')
      expect(normalizeMathAnswer('x≠5')).toBe('x!=5')
      expect(normalizeMathAnswer('x≈5')).toBe('x~=5')
    })

    it('should convert calculus symbols', () => {
      expect(normalizeMathAnswer('∫')).toBe('int')
      expect(normalizeMathAnswer('∬')).toBe('iint')
      expect(normalizeMathAnswer('∑')).toBe('sum')
      expect(normalizeMathAnswer('∏')).toBe('prod')
      expect(normalizeMathAnswer('∞')).toBe('infinity')
      expect(normalizeMathAnswer('∂')).toBe('partial')
      expect(normalizeMathAnswer('∇')).toBe('nabla')
      expect(normalizeMathAnswer('→')).toBe('->')
    })

    it('should convert set theory symbols', () => {
      expect(normalizeMathAnswer('∈')).toBe('in')
      expect(normalizeMathAnswer('∉')).toBe('notin')
      expect(normalizeMathAnswer('⊂')).toBe('subset')
      expect(normalizeMathAnswer('⊃')).toBe('supset')
      expect(normalizeMathAnswer('∪')).toBe('union')
      expect(normalizeMathAnswer('∩')).toBe('intersect')
      expect(normalizeMathAnswer('∅')).toBe('emptyset')
      expect(normalizeMathAnswer('ℝ')).toBe('R')  // uppercase R (letter first, then lowercase)
      expect(normalizeMathAnswer('ℤ')).toBe('Z')
      expect(normalizeMathAnswer('ℕ')).toBe('N')
      expect(normalizeMathAnswer('ℂ')).toBe('C')
    })

    it('should convert root symbols', () => {
      expect(normalizeMathAnswer('√4')).toBe('sqrt4')
      expect(normalizeMathAnswer('∛8')).toBe('cbrt8')
    })
  })

  describe('LaTeX normalization', () => {
    it('should convert LaTeX fractions', () => {
      expect(normalizeMathAnswer('\\frac{1}{2}')).toBe('1/2')
      expect(normalizeMathAnswer('\\dfrac{3}{4}')).toBe('3/4')
    })

    it('should convert LaTeX square roots', () => {
      expect(normalizeMathAnswer('\\sqrt{4}')).toBe('sqrt4')
      expect(normalizeMathAnswer('\\sqrt[3]{8}')).toBe('root(8,3)')
    })

    it('should convert LaTeX operators', () => {
      expect(normalizeMathAnswer('5\\times3')).toBe('5*3')
      expect(normalizeMathAnswer('6\\div2')).toBe('6/2')
      expect(normalizeMathAnswer('5\\cdot3')).toBe('5*3')
    })

    it('should remove LaTeX delimiters', () => {
      expect(normalizeMathAnswer('\\(5\\)')).toBe('5')
      expect(normalizeMathAnswer('$5$')).toBe('5')
      expect(normalizeMathAnswer('$$5$$')).toBe('5')
    })

    it('should convert trig functions', () => {
      expect(normalizeMathAnswer('\\sin(x)')).toBe('sin(x)')
      expect(normalizeMathAnswer('\\cos(x)')).toBe('cos(x)')
      expect(normalizeMathAnswer('\\tan(x)')).toBe('tan(x)')
    })

    it('should convert Greek LaTeX commands', () => {
      expect(normalizeMathAnswer('\\pi')).toBe('pi')
      expect(normalizeMathAnswer('\\theta')).toBe('theta')
      expect(normalizeMathAnswer('\\alpha')).toBe('alpha')
    })

    it('should convert comparison operators', () => {
      expect(normalizeMathAnswer('\\leq')).toBe('<=')
      expect(normalizeMathAnswer('\\geq')).toBe('>=')
      expect(normalizeMathAnswer('\\neq')).toBe('!=')
    })
  })
})

describe('compareMathAnswers - STRICT matching', () => {
  describe('exact matches after normalization', () => {
    it('should match identical answers', () => {
      expect(compareMathAnswers('5', '5')).toBe(true)
      expect(compareMathAnswers('x+1', 'x+1')).toBe(true)
    })

    it('should match after whitespace normalization', () => {
      expect(compareMathAnswers('  5  ', '5')).toBe(true)
      expect(compareMathAnswers('x + 1', 'x+1')).toBe(true)
    })

    it('should match after case normalization', () => {
      expect(compareMathAnswers('X + Y', 'x+y')).toBe(true)
    })

    it('should match Unicode symbols with LaTeX equivalents', () => {
      expect(compareMathAnswers('5×3', '5\\times3')).toBe(true)
      expect(compareMathAnswers('π', '\\pi')).toBe(true)
      expect(compareMathAnswers('θ', '\\theta')).toBe(true)
    })
  })

  describe('fraction and decimal equivalence', () => {
    it('should recognize 1/2 = 0.5', () => {
      expect(compareMathAnswers('1/2', '0.5')).toBe(true)
      expect(compareMathAnswers('0.5', '1/2')).toBe(true)
    })

    it('should recognize 3/4 = 0.75', () => {
      expect(compareMathAnswers('3/4', '0.75')).toBe(true)
      expect(compareMathAnswers('0.75', '3/4')).toBe(true)
    })

    it('should recognize 1/4 = 0.25', () => {
      expect(compareMathAnswers('1/4', '0.25')).toBe(true)
    })

    it('should handle LaTeX fractions', () => {
      expect(compareMathAnswers('\\frac{1}{2}', '0.5')).toBe(true)
      expect(compareMathAnswers('\\frac{3}{4}', '0.75')).toBe(true)
    })
  })

  describe('alternate answers', () => {
    it('should accept listed alternates', () => {
      expect(compareMathAnswers('2', '4', ['2', '3'])).toBe(true)
      expect(compareMathAnswers('pi', '3.14', ['pi', '3.14159'])).toBe(true)
    })

    it('should normalize alternates before comparing', () => {
      expect(compareMathAnswers('π', '3.14', ['\\pi', '3.14159'])).toBe(true)
    })
  })

  describe('things that should NOT match (avoiding false positives)', () => {
    it('should NOT match algebraically equivalent expressions', () => {
      // These used to match but now should NOT - we want strict matching
      expect(compareMathAnswers('2x+1', '1+2x')).toBe(false)
      expect(compareMathAnswers('x+x', '2x')).toBe(false)
    })

    it('should NOT match expression to evaluated result', () => {
      // sqrt(4) should NOT equal 2 - student must evaluate
      expect(compareMathAnswers('sqrt(4)', '2')).toBe(false)
      expect(compareMathAnswers('2^3', '8')).toBe(false)
      expect(compareMathAnswers('2+3', '5')).toBe(false)
    })

    it('should NOT match scientific notation to regular number', () => {
      // 3.14e2 should NOT equal 314 - we want exact string match
      expect(compareMathAnswers('3.14e2', '314')).toBe(false)
    })

    it('should NOT match percentages to decimals', () => {
      // 50% should NOT equal 0.5 - we want exact string match
      expect(compareMathAnswers('50%', '0.5')).toBe(false)
    })

    it('should NOT match mixed numbers to decimals', () => {
      // 1 1/2 should NOT equal 1.5 - requires specific parsing
      expect(compareMathAnswers('1 1/2', '1.5')).toBe(false)
    })

    it('should NOT match with tolerance', () => {
      // 0.333 should NOT equal 0.334 even if close
      expect(compareMathAnswers('0.333', '0.334')).toBe(false)
      expect(compareMathAnswers('3.14159', '3.14')).toBe(false)
    })

    it('should NOT match different expressions', () => {
      expect(compareMathAnswers('x', 'y')).toBe(false)
      expect(compareMathAnswers('5', '6')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(compareMathAnswers('', '')).toBe(false)
      expect(compareMathAnswers('5', '')).toBe(false)
      expect(compareMathAnswers('', '5')).toBe(false)
    })

    it('should handle division by zero in fractions', () => {
      expect(compareMathAnswers('1/0', '1/0')).toBe(true) // exact match
      expect(compareMathAnswers('1/0', 'infinity')).toBe(false)
    })
  })
})

describe('compareNumericAnswers', () => {
  it('should match exact numbers', () => {
    expect(compareNumericAnswers('5', 5)).toBe(true)
    expect(compareNumericAnswers('3.14', 3.14)).toBe(true)
    expect(compareNumericAnswers('-10', -10)).toBe(true)
  })

  it('should match fractions to their decimal values', () => {
    expect(compareNumericAnswers('1/2', 0.5)).toBe(true)
    expect(compareNumericAnswers('3/4', 0.75)).toBe(true)
    expect(compareNumericAnswers('1/4', 0.25)).toBe(true)
  })

  it('should NOT match with tolerance', () => {
    // We want strict matching now
    expect(compareNumericAnswers('3.14', 3.14159)).toBe(false)
    expect(compareNumericAnswers('0.333', 1/3)).toBe(false) // 1/3 = 0.3333...
  })

  it('should return false for non-numeric input', () => {
    expect(compareNumericAnswers('abc', 5)).toBe(false)
    expect(compareNumericAnswers('x+1', 5)).toBe(false)
  })
})

describe('validateAnswer', () => {
  it('should return correct result for exact match', () => {
    const result = validateAnswer('5', '5', 'short_answer')
    expect(result.isCorrect).toBe(true)
    expect(result.matchType).toBe('exact')
  })

  it('should return correct result for fraction equivalence', () => {
    const result = validateAnswer('1/2', '0.5', 'numeric')
    expect(result.isCorrect).toBe(true)
    expect(result.matchType).toBe('fraction')
  })

  it('should return incorrect for non-matching answers', () => {
    const result = validateAnswer('5', '6', 'short_answer')
    expect(result.isCorrect).toBe(false)
    expect(result.matchType).toBe('none')
  })

  it('should handle alternate answers', () => {
    const result = validateAnswer('pi', '3.14', 'short_answer', {
      alternates: ['pi', '3.14159']
    })
    expect(result.isCorrect).toBe(true)
    expect(result.matchType).toBe('alternate')
  })
})

describe('parseFraction', () => {
  it('should parse simple fractions', () => {
    expect(parseFraction('1/2')).toBe(0.5)
    expect(parseFraction('3/4')).toBe(0.75)
    expect(parseFraction('2/3')).toBeCloseTo(0.6667, 3)
  })

  it('should parse negative fractions', () => {
    expect(parseFraction('-1/2')).toBe(-0.5)
    expect(parseFraction('-3/4')).toBe(-0.75)
  })

  it('should return null for non-fractions', () => {
    expect(parseFraction('5')).toBe(null)
    expect(parseFraction('abc')).toBe(null)
    expect(parseFraction('x/y')).toBe(null)
  })

  it('should return null for division by zero', () => {
    expect(parseFraction('1/0')).toBe(null)
  })
})

describe('validateFillBlank', () => {
  it('should validate all blanks correctly', () => {
    const result = validateFillBlank(['5', '10'], [
      { value: '5' },
      { value: '10' }
    ])
    expect(result.isCorrect).toBe(true)
    expect(result.blanksCorrect).toBe(2)
    expect(result.blanksTotal).toBe(2)
  })

  it('should handle partial correct answers', () => {
    const result = validateFillBlank(['5', '20'], [
      { value: '5' },
      { value: '10' }
    ])
    expect(result.isCorrect).toBe(false)
    expect(result.blanksCorrect).toBe(1)
    expect(result.blanksTotal).toBe(2)
  })

  it('should use math comparison for blanks', () => {
    const result = validateFillBlank(['1/2'], [
      { value: '0.5' }
    ])
    expect(result.isCorrect).toBe(true)
  })

  it('should handle alternates for blanks', () => {
    const result = validateFillBlank(['pi'], [
      { value: '3.14', alternates: ['pi', '3.14159'] }
    ])
    expect(result.isCorrect).toBe(true)
  })
})

describe('validateMatching', () => {
  it('should validate correct matches', () => {
    const result = validateMatching([0, 1, 2], [0, 1, 2])
    expect(result.isCorrect).toBe(true)
    expect(result.matchesCorrect).toBe(3)
    expect(result.matchesTotal).toBe(3)
  })

  it('should handle partial correct matches', () => {
    const result = validateMatching([0, 2, 1], [0, 1, 2])
    expect(result.isCorrect).toBe(false)
    expect(result.matchesCorrect).toBe(1)
    expect(result.matchesTotal).toBe(3)
  })

  it('should handle completely wrong matches', () => {
    const result = validateMatching([2, 0, 1], [0, 1, 2])
    expect(result.isCorrect).toBe(false)
    expect(result.matchesCorrect).toBe(0)
  })
})

describe('sanitizeAnswerInput', () => {
  it('should handle normal input', () => {
    expect(sanitizeAnswerInput('5')).toBe('5')
    expect(sanitizeAnswerInput('x + 1')).toBe('x + 1')
  })

  it('should remove zero-width characters', () => {
    expect(sanitizeAnswerInput('5\u200B')).toBe('5')
    expect(sanitizeAnswerInput('\uFEFF5')).toBe('5')
  })

  it('should limit input length', () => {
    const longInput = 'a'.repeat(20000)
    const result = sanitizeAnswerInput(longInput)
    expect(result.length).toBe(10000)
  })

  it('should handle empty/null input', () => {
    expect(sanitizeAnswerInput('')).toBe('')
    expect(sanitizeAnswerInput(null as unknown as string)).toBe('')
  })
})

describe('formatMathForDisplay', () => {
  it('should convert Unicode symbols to LaTeX', () => {
    const result = formatMathForDisplay('√4')
    expect(result).toContain('\\sqrt')
  })

  it('should wrap result in LaTeX delimiters', () => {
    const result = formatMathForDisplay('x²')
    expect(result).toContain('\\(')
    expect(result).toContain('\\)')
  })

  it('should preserve already-formatted LaTeX', () => {
    expect(formatMathForDisplay('$5$')).toBe('$5$')
    expect(formatMathForDisplay('\\(x\\)')).toBe('\\(x\\)')
  })

  it('should handle empty input', () => {
    expect(formatMathForDisplay('')).toBe('')
  })
})

describe('math symbol panel symbol normalization', () => {
  // Test that all symbols from math-symbols-panel.tsx normalize correctly
  
  describe('Basic symbols', () => {
    it('should normalize basic operators', () => {
      expect(normalizeMathAnswer('×')).toBe('*')
      expect(normalizeMathAnswer('÷')).toBe('/')
      expect(normalizeMathAnswer('±')).toBe('+-')
    })
  })

  describe('Power symbols', () => {
    it('should normalize power notations', () => {
      expect(normalizeMathAnswer('x^2')).toBe('x^2')
      expect(normalizeMathAnswer('x²')).toBe('x^2')
      expect(normalizeMathAnswer('\\sqrt{x}')).toBe('sqrt(x)')
    })
  })

  describe('Greek letters', () => {
    it('should normalize all Greek letters from panel', () => {
      // From SYMBOL_CATEGORIES Greek section
      expect(normalizeMathAnswer('π')).toBe('pi')
      expect(normalizeMathAnswer('\\pi')).toBe('pi')
      expect(normalizeMathAnswer('θ')).toBe('theta')
      expect(normalizeMathAnswer('\\theta')).toBe('theta')
    })
  })

  describe('Trig functions', () => {
    it('should normalize trig functions', () => {
      expect(normalizeMathAnswer('\\sin(x)')).toBe('sin(x)')
      expect(normalizeMathAnswer('\\cos(x)')).toBe('cos(x)')
      expect(normalizeMathAnswer('\\tan(x)')).toBe('tan(x)')
      expect(normalizeMathAnswer('\\log(x)')).toBe('log(x)')
      expect(normalizeMathAnswer('\\ln(x)')).toBe('ln(x)')
    })
  })

  describe('Calculus symbols', () => {
    it('should normalize calculus symbols', () => {
      expect(normalizeMathAnswer('∫')).toBe('int')
      expect(normalizeMathAnswer('\\int')).toBe('int')
      expect(normalizeMathAnswer('∑')).toBe('sum')
      expect(normalizeMathAnswer('\\sum')).toBe('sum')
      expect(normalizeMathAnswer('∞')).toBe('infinity')
      expect(normalizeMathAnswer('\\infty')).toBe('infinity')
    })
  })

  describe('Set theory symbols', () => {
    it('should normalize set symbols', () => {
      expect(normalizeMathAnswer('∈')).toBe('in')
      expect(normalizeMathAnswer('\\in')).toBe('in')
      expect(normalizeMathAnswer('∪')).toBe('union')
      expect(normalizeMathAnswer('\\cup')).toBe('union')
      expect(normalizeMathAnswer('∅')).toBe('emptyset')
      expect(normalizeMathAnswer('\\emptyset')).toBe('emptyset')
    })
  })
})
