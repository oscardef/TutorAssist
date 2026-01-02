'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import MathSymbolsPanel from './math-symbols-panel'

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
      onInsertSymbol,
      className 
    }: { 
      value: string
      onChange: (v: string) => void
      disabled?: boolean
      placeholder?: string
      onSubmit?: () => void
      onInsertSymbol?: (ref: React.RefObject<HTMLElement | null>) => void
      className?: string
    }) {
      const mathFieldRef = useRef<HTMLElement>(null)
      const [isReady, setIsReady] = useState(false)

      // Expose the ref for symbol insertion
      useEffect(() => {
        if (onInsertSymbol && isReady) {
          onInsertSymbol(mathFieldRef)
        }
      }, [onInsertSymbol, isReady])

      useEffect(() => {
        const mf = mathFieldRef.current as unknown as {
          value: string
          disabled: boolean
          addEventListener: (event: string, handler: (e: Event) => void) => void
          removeEventListener: (event: string, handler: (e: Event) => void) => void
          setOptions: (options: Record<string, unknown>) => void
          executeCommand: (command: string | string[]) => void
        }
        if (!mf) return

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
        
        // Wait a tick for MathLive to fully initialize to avoid ariaLiveText error
        const initTimer = setTimeout(() => {
          try {
            mf.value = value
            mf.disabled = disabled || false
            setIsReady(true)
            
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
              
              // Disable virtual keyboard - use symbol panel instead
              virtualKeyboardMode: 'off',
              
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
                'phi': { mode: 'math', value: '\\phi' },
                'mu': { mode: 'math', value: '\\mu' },
                
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
                'partial': { mode: 'math', value: '\\partial' },
                
                // Trig functions
                'sin': { mode: 'math', value: '\\sin' },
                'cos': { mode: 'math', value: '\\cos' },
                'tan': { mode: 'math', value: '\\tan' },
                'sec': { mode: 'math', value: '\\sec' },
                'csc': { mode: 'math', value: '\\csc' },
                'cot': { mode: 'math', value: '\\cot' },
                'arcsin': { mode: 'math', value: '\\arcsin' },
                'arccos': { mode: 'math', value: '\\arccos' },
                'arctan': { mode: 'math', value: '\\arctan' },
                'log': { mode: 'math', value: '\\log' },
                'ln': { mode: 'math', value: '\\ln' },
              },
            })

            mf.addEventListener('input', handleInput)
            mf.addEventListener('keydown', handleKeyDown)
          } catch {
            // MathLive not ready yet, will retry on next render
          }
        }, 50)
        
        return () => {
          clearTimeout(initTimer)
          try {
            mf.removeEventListener('input', handleInput)
            mf.removeEventListener('keydown', handleKeyDown)
          } catch {
            // Cleanup may fail if MathLive wasn't initialized
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
            border: 'none',
            borderRadius: '0',
            outline: 'none',
            minHeight: '56px',
            background: 'transparent',
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
  onSubmit?: () => void
  status?: 'correct' | 'incorrect'
}

export function MathInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type your answer...',
  className = '',
  onSubmit,
  status,
}: MathInputProps) {
  const [useFallback, setUseFallback] = useState(false)
  const fallbackInputRef = useRef<HTMLInputElement>(null)
  const mathFieldRefHolder = useRef<React.RefObject<HTMLElement | null> | null>(null)

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

  // Handle symbol insertion from the panel
  const handleInsertSymbol = useCallback((symbolValue: string, latex?: string) => {
    if (useFallback) {
      // For fallback text input
      const input = fallbackInputRef.current
      if (!input) {
        onChange(value + symbolValue)
        return
      }
      const start = input.selectionStart || value.length
      const end = input.selectionEnd || value.length
      const newValue = value.slice(0, start) + symbolValue + value.slice(end)
      onChange(newValue)
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(start + symbolValue.length, start + symbolValue.length)
      }, 0)
    } else {
      // For MathLive - insert LaTeX if available, otherwise use value
      const mathField = mathFieldRefHolder.current?.current as unknown as {
        insert: (text: string) => void
        focus: () => void
      }
      if (mathField) {
        const insertText = latex || symbolValue
        mathField.insert(insertText)
        mathField.focus()
      }
    }
  }, [useFallback, value, onChange])

  // Fallback text input key handler
  const handleFallbackKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
    // Convert * to × automatically
    if (e.key === '*') {
      e.preventDefault()
      handleInsertSymbol('×')
    }
  }, [onSubmit, handleInsertSymbol])

  // Get border class based on status
  const getStatusClass = () => {
    if (status === 'correct') return 'mathlive-correct'
    if (status === 'incorrect') return 'mathlive-incorrect'
    return ''
  }

  return (
    <div className={`relative ${className}`}>
      {useFallback ? (
        <div className={`flex rounded-xl border-2 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100
          ${status === 'correct' ? 'border-green-500 bg-green-50' : 
            status === 'incorrect' ? 'border-red-500 bg-red-50' : 
            'border-gray-200'}
          ${disabled ? 'bg-gray-50' : 'bg-white'}`}>
          <input
            ref={fallbackInputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleFallbackKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={`flex-1 px-4 py-3 text-lg bg-transparent focus:outline-none min-w-0
              ${disabled ? 'text-gray-500' : ''}`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {/* Symbol panel button - appended to input */}
          <MathSymbolsPanel 
            onInsert={handleInsertSymbol}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className={`mathlive-wrapper ${getStatusClass()} ${disabled ? 'mathlive-disabled' : ''}`}>
          <div className="flex rounded-xl border-2 border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex-1 min-w-0">
              <MathLiveComponent
                value={value}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
                onSubmit={onSubmit}
                onInsertSymbol={(ref) => { mathFieldRefHolder.current = ref }}
                className={`mathlive-field ${status ? `mathlive-${status}` : ''}`}
              />
            </div>
            {/* Symbol panel button - appended to input */}
            <MathSymbolsPanel 
              onInsert={handleInsertSymbol}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Style overrides for MathLive */}
      <style jsx global>{`
        .mathlive-wrapper math-field {
          --hue: 212;
          --keyboard-zindex: 1000;
        }
        .mathlive-correct > div {
          border-color: #22c55e !important;
          background-color: #f0fdf4 !important;
        }
        .mathlive-incorrect > div {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        .mathlive-disabled > div {
          background-color: #f9fafb !important;
        }
        .mathlive-disabled math-field {
          opacity: 0.7;
        }
        /* Hide all formatting/styling options */
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
