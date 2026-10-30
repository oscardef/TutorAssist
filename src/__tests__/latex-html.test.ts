import { renderMixedContent } from '@/lib/latex-html'

describe('renderMixedContent', () => {
  it('escapes text outside maths, with or without delimiters', () => {
    expect(renderMixedContent('<img src=x onerror=alert(1)>')).not.toContain('<img')
    const mixed = renderMixedContent('Solve \\(x+1=2\\) <img src=x onerror=alert(1)> and <script>alert(2)</script>')
    expect(mixed).not.toMatch(/<img|<script/)
    expect(mixed).toContain('&lt;img')
    expect(mixed).toContain('katex')
  })

  it('does not let KaTeX commands inject links or attributes', () => {
    const html = renderMixedContent('\\(\\href{javascript:alert(1)}{x}\\) \\(\\htmlData{foo=bar}{y}\\)')
    // KaTeX shows them as errors; the source only survives as inert annotation text
    expect(html).not.toMatch(/<a\s|href=/)
    expect(html).not.toContain('data-foo')
  })

  it('renders every delimiter style and keeps < inside maths', () => {
    const html = renderMixedContent('a \\(x<3\\) b $y$ c $$z$$ d \\[w\\]')
    expect((html.match(/class="katex"/g) || []).length).toBe(4)
    expect(html).toContain('a ')
    expect(html).toContain(' d ')
  })

  it('leaves escaped dollars as text', () => {
    expect(renderMixedContent('costs \\$5 and \\$6')).not.toContain('katex')
  })
})
