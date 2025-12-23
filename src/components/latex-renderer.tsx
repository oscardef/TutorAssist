'use client'

import { useEffect, useRef, memo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

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

// Escape HTML special characters for safety
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Render mixed content with both text and LaTeX
function renderMixedContent(content: string): string {
  if (!content) return ''

  // Check if content has any LaTeX delimiters at all
  const hasDelimiters = /\\\(|\\\)|\\\[|\\\]|\$\$|\$/.test(content)
  
  if (!hasDelimiters) {
    // No delimiters - just return escaped text
    return escapeHtml(content)
  }

  let result = content
  
  // Handle \[ ... \] display math
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return escapeHtml(match)
    }
  })

  // Handle $$ ... $$ display math
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return escapeHtml(match)
    }
  })

  // Handle \( ... \) inline math
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return escapeHtml(match)
    }
  })

  // Handle $ ... $ inline math (single dollar signs, not escaped)
  // Be careful not to match $$ or escaped \$
  result = result.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return escapeHtml(match)
    }
  })

  return result
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
