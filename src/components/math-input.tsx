'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import LatexRenderer from './latex-renderer'

// Dynamic import of MathLive to avoid SSR issues
const MathLiveComponent = dynamic(
  () => import('mathlive').then((MathLive) => {
    // Configure MathLive globally for student use
    MathLive.MathfieldElement.fontsDirectory = 'https://unpkg.com/mathlive/dist/fonts/'
    MathLive.MathfieldElement.soundsDirectory = null // Disable sounds
    
    // Return a component that renders the math-field
    return function MathFieldWrapper({ 
      value, 
      onChange, 
      disabled, 
      onSubmit,
      className 
    }: { 
      value: string
      onChange: (v: string) => void
      disabled?: boolean
      placeholder?: string
      onSubmit?: () => void
      className?: string
    }) {
      const mathFieldRef = useRef<HTMLElement>(null)

      useEffect(() => {
        const mf = mathFieldRef.current as unknown as {
          value: string
          disabled: boolean
          addEventListener: (event: string, handler: (e: Event) => void) => void
          removeEventListener: (event: string, handler: (e: Event) => void) => void
          setOptions: (options: Record<string, unknown>) => void
          executeCommand: (command: string | string[]) => void
        }
        if (mf) {
          mf.value = value
          mf.disabled = disabled || false
          
          // Configure MathLive with simplified settings for students
          mf.setOptions({
            // Smart input features
            smartMode: true,
            smartSuperscript: true,
            smartFence: true,
            removeExtraneousParentheses: true,
            mathModeSpace: '\\:',
            
            // Disable sounds
            keypressSound: null,
            plonkSound: null,
            
            // Virtual keyboard - simplified, no color/style options
            virtualKeyboardMode: 'manual',
            virtualKeyboardTheme: 'apple',
            // Only show basic keyboards - NO formatting options
            virtualKeyboards: 'numeric symbols',
            
            // Disable all the formatting/style toolbars
            virtualKeyboardToolbar: 'none',
            
            // Menu bar settings - disable styling options
            menuItems: [],
            
            // Inline shortcuts that trigger on space
            inlineShortcuts: {
              // Greek letters commonly used
              'pi': { mode: 'math', value: '\\pi' },
              'theta': { mode: 'math', value: '\\theta' },
              'alpha': { mode: 'math', value: '\\alpha' },
              'beta': { mode: 'math', value: '\\beta' },
              'gamma': { mode: 'math', value: '\\gamma' },
              'delta': { mode: 'math', value: '\\delta' },
              'sigma': { mode: 'math', value: '\\sigma' },
              'omega': { mode: 'math', value: '\\omega' },
              'lambda': { mode: 'math', value: '\\lambda' },
              
              // Square roots
              'sqrt': { mode: 'math', value: '\\sqrt{#@}' },
              'cbrt': { mode: 'math', value: '\\sqrt[3]{#@}' },
              
              // Fractions
              'frac': { mode: 'math', value: '\\frac{#@}{#?}' },
              
              // Common symbols
              'inf': { mode: 'math', value: '\\infty' },
              'infinity': { mode: 'math', value: '\\infty' },
              'pm': { mode: 'math', value: '\\pm' },
              'deg': { mode: 'math', value: '^{\\circ}' },
              
              // Comparison operators
              '<=': { mode: 'math', value: '\\le' },
              '>=': { mode: 'math', value: '\\ge' },
              '!=': { mode: 'math', value: '\\ne' },
              'approx': { mode: 'math', value: '\\approx' },
              
              // Calculus
              'int': { mode: 'math', value: '\\int' },
              'sum': { mode: 'math', value: '\\sum' },
              'lim': { mode: 'math', value: '\\lim' },
              
              // Trig functions
              'sin': { mode: 'math', value: '\\sin' },
              'cos': { mode: 'math', value: '\\cos' },
              'tan': { mode: 'math', value: '\\tan' },
              'log': { mode: 'math', value: '\\log' },
              'ln': { mode: 'math', value: '\\ln' },
            },
          })

          const handleInput = (e: Event) => {
            const target = e.target as unknown as { value: string }
            onChange(target.value)
          }

          const handleKeyDown = (e: Event) => {
            const ke = e as KeyboardEvent
            if (ke.key === 'Enter' && onSubmit) {
              ke.preventDefault()
              onSubmit()
            }
          }

          mf.addEventListener('input', handleInput)
          mf.addEventListener('keydown', handleKeyDown)

          return () => {
            mf.removeEventListener('input', handleInput)
            mf.removeEventListener('keydown', handleKeyDown)
          }
        }
      }, [value, disabled, onChange, onSubmit])

      return (
        <math-field 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={mathFieldRef as any}
          className={className}
          style={{
            width: '100%',
            fontSize: '1.25rem',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '2px solid #e5e7eb',
            outline: 'none',
            minHeight: '56px',
          }}
        />
      )
    }
  }),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-14 bg-gray-100 animate-pulse rounded-xl" />
    )
  }
)

interface MathInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  showPreview?: boolean  // Now defaults to true for better UX
  answerType?: 'numeric' | 'expression' | 'short_answer' | 'exact'
  onSubmit?: () => void
  status?: 'correct' | 'incorrect'
}

export function MathInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type your answer...',
  className = '',
  showPreview = true,  // Default to true for better student experience
  onSubmit,
  status,
}: MathInputProps) {
  const [useFallback, setUseFallback] = useState(false)
  const fallbackInputRef = useRef<HTMLInputElement>(null)

  // Check if MathLive loaded properly
  useEffect(() => {
    // Give MathLive a moment to load, then check
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && !customElements.get('math-field')) {
        setUseFallback(true)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Fallback text input with symbol buttons
  const FallbackInput = () => {
    // Essential symbols for middle/high school math
    const QUICK_SYMBOLS = [
      // Basic operations
      { symbol: '×', label: 'times', category: 'basic' },
      { symbol: '÷', label: 'divide', category: 'basic' },
      { symbol: '±', label: 'plus-minus', category: 'basic' },
      // Fractions and powers
      { symbol: '/', label: 'fraction', category: 'basic' },
      { symbol: '^', label: 'power/exponent', category: 'basic' },
      { symbol: '√', label: 'square root', category: 'basic' },
      { symbol: '∛', label: 'cube root', category: 'basic' },
      // Parentheses
      { symbol: '(', label: 'open parenthesis', category: 'bracket' },
      { symbol: ')', label: 'close parenthesis', category: 'bracket' },
      // Comparisons
      { symbol: '≤', label: 'less than or equal', category: 'compare' },
      { symbol: '≥', label: 'greater than or equal', category: 'compare' },
      { symbol: '≠', label: 'not equal', category: 'compare' },
      { symbol: '≈', label: 'approximately', category: 'compare' },
      // Constants
      { symbol: 'π', label: 'pi', category: 'constant' },
      { symbol: '∞', label: 'infinity', category: 'constant' },
      { symbol: '°', label: 'degree', category: 'constant' },
    ]

    const insertSymbol = useCallback((symbol: string) => {
      const input = fallbackInputRef.current
      if (!input) {
        onChange(value + symbol)
        return
      }
      const start = input.selectionStart || value.length
      const end = input.selectionEnd || value.length
      const newValue = value.slice(0, start) + symbol + value.slice(end)
      onChange(newValue)
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(start + symbol.length, start + symbol.length)
      }, 0)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSubmit) {
        e.preventDefault()
        onSubmit()
      }
      if (e.key === '*') {
        e.preventDefault()
        insertSymbol('×')
      }
    }

    return (
      <div>
        <input
          ref={fallbackInputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full px-4 py-3 text-lg border-2 rounded-xl focus:outline-none transition-all
            ${status === 'correct' ? 'border-green-500 bg-green-50' : 
              status === 'incorrect' ? 'border-red-500 bg-red-50' : 
              'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}
            ${disabled ? 'bg-gray-50 text-gray-500' : ''}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {!disabled && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {QUICK_SYMBOLS.map(({ symbol, label }) => (
              <button
                key={symbol}
                type="button"
                onClick={() => insertSymbol(symbol)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700 font-medium"
                title={label}
              >
                {symbol}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Get border class based on status
  const getStatusClass = () => {
    if (status === 'correct') return 'mathlive-correct'
    if (status === 'incorrect') return 'mathlive-incorrect'
    return ''
  }

  return (
    <div className={`relative ${className}`}>
      {useFallback ? (
        <FallbackInput />
      ) : (
        <div className={`mathlive-wrapper ${getStatusClass()} ${disabled ? 'mathlive-disabled' : ''}`}>
          <MathLiveComponent
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            onSubmit={onSubmit}
            className={`mathlive-field ${status ? `mathlive-${status}` : ''}`}
          />
          
          {/* Input tips - more comprehensive */}
          {!disabled && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500">
                💡 <strong>Input tips:</strong> Type <code className="bg-gray-100 px-1 rounded">sqrt</code> for √, <code className="bg-gray-100 px-1 rounded">^</code> for powers (x^2), <code className="bg-gray-100 px-1 rounded">/</code> for fractions, <code className="bg-gray-100 px-1 rounded">pi</code> for π
              </p>
              <p className="text-xs text-green-600">
                ✓ <strong>Accepted formats:</strong> Fractions (1/2), decimals (0.5), mixed numbers (1 1/2), percentages (50%), scientific notation (3e2)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview (optional) */}
      {showPreview && value && !disabled && (
        <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-blue-600">Preview:</span>
            <span className="text-gray-800 text-lg">
              <LatexRenderer content={value} />
            </span>
          </div>
        </div>
      )}

      {/* Style overrides for MathLive */}
      <style jsx global>{`
        .mathlive-wrapper math-field {
          --hue: 212;
          --keyboard-zindex: 1000;
        }
        .mathlive-wrapper math-field:focus-within {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
        }
        .mathlive-correct math-field {
          border-color: #22c55e !important;
          background-color: #f0fdf4 !important;
        }
        .mathlive-incorrect math-field {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        .mathlive-disabled math-field {
          background-color: #f9fafb !important;
          opacity: 0.7;
        }
        /* Make the virtual keyboard more visible */
        .ML__keyboard {
          --keyboard-background: white !important;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15) !important;
          border-top: 1px solid #e5e7eb !important;
        }
        /* Hide all formatting/styling options */
        .ML__keyboard .MLK__toolbar,
        .ML__keyboard [data-command="applyStyle"],
        .ML__keyboard [data-command="backgroundColor"],
        .ML__keyboard [data-command="color"],
        .ML__keyboard .MLK__toolbar button[data-command*="color"],
        .ML__keyboard .MLK__toolbar button[data-command*="style"],
        .ML__keyboard .MLK__toolbar button[data-command*="font"],
        .ML__popover,
        math-field::part(menu-toggle),
        math-field::part(virtual-keyboard-toggle) {
          display: none !important;
        }
        /* Hide context menu styling options */
        .ML__menu [data-command*="color"],
        .ML__menu [data-command*="font"],
        .ML__menu [data-command*="style"],
        .ML__menu [data-command*="backgroundColor"] {
          display: none !important;
        }
      `}</style>
    </div>
  )
}

export default MathInput
