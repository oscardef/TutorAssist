'use client'

import { useEffect, useRef, memo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { renderMixedContent } from '@/lib/latex-html'

interface LatexRendererProps {
  content: string
  className?: string
  displayMode?: boolean
}

// Renders text with inline LaTeX expressions
// Supports both \( ... \) and $ ... $ delimiters for inline math
// Supports \[ ... \] and $$ ... $$ for display math
// Does NOT auto-detect - requires proper delimiters to prevent text being treated as math
function LatexRendererComponent({ content, className = '' }: LatexRendererProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!containerRef.current || !content) return

    try {
      // Process the content to render LaTeX
      const rendered = renderMixedContent(content)
      containerRef.current.innerHTML = rendered
    } catch (error) {
      console.error('LaTeX rendering error:', error)
      // Fallback to plain text
      if (containerRef.current) {
        containerRef.current.textContent = content
      }
    }
  }, [content])

  return <span ref={containerRef} className={className} />
}

// Pure LaTeX renderer (content is all LaTeX, no mixed text)
export function PureLatex({ latex, displayMode = false, className = '' }: { latex: string; displayMode?: boolean; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!containerRef.current || !latex) return

    try {
      katex.render(latex, containerRef.current, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: false,
      })
    } catch (error) {
      console.error('LaTeX rendering error:', error)
      if (containerRef.current) {
        containerRef.current.textContent = latex
      }
    }
  }, [latex, displayMode])

  return <span ref={containerRef} className={className} />
}

export const LatexRenderer = memo(LatexRendererComponent)
export default LatexRenderer


export { asMath } from '@/lib/latex-html'
