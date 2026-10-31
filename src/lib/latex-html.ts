import katex from 'katex'

/**
 * Text with LaTeX in \( \), \[ \], $ $ or $$ $$ turned into HTML. Text
 * outside the delimiters is always escaped; maths goes through KaTeX with
 * `trust` left off, so commands like \href or \htmlData can't inject
 * markup either. Content can come from any workspace through the shared
 * library, and student answers are shown to tutors, so treat it as hostile.
 */

export function escapeHtml(text: string): string {
  if (typeof text !== 'string') text = String(text ?? '')
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// One pass over all four delimiter styles, in order of appearance.
// Groups: 1 \[ \]  2 $$ $$  3 \( \)  4 $ $ (not \$, not part of $$)
const MATH = /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|(?<![\\$])\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g

function renderMath(latex: string, displayMode: boolean, original: string): string {
  try {
    return katex.renderToString(latex.trim(), { displayMode, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 500 })
  } catch {
    return escapeHtml(original)
  }
}

export function renderMixedContent(content: unknown): string {
  if (content === null || content === undefined || content === '') return ''
  const text = typeof content === 'string' ? content : String(content)
  let out = ''
  let last = 0
  for (const m of text.matchAll(MATH)) {
    const start = m.index ?? 0
    out += escapeHtml(text.slice(last, start))
    const display = m[1] !== undefined || m[2] !== undefined
    out += renderMath(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '', display, m[0])
    last = start + m[0].length
  }
  return out + escapeHtml(text.slice(last))
}

/**
 * Student answers arrive from the maths input as bare LaTeX ("\frac{2}{3}",
 * "\text{North}"). Wrap them in inline delimiters so LatexRenderer typesets
 * them; plain text and already-delimited content pass through unchanged.
 */
export function asMath(answer: string | null | undefined): string {
  const s = (answer ?? '').trim()
  if (!s || /\$|\\\(|\\\[/.test(s)) return s
  return /\\[a-zA-Z]+|[\^_{}]/.test(s) ? `$${s}$` : s
}
