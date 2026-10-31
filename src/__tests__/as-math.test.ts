import { asMath } from '@/lib/latex-html'

describe('asMath', () => {
  it('wraps bare LaTeX from the maths input', () => {
    expect(asMath('\\text{North}')).toBe('$\\text{North}$')
    expect(asMath('\\frac{2}{3}')).toBe('$\\frac{2}{3}$')
    expect(asMath('x^2+1')).toBe('$x^2+1$')
  })

  it('leaves plain text and delimited content alone', () => {
    expect(asMath('Northeast')).toBe('Northeast')
    expect(asMath('42')).toBe('42')
    expect(asMath('$x^2$')).toBe('$x^2$')
    expect(asMath('\\(x\\)')).toBe('\\(x\\)')
  })

  it('handles empty answers', () => {
    expect(asMath(null)).toBe('')
    expect(asMath('  ')).toBe('')
  })
})
