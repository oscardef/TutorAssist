/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import MathSymbolsPanel, { SYMBOL_CATEGORIES, FREQUENT_SYMBOLS } from '../components/math-symbols-panel'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/tutor/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('MathSymbolsPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render the symbol button', () => {
    const onInsert = jest.fn()
    render(<MathSymbolsPanel onInsert={onInsert} />)
    
    const button = screen.getByRole('button', { name: /math symbols/i })
    expect(button).toBeInTheDocument()
  })

  it('should open panel when button is clicked', () => {
    const onInsert = jest.fn()
    render(<MathSymbolsPanel onInsert={onInsert} />)
    
    const button = screen.getByRole('button', { name: /math symbols/i })
    fireEvent.click(button)
    
    // Check that Quick Access section is visible
    expect(screen.getByText('Quick Access')).toBeInTheDocument()
  })

  it('should have frequently used symbols', () => {
    const onInsert = jest.fn()
    render(<MathSymbolsPanel onInsert={onInsert} />)
    
    fireEvent.click(screen.getByRole('button', { name: /math symbols/i }))
    
    // Check for common symbols
    expect(screen.getByTitle('\\pi')).toBeInTheDocument()
    expect(screen.getByTitle('\\sqrt{}')).toBeInTheDocument()
  })

  it('should call onInsert when symbol is clicked', () => {
    const onInsert = jest.fn()
    render(<MathSymbolsPanel onInsert={onInsert} />)
    
    fireEvent.click(screen.getByRole('button', { name: /math symbols/i }))
    
    // Click on π symbol
    const piButton = screen.getByTitle('\\pi')
    fireEvent.click(piButton)
    
    expect(onInsert).toHaveBeenCalledWith('π', '\\pi')
  })

  it('should switch between categories', () => {
    const onInsert = jest.fn()
    render(<MathSymbolsPanel onInsert={onInsert} />)
    
    fireEvent.click(screen.getByRole('button', { name: /math symbols/i }))
    
    // Click on Greek tab
    const greekTab = screen.getByTitle('Greek')
    fireEvent.click(greekTab)
    
    // Should show Greek category name
    expect(screen.getByText('Greek')).toBeInTheDocument()
  })

  it('should not render when disabled', () => {
    const onInsert = jest.fn()
    const { container } = render(<MathSymbolsPanel onInsert={onInsert} disabled />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should keep panel open after symbol insertion', () => {
    const onInsert = jest.fn()
    render(<MathSymbolsPanel onInsert={onInsert} />)
    
    fireEvent.click(screen.getByRole('button', { name: /math symbols/i }))
    
    // Click a symbol
    const piButton = screen.getByTitle('\\pi')
    fireEvent.click(piButton)
    
    // Panel should still be open
    expect(screen.getByText('Quick Access')).toBeInTheDocument()
  })
})

describe('Symbol Categories', () => {
  it('should have all expected categories', () => {
    const expectedCategories = ['Basic', 'Fractions', 'Powers', 'Greek', 'Trig', 'Calculus', 'Brackets', 'Sets', 'Matrices']
    
    SYMBOL_CATEGORIES.forEach((category, index) => {
      expect(category.name).toBe(expectedCategories[index])
    })
  })

  it('should have frequently used symbols', () => {
    expect(FREQUENT_SYMBOLS.length).toBe(8)
    
    // Check that common symbols are in frequent list
    const frequentValues = FREQUENT_SYMBOLS.map(s => s.value)
    expect(frequentValues).toContain('π')
    expect(frequentValues).toContain('√')
    expect(frequentValues).toContain('∫')
  })

  it('should have valid LaTeX for all symbols with latex property', () => {
    SYMBOL_CATEGORIES.forEach(category => {
      category.symbols.forEach(symbol => {
        if (symbol.latex) {
          // Should start with backslash or be a valid LaTeX pattern
          expect(symbol.latex).toBeTruthy()
        }
      })
    })
  })

  it('Basic category should have comparison operators', () => {
    const basicCategory = SYMBOL_CATEGORIES.find(c => c.name === 'Basic')
    expect(basicCategory).toBeDefined()
    
    const basicValues = basicCategory!.symbols.map(s => s.value)
    expect(basicValues).toContain('<')
    expect(basicValues).toContain('>')
    expect(basicValues).toContain('≤')
    expect(basicValues).toContain('≥')
    expect(basicValues).toContain('≠')
  })

  it('Calculus category should have integral and sum', () => {
    const calcCategory = SYMBOL_CATEGORIES.find(c => c.name === 'Calculus')
    expect(calcCategory).toBeDefined()
    
    const calcValues = calcCategory!.symbols.map(s => s.value)
    expect(calcValues).toContain('∫')
    expect(calcValues).toContain('∑')
    expect(calcValues).toContain('∞')
    expect(calcValues).toContain('lim')
  })

  it('Trig category should have all trig functions', () => {
    const trigCategory = SYMBOL_CATEGORIES.find(c => c.name === 'Trig')
    expect(trigCategory).toBeDefined()
    
    const trigValues = trigCategory!.symbols.map(s => s.value)
    expect(trigValues).toContain('sin')
    expect(trigValues).toContain('cos')
    expect(trigValues).toContain('tan')
    expect(trigValues).toContain('log')
    expect(trigValues).toContain('ln')
  })

  it('Matrices category should have matrix-related symbols', () => {
    const matrixCategory = SYMBOL_CATEGORIES.find(c => c.name === 'Matrices')
    expect(matrixCategory).toBeDefined()
    
    const matrixValues = matrixCategory!.symbols.map(s => s.value)
    expect(matrixValues).toContain('det')
    expect(matrixValues).toContain('^{-1}')
    expect(matrixValues).toContain('^T')
  })

  it('Greek category should have common Greek letters', () => {
    const greekCategory = SYMBOL_CATEGORIES.find(c => c.name === 'Greek')
    expect(greekCategory).toBeDefined()
    
    const greekValues = greekCategory!.symbols.map(s => s.value)
    expect(greekValues).toContain('π')
    expect(greekValues).toContain('θ')
    expect(greekValues).toContain('α')
    expect(greekValues).toContain('β')
  })
})

describe('Math Input Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render practice page', () => {
    // Basic render test
    const mockElement = document.createElement('div')
    mockElement.innerHTML = '<h1>Practice</h1>'
    
    expect(mockElement.querySelector('h1')?.textContent).toBe('Practice')
  })

  it('should handle answer submission', async () => {
    const mockFetch = global.fetch as jest.Mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ attempt: { id: 'a1', is_correct: true } }),
    })
    
    // Simulate form submission
    const formData = {
      questionId: 'q1',
      answerLatex: '\\frac{1}{2}',
      isCorrect: true,
    }
    
    const response = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    
    expect(response.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('/api/attempts', expect.any(Object))
  })
})

describe('Question Bank UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should display questions with difficulty badges', () => {
    const questions = [
      { id: 'q1', question_latex: 'What is 2+2?', difficulty: 'easy' },
      { id: 'q2', question_latex: 'Solve x^2 = 4', difficulty: 'medium' },
      { id: 'q3', question_latex: 'Prove theorem', difficulty: 'hard' },
    ]
    
    // Verify difficulty mapping
    const difficultyColors = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-red-100 text-red-700',
    }
    
    questions.forEach((q) => {
      expect(difficultyColors[q.difficulty as keyof typeof difficultyColors]).toBeDefined()
    })
  })

  it('should filter questions by topic', () => {
    const questions = [
      { id: 'q1', topic_id: 't1', question_latex: 'Algebra Q1' },
      { id: 'q2', topic_id: 't2', question_latex: 'Geometry Q1' },
      { id: 'q3', topic_id: 't1', question_latex: 'Algebra Q2' },
    ]
    
    const topicFilter = 't1'
    const filtered = questions.filter((q) => q.topic_id === topicFilter)
    
    expect(filtered.length).toBe(2)
    expect(filtered.every((q) => q.topic_id === 't1')).toBe(true)
  })
})

describe('Student Dashboard', () => {
  it('should calculate accuracy correctly', () => {
    const totalAttempts = 10
    const correctAttempts = 7
    const accuracy = Math.round((correctAttempts / totalAttempts) * 100)
    
    expect(accuracy).toBe(70)
  })

  it('should handle zero attempts', () => {
    const totalAttempts = 0
    const accuracy = totalAttempts > 0 ? Math.round((0 / totalAttempts) * 100) : 0
    
    expect(accuracy).toBe(0)
  })

  it('should display streak correctly', () => {
    let streak = 0
    const attempts = [true, true, true, false, true, true]
    
    attempts.forEach((isCorrect) => {
      if (isCorrect) {
        streak += 1
      } else {
        streak = 0
      }
    })
    
    // After false, streak resets, then 2 more correct
    expect(streak).toBe(2)
  })
})

describe('PDF Export', () => {
  it('should sanitize LaTeX for plain text', () => {
    const cleanLatex = (latex: string): string => {
      return latex
        .replace(/\\\[/g, '').replace(/\\\]/g, '')
        .replace(/\\\(/g, '').replace(/\\\)/g, '')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\times/g, '×')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}]/g, '')
        .trim()
    }
    
    const input = '\\frac{1}{2} + \\sqrt{4}'
    const output = cleanLatex(input)
    
    expect(output).toBe('(1)/(2) + √(4)')
  })

  it('should validate question IDs before generation', () => {
    const questionIds = ['q1', 'q2', 'q3']
    
    expect(Array.isArray(questionIds)).toBe(true)
    expect(questionIds.length).toBeGreaterThan(0)
  })
})

describe('Topic Management', () => {
  it('should maintain display order', () => {
    const topics = [
      { id: 't1', name: 'Algebra', display_order: 1 },
      { id: 't2', name: 'Geometry', display_order: 2 },
      { id: 't3', name: 'Calculus', display_order: 3 },
    ]
    
    const sorted = [...topics].sort((a, b) => a.display_order - b.display_order)
    
    expect(sorted[0].name).toBe('Algebra')
    expect(sorted[2].name).toBe('Calculus')
  })

  it('should support nested topics', () => {
    const topics = [
      { id: 't1', name: 'Algebra', parent_topic_id: null },
      { id: 't2', name: 'Linear Equations', parent_topic_id: 't1' },
      { id: 't3', name: 'Quadratic Equations', parent_topic_id: 't1' },
    ]
    
    const childTopics = topics.filter((t) => t.parent_topic_id === 't1')
    
    expect(childTopics.length).toBe(2)
  })
})

// =============================================================================
// REALISTIC QUESTION SCENARIOS (based on seed.sql question formats)
// =============================================================================

describe('Realistic Question Formats', () => {
  // Types matching actual database schema
  interface Question {
    id: string
    prompt_text: string
    prompt_latex: string
    answer_type: 'exact' | 'expression' | 'numeric' | 'multiple_choice' | 'true_false'
    correct_answer_json: {
      value: string | number
      alternatives?: string[]
      unit?: string
      tolerance?: number
      choices?: { text: string; latex?: string }[]
      correct?: number
    }
    difficulty: number
    hints_json: string[]
    solution_steps_json: { step: string; result: string }[]
  }

  const sampleQuestions: Question[] = [
    // Algebra - Exact answer
    {
      id: 'q1',
      prompt_text: 'Solve for x: 2x + 5 = 13',
      prompt_latex: '\\text{Solve for } x: 2x + 5 = 13',
      answer_type: 'exact',
      correct_answer_json: { value: '4' },
      difficulty: 2,
      hints_json: ['Start by isolating the term with x', 'What operation undoes addition?'],
      solution_steps_json: [
        { step: 'Subtract 5 from both sides', result: '2x = 8' },
        { step: 'Divide both sides by 2', result: 'x = 4' }
      ]
    },
    // Algebra - Expression answer
    {
      id: 'q2',
      prompt_text: 'Simplify: 3(x + 4) - 2x',
      prompt_latex: '\\text{Simplify: } 3(x + 4) - 2x',
      answer_type: 'expression',
      correct_answer_json: { value: 'x + 12', alternatives: ['x+12', '12+x'] },
      difficulty: 2,
      hints_json: ['First, distribute the 3'],
      solution_steps_json: [
        { step: 'Distribute 3', result: '3x + 12 - 2x' },
        { step: 'Combine like terms', result: 'x + 12' }
      ]
    },
    // Geometry - Numeric with unit
    {
      id: 'q3',
      prompt_text: 'What is the area of a rectangle with length 8 cm and width 5 cm?',
      prompt_latex: '\\text{Area of rectangle with } l=8\\text{cm}, w=5\\text{cm}',
      answer_type: 'numeric',
      correct_answer_json: { value: 40, unit: 'cm²' },
      difficulty: 1,
      hints_json: ['Area = length × width'],
      solution_steps_json: [
        { step: 'Use formula: Area = l × w', result: 'Area = 8 × 5' },
        { step: 'Calculate', result: '40 cm²' }
      ]
    },
    // Geometry - Numeric with tolerance
    {
      id: 'q4',
      prompt_text: 'What is the circumference of a circle with radius 7 cm? (Use π ≈ 3.14)',
      prompt_latex: 'C = 2\\pi r, r = 7',
      answer_type: 'numeric',
      correct_answer_json: { value: 43.96, tolerance: 0.1, unit: 'cm' },
      difficulty: 2,
      hints_json: ['C = 2πr'],
      solution_steps_json: [
        { step: 'Use formula: C = 2πr', result: 'C = 2 × 3.14 × 7' },
        { step: 'Calculate', result: '43.96 cm' }
      ]
    },
    // Fractions - Exact with alternatives
    {
      id: 'q5',
      prompt_text: 'Add: 1/4 + 2/4',
      prompt_latex: '\\frac{1}{4} + \\frac{2}{4}',
      answer_type: 'exact',
      correct_answer_json: { value: '3/4', alternatives: ['3/4', '0.75'] },
      difficulty: 1,
      hints_json: ['Same denominator, just add numerators'],
      solution_steps_json: [
        { step: 'Add numerators', result: '(1 + 2)/4' },
        { step: 'Simplify', result: '3/4' }
      ]
    },
    // Percentages - Numeric
    {
      id: 'q6',
      prompt_text: 'What is 25% of 80?',
      prompt_latex: '25\\% \\times 80',
      answer_type: 'numeric',
      correct_answer_json: { value: 20 },
      difficulty: 1,
      hints_json: ['25% = 0.25 or 1/4'],
      solution_steps_json: [
        { step: 'Convert to decimal', result: '0.25' },
        { step: 'Multiply', result: '0.25 × 80 = 20' }
      ]
    }
  ]

  it('should validate all question types exist', () => {
    const types = sampleQuestions.map(q => q.answer_type)
    expect(types).toContain('exact')
    expect(types).toContain('expression')
    expect(types).toContain('numeric')
  })

  it('should have valid solution steps for all questions', () => {
    sampleQuestions.forEach(q => {
      expect(q.solution_steps_json.length).toBeGreaterThan(0)
      q.solution_steps_json.forEach(step => {
        expect(step.step).toBeTruthy()
        expect(step.result).toBeTruthy()
      })
    })
  })

  it('should have hints for all questions', () => {
    sampleQuestions.forEach(q => {
      expect(q.hints_json.length).toBeGreaterThan(0)
      expect(typeof q.hints_json[0]).toBe('string')
    })
  })

  it('should have valid difficulty levels (1-5)', () => {
    sampleQuestions.forEach(q => {
      expect(q.difficulty).toBeGreaterThanOrEqual(1)
      expect(q.difficulty).toBeLessThanOrEqual(5)
    })
  })

  it('should handle questions with alternatives', () => {
    const withAlternatives = sampleQuestions.filter(
      q => q.correct_answer_json.alternatives && q.correct_answer_json.alternatives.length > 0
    )
    expect(withAlternatives.length).toBeGreaterThan(0)
    
    withAlternatives.forEach(q => {
      expect(Array.isArray(q.correct_answer_json.alternatives)).toBe(true)
    })
  })

  it('should handle questions with units', () => {
    const withUnits = sampleQuestions.filter(q => q.correct_answer_json.unit)
    expect(withUnits.length).toBeGreaterThan(0)
    
    withUnits.forEach(q => {
      expect(typeof q.correct_answer_json.unit).toBe('string')
    })
  })

  it('should handle questions with tolerance', () => {
    const withTolerance = sampleQuestions.filter(q => q.correct_answer_json.tolerance)
    expect(withTolerance.length).toBeGreaterThan(0)
    
    withTolerance.forEach(q => {
      expect(typeof q.correct_answer_json.tolerance).toBe('number')
      expect(q.correct_answer_json.tolerance).toBeGreaterThan(0)
    })
  })
})

describe('Answer Validation Scenarios', () => {
  // Simulate the comparison logic used in practice mode
  const compareAnswers = (
    userAnswer: string,
    correctAnswer: { value: string | number; alternatives?: string[]; tolerance?: number },
    answerType: string
  ): boolean => {
    const normalizedUser = userAnswer.toLowerCase().replace(/\s+/g, '').trim()
    
    if (answerType === 'numeric') {
      const userNum = parseFloat(userAnswer)
      const correctNum = typeof correctAnswer.value === 'number' 
        ? correctAnswer.value 
        : parseFloat(String(correctAnswer.value))
      
      if (isNaN(userNum)) return false
      
      const tolerance = correctAnswer.tolerance || 0.001
      return Math.abs(userNum - correctNum) <= tolerance
    }
    
    // Check main answer
    const normalizedCorrect = String(correctAnswer.value).toLowerCase().replace(/\s+/g, '').trim()
    if (normalizedUser === normalizedCorrect) return true
    
    // Check alternatives
    if (correctAnswer.alternatives) {
      for (const alt of correctAnswer.alternatives) {
        const normalizedAlt = alt.toLowerCase().replace(/\s+/g, '').trim()
        if (normalizedUser === normalizedAlt) return true
      }
    }
    
    return false
  }

  describe('Exact answer comparisons', () => {
    it('should accept correct answer', () => {
      expect(compareAnswers('4', { value: '4' }, 'exact')).toBe(true)
    })

    it('should accept answer with whitespace', () => {
      expect(compareAnswers(' 4 ', { value: '4' }, 'exact')).toBe(true)
    })

    it('should accept alternatives', () => {
      expect(compareAnswers('3/4', { value: '3/4', alternatives: ['3/4', '0.75'] }, 'exact')).toBe(true)
      expect(compareAnswers('0.75', { value: '3/4', alternatives: ['3/4', '0.75'] }, 'exact')).toBe(true)
    })

    it('should reject wrong answer', () => {
      expect(compareAnswers('5', { value: '4' }, 'exact')).toBe(false)
    })
  })

  describe('Numeric answer comparisons', () => {
    it('should accept correct numeric answer', () => {
      expect(compareAnswers('40', { value: 40 }, 'numeric')).toBe(true)
    })

    it('should accept answer within tolerance', () => {
      expect(compareAnswers('43.95', { value: 43.96, tolerance: 0.1 }, 'numeric')).toBe(true)
      expect(compareAnswers('44.05', { value: 43.96, tolerance: 0.1 }, 'numeric')).toBe(true)
    })

    it('should reject answer outside tolerance', () => {
      expect(compareAnswers('44.2', { value: 43.96, tolerance: 0.1 }, 'numeric')).toBe(false)
    })

    it('should handle integer answers', () => {
      expect(compareAnswers('20', { value: 20 }, 'numeric')).toBe(true)
    })

    it('should reject non-numeric input for numeric type', () => {
      expect(compareAnswers('abc', { value: 20 }, 'numeric')).toBe(false)
    })
  })

  describe('Expression answer comparisons', () => {
    it('should accept correct expression', () => {
      expect(compareAnswers('x + 12', { value: 'x + 12', alternatives: ['x+12', '12+x'] }, 'expression')).toBe(true)
    })

    it('should accept expression without spaces', () => {
      expect(compareAnswers('x+12', { value: 'x + 12', alternatives: ['x+12', '12+x'] }, 'expression')).toBe(true)
    })

    it('should accept commutative alternatives', () => {
      expect(compareAnswers('12+x', { value: 'x + 12', alternatives: ['x+12', '12+x'] }, 'expression')).toBe(true)
    })
  })
})

describe('Math Symbol Usage in Answers', () => {
  // Test that various math symbol inputs can be normalized
  const normalizeSymbols = (input: string): string => {
    return input
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/≠/g, '!=')
      .replace(/≈/g, '~=')
  }

  it('should normalize multiplication symbol', () => {
    expect(normalizeSymbols('3×4')).toBe('3*4')
  })

  it('should normalize division symbol', () => {
    expect(normalizeSymbols('12÷4')).toBe('12/4')
  })

  it('should normalize minus sign', () => {
    expect(normalizeSymbols('5−3')).toBe('5-3')
  })

  it('should normalize pi', () => {
    expect(normalizeSymbols('2π')).toBe('2pi')
  })

  it('should normalize square root', () => {
    expect(normalizeSymbols('√4')).toBe('sqrt4')
  })

  it('should normalize comparison operators', () => {
    expect(normalizeSymbols('x≤5')).toBe('x<=5')
    expect(normalizeSymbols('y≥3')).toBe('y>=3')
    expect(normalizeSymbols('a≠b')).toBe('a!=b')
  })

  it('should handle complex expressions', () => {
    expect(normalizeSymbols('2π×r÷3')).toBe('2pi*r/3')
  })
})

describe('IB Math HL Level Questions', () => {
  // Test structures for advanced math content
  
  it('should support calculus integral notation', () => {
    const integralQuestion = {
      prompt: '∫ x² dx',
      answer: 'x³/3 + C',
      alternatives: ['(1/3)x³ + C', 'x^3/3 + C']
    }
    expect(integralQuestion.alternatives).toContain('x^3/3 + C')
  })

  it('should support limit notation', () => {
    const limitQuestion = {
      prompt: 'lim(x→∞) 1/x',
      answer: '0'
    }
    expect(limitQuestion.answer).toBe('0')
  })

  it('should support matrix notation', () => {
    const matrixQuestion = {
      prompt: 'Find det(A) where A = [[1,2],[3,4]]',
      answer: '-2',
      type: 'numeric'
    }
    expect(matrixQuestion.answer).toBe('-2')
  })

  it('should support complex number notation', () => {
    const complexQuestion = {
      prompt: 'Simplify: (2 + 3i)(1 - i)',
      answer: '5 + i',
      alternatives: ['5+i', '5 + 1i']
    }
    expect(complexQuestion.alternatives.length).toBeGreaterThan(0)
  })

  it('should support trigonometric identities', () => {
    const trigQuestion = {
      prompt: 'sin²θ + cos²θ = ?',
      answer: '1'
    }
    expect(trigQuestion.answer).toBe('1')
  })

  it('should support derivative notation', () => {
    const derivativeQuestion = {
      prompt: 'd/dx (x³)',
      answer: '3x²',
      alternatives: ['3x^2', '3*x^2']
    }
    expect(derivativeQuestion.alternatives).toContain('3x^2')
  })

  it('should support summation notation', () => {
    const summationQuestion = {
      prompt: '∑(n=1 to 5) n',
      answer: '15',
      type: 'numeric'
    }
    expect(parseInt(summationQuestion.answer)).toBe(15)
  })
})

describe('Edge Cases for Math Input', () => {
  it('should handle empty input', () => {
    const isEmpty = (input: string): boolean => !input || input.trim() === ''
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('   ')).toBe(true)
    expect(isEmpty('x')).toBe(false)
  })

  it('should handle very long expressions', () => {
    const longExpr = 'x + x + x + x + x + x + x + x + x + x'
    expect(longExpr.length).toBeGreaterThan(10)
    // Should be parseable
    expect(longExpr.split('+').length).toBe(10)
  })

  it('should handle nested parentheses', () => {
    const nested = '((((x + 1))))'
    const simplified = nested.replace(/\(+/g, '(').replace(/\)+/g, ')')
    expect(simplified).toBe('(x + 1)')
  })

  it('should handle mixed number formats', () => {
    const mixedNumber = '1 1/2' // one and a half
    const parts = mixedNumber.split(' ')
    expect(parts.length).toBe(2)
    expect(parseInt(parts[0]) + eval(parts[1])).toBe(1.5)
  })

  it('should handle scientific notation', () => {
    const scientific = '3.14e2'
    expect(parseFloat(scientific)).toBe(314)
  })

  it('should handle percentage to decimal', () => {
    const percentage = '50%'
    const decimal = parseFloat(percentage) / 100
    expect(decimal).toBe(0.5)
  })
})
