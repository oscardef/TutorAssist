import { casEquivalent, looksLikeMath } from '@/lib/grading/cas'
import { gradeParts, parseParts } from '@/lib/parts'
import { casMatchesAny } from '@/lib/grading/cas'

describe('casEquivalent', () => {
  it.each([
    ['-4+6x', '6x-4'],
    ['x^2+2x+1', '(x+1)^2'],
    ['2\\sqrt2', '\\sqrt{8}'],
    ['\\sin^2x+\\cos^2x', '1'],
    ['2=x', 'x=2'],
    ['y-6x+4=0', 'y=6x-4'],
    ['\\frac{1}{x}', 'x^{-1}'],
    ['\\sqrt{2}', 'sqrt(2)'],
    ['\\sin x', 'sin(x)'],
  ])('%s equals %s', (u, c) => expect(casEquivalent(u, c)).toBe(true))

  it.each([
    ['3x', '2x'],
    ['6x-5', '6x-4'],
    ['x+y', '2x'],
  ])('%s does not equal %s', (u, c) => expect(casEquivalent(u, c)).toBe(false))

  it('enforces a required form', () => {
    expect(casEquivalent('x^2-1', '(x-1)(x+1)', 'factorised')).toBe(false)
    expect(casEquivalent('(x+1)(x-1)', '(x-1)(x+1)', 'factorised')).toBe(true)
    expect(casEquivalent('(x-1)(x+1)', 'x^2-1', 'expanded')).toBe(false)
    expect(casEquivalent('0.6667', '\\frac{2}{3}', 'exact')).toBe(false)
  })

  it('leaves words alone', () => {
    expect(looksLikeMath('increasing')).toBe(false)
    expect(casEquivalent('stop', 'pots')).toBeUndefined()
  })
})

describe('multi-part grading with the symbolic check', () => {
  const parts = parseParts([
    { prompt: 'Expand', answer_type: 'expression', correct_answer_json: { value: 'x^2+2x+1', form: 'expanded' }, marks: 2, command_term: 'Expand' },
    { prompt: 'Find', answer_type: 'numeric', correct_answer_json: { value: 0.6667, sigfigs: 3 }, marks: 1 },
  ])!

  it('keeps command terms and answer options', () => {
    expect(parts[0].command_term).toBe('Expand')
    expect(parts[1].correct_answer_json.sigfigs).toBe(3)
  })

  it('accepts equivalent answers in the right form and rounded numbers', () => {
    const g = gradeParts(parts, ['1+2x+x^2', '0.667'], casMatchesAny)
    expect(g.earned).toBe(3)
  })

  it('rejects the wrong form', () => {
    const g = gradeParts(parts, ['(x+1)^2', '0.667'], casMatchesAny)
    expect(g.results[0].correct).toBe(false)
    expect(g.earned).toBe(1)
  })
})
