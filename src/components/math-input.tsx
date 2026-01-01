'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import LatexRenderer from './latex-renderer'

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

// Math symbol shortcuts that can be typed
const SHORTCUTS: Record<string, string> = {
  'pi': 'π',
  'sqrt': '√',
  'theta': 'θ',
  'alpha': 'α',
  'beta': 'β',
  'gamma': 'γ',
  'delta': 'δ',
  'inf': '∞',
  '<=': '≤',
  '>=': '≥',
  '!=': '≠',
  '+-': '±',
  '...': '…',
}

// Quick insert symbols organized by category
const QUICK_SYMBOLS = [
  { symbol: '×', label: 'times' },
  { symbol: '÷', label: 'divide' },
  { symbol: '√', label: 'sqrt' },
  { symbol: 'π', label: 'pi' },
  { symbol: '^', label: 'power' },
  { symbol: '/', label: 'fraction' },
  { symbol: '(', label: 'open' },
  { symbol: ')', label: 'close' },
]

const EXTENDED_SYMBOLS = [
  { group: 'Operations', symbols: ['+', '−', '×', '÷', '±', '=', '≠', '<', '>', '≤', '≥'] },
  { group: 'Powers & Roots', symbols: ['^2', '^3', '^', '√', '∛'] },
  { group: 'Greek', symbols: ['π', 'θ', 'α', 'β', 'γ', 'δ', 'σ', 'λ', 'φ', 'ω'] },
  { group: 'Fractions', symbols: ['½', '⅓', '¼', '⅔', '¾'] },
  { group: 'Calculus', symbols: ['∞', '∫', '∑', '∏', '∂', '∇'] },
  { group: 'Sets', symbols: ['∈', '∉', '⊂', '⊃', '∪', '∩', '∅'] },
]

export function MathInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Type your answer...',
  className = '',
  showPreview = true,
  answerType = 'expression',
  onSubmit,
  status,
}: MathInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSymbolPicker, setShowSymbolPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Handle clicking outside to close symbol picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowSymbolPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Insert symbol at cursor position
  const insertSymbol = useCallback((symbol: string) => {
    const input = inputRef.current
    if (!input) {
      onChange(value + symbol)
      return
    }

    const start = input.selectionStart || value.length
    const end = input.selectionEnd || value.length
    const newValue = value.slice(0, start) + symbol + value.slice(end)
    onChange(newValue)
    
    // Set cursor position after the inserted symbol
    const newPosition = start + symbol.length
    
    // Focus input after insertion
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(newPosition, newPosition)
    }, 0)
  }, [value, onChange])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Submit on Enter
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit()
      return
    }

    // Allow common math symbols with keyboard shortcuts
    if (e.key === '*') {
      e.preventDefault()
      insertSymbol('×')
    }
  }

  // Auto-replace shortcuts as user types
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value
    
    // Check for shortcuts
    for (const [shortcut, replacement] of Object.entries(SHORTCUTS)) {
      if (newValue.endsWith(shortcut)) {
        newValue = newValue.slice(0, -shortcut.length) + replacement
        break
      }
    }
    
    onChange(newValue)
  }

  // Format value for display
  const formatForDisplay = (text: string) => {
    if (!text) return text
    return text
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
  }

  // Get placeholder based on answer type
  const getPlaceholder = () => {
    if (placeholder !== 'Type your answer...') return placeholder
    switch (answerType) {
      case 'numeric':
        return 'Enter a number (e.g., 3.14, -5, 1/2)'
      case 'expression':
        return 'Type your answer (e.g., 2x+1, √2, π)'
      default:
        return 'Type your answer'
    }
  }

  // Get input border class based on status
  const getInputBorderClass = () => {
    if (status === 'correct') return 'border-green-500 bg-green-50'
    if (status === 'incorrect') return 'border-red-500 bg-red-50'
    return 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Input Row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={getPlaceholder()}
            className={`w-full px-4 py-3 text-lg border-2 rounded-xl 
                     focus:outline-none
                     disabled:bg-gray-50 disabled:text-gray-500
                     transition-all duration-200 ${getInputBorderClass()}`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          
          {/* Clear button */}
          {value && !disabled && (
            <button
              onClick={() => {
                onChange('')
                inputRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 
                       hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              type="button"
              tabIndex={-1}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Symbol Picker Button */}
        {!disabled && (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setShowSymbolPicker(!showSymbolPicker)}
              className={`h-full px-4 border-2 rounded-xl flex items-center gap-2 transition-all
                ${showSymbolPicker 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                }`}
            >
              <span className="text-lg font-medium">∑</span>
              <svg className={`w-4 h-4 transition-transform ${showSymbolPicker ? 'rotate-180' : ''}`} 
                   fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Extended Symbol Picker Dropdown */}
            {showSymbolPicker && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl 
                            border border-gray-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-3">
                  {EXTENDED_SYMBOLS.map((group) => (
                    <div key={group.group}>
                      <div className="text-xs font-medium text-gray-500 mb-1.5">{group.group}</div>
                      <div className="flex flex-wrap gap-1">
                        {group.symbols.map((symbol) => (
                          <button
                            key={symbol}
                            type="button"
                            onClick={() => {
                              insertSymbol(symbol)
                              setShowSymbolPicker(false)
                            }}
                            className="w-9 h-9 flex items-center justify-center text-lg 
                                     rounded-lg border border-gray-200 hover:border-blue-400 
                                     hover:bg-blue-50 transition-all"
                          >
                            {symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Tips */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    💡 Type shortcuts: <code className="bg-gray-100 px-1 rounded">pi</code> → π, 
                    <code className="bg-gray-100 px-1 rounded ml-1">sqrt</code> → √,
                    <code className="bg-gray-100 px-1 rounded ml-1">*</code> → ×
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Symbols Row */}
      {!disabled && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {QUICK_SYMBOLS.map(({ symbol, label }) => (
            <button
              key={symbol}
              type="button"
              onClick={() => insertSymbol(symbol)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 
                       rounded-lg transition-colors text-gray-700 font-medium"
              title={label}
            >
              {symbol}
            </button>
          ))}
        </div>
      )}

      {/* Live Preview */}
      {showPreview && value && !disabled && (
        <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-blue-600">Preview:</span>
            <span className="text-gray-800 text-lg">
              <LatexRenderer content={formatForDisplay(value)} />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default MathInput
