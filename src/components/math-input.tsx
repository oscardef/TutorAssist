'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import LatexRenderer from './latex-renderer'

// Dynamic import of MathLive to avoid SSR issues
const MathLiveComponent = dynamic(
  () => import('mathlive').then(() => {
    // Return a component that renders the math-field
    return function MathFieldWrapper({ 
      value, 
      onChange, 
      disabled, 
      placeholder,
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
          mathModeSpace: string
          smartMode: boolean
          smartSuperscript: boolean
          inlineShortcuts: Record<string, string>
          addEventListener: (event: string, handler: (e: Event) => void) => void
          removeEventListener: (event: string, handler: (e: Event) => void) => void
        }
        if (mf) {
          mf.value = value
          mf.disabled = disabled || false
          mf.mathModeSpace = '\\:'
          mf.smartMode = true
          mf.smartSuperscript = true
          mf.inlineShortcuts = {
            'pi': '\\pi',
            'theta': '\\theta',
            'alpha': '\\alpha',
            'beta': '\\beta',
            'gamma': '\\gamma',
            'delta': '\\delta',
            'sqrt': '\\sqrt{#0}',
            'inf': '\\infty',
            '<=': '\\le',
            '>=': '\\ge',
            '!=': '\\ne',
          }

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
        // @ts-expect-error - math-field is a custom element from MathLive
        <math-field 
          ref={mathFieldRef}
          class={className}
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
  showPreview?: boolean
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
  showPreview = false,
  answerType = 'expression',
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
    const QUICK_SYMBOLS = [
      { symbol: '×', label: 'times' },
      { symbol: '÷', label: 'divide' },
      { symbol: '√', label: 'sqrt' },
      { symbol: 'π', label: 'pi' },
      { symbol: '^', label: 'power' },
      { symbol: '/', label: 'fraction' },
      { symbol: '(', label: 'open' },
      { symbol: ')', label: 'close' },
      { symbol: '≤', label: 'leq' },
      { symbol: '≥', label: 'geq' },
      { symbol: '≠', label: 'neq' },
      { symbol: '∞', label: 'infinity' },
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
          
          {/* Virtual keyboard hint */}
          {!disabled && (
            <p className="text-xs text-gray-500 mt-2">
              💡 Use the keyboard buttons or type naturally. Press Enter to submit.
            </p>
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
      `}</style>
    </div>
  )
}

export default MathInput
