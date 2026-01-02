'use client'

import { useState, useRef, useEffect } from 'react'

interface MathSymbolsPanelProps {
  onInsert: (symbol: string, latex?: string) => void
  disabled?: boolean
  buttonClassName?: string
}

interface Symbol {
  display: string
  value: string
  latex?: string
}

interface SymbolCategory {
  name: string
  icon: string
  symbols: Symbol[]
}

// Frequently used symbols - most common for quick access
const FREQUENT_SYMBOLS: Symbol[] = [
  { display: 'π', value: 'π', latex: '\\pi' },
  { display: '√', value: '√', latex: '\\sqrt{}' },
  { display: 'x²', value: '^2', latex: '^2' },
  { display: '÷', value: '÷', latex: '\\div' },
  { display: '×', value: '×', latex: '\\times' },
  { display: '≤', value: '≤', latex: '\\leq' },
  { display: '≥', value: '≥', latex: '\\geq' },
  { display: '∫', value: '∫', latex: '\\int' },
]

const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    name: 'Basic',
    icon: '+-',
    symbols: [
      { display: '+', value: '+' },
      { display: '−', value: '-' },
      { display: '×', value: '×', latex: '\\times' },
      { display: '÷', value: '÷', latex: '\\div' },
      { display: '±', value: '±', latex: '\\pm' },
      { display: '=', value: '=' },
      { display: '≠', value: '≠', latex: '\\neq' },
      { display: '<', value: '<' },
      { display: '>', value: '>' },
      { display: '≤', value: '≤', latex: '\\leq' },
      { display: '≥', value: '≥', latex: '\\geq' },
      { display: '≈', value: '≈', latex: '\\approx' },
    ],
  },
  {
    name: 'Fractions',
    icon: '½',
    symbols: [
      { display: '½', value: '1/2' },
      { display: '⅓', value: '1/3' },
      { display: '¼', value: '1/4' },
      { display: '⅔', value: '2/3' },
      { display: '¾', value: '3/4' },
      { display: '⅕', value: '1/5' },
      { display: '⅛', value: '1/8' },
      { display: 'a/b', value: '/', latex: '\\frac{}{}' },
    ],
  },
  {
    name: 'Powers',
    icon: 'xⁿ',
    symbols: [
      { display: 'x²', value: '^2', latex: '^2' },
      { display: 'x³', value: '^3', latex: '^3' },
      { display: 'xⁿ', value: '^', latex: '^{}' },
      { display: '√', value: '√', latex: '\\sqrt{}' },
      { display: '∛', value: '∛', latex: '\\sqrt[3]{}' },
      { display: 'ⁿ√', value: 'root', latex: '\\sqrt[]{}' },
      { display: '10ⁿ', value: '10^', latex: '10^{}' },
      { display: 'eˣ', value: 'e^', latex: 'e^{}' },
    ],
  },
  {
    name: 'Greek',
    icon: 'π',
    symbols: [
      { display: 'π', value: 'π', latex: '\\pi' },
      { display: 'θ', value: 'θ', latex: '\\theta' },
      { display: 'α', value: 'α', latex: '\\alpha' },
      { display: 'β', value: 'β', latex: '\\beta' },
      { display: 'γ', value: 'γ', latex: '\\gamma' },
      { display: 'δ', value: 'δ', latex: '\\delta' },
      { display: 'λ', value: 'λ', latex: '\\lambda' },
      { display: 'σ', value: 'σ', latex: '\\sigma' },
      { display: 'ω', value: 'ω', latex: '\\omega' },
      { display: 'φ', value: 'φ', latex: '\\phi' },
      { display: 'μ', value: 'μ', latex: '\\mu' },
      { display: 'Δ', value: 'Δ', latex: '\\Delta' },
    ],
  },
  {
    name: 'Trig',
    icon: 'sin',
    symbols: [
      { display: 'sin', value: 'sin', latex: '\\sin' },
      { display: 'cos', value: 'cos', latex: '\\cos' },
      { display: 'tan', value: 'tan', latex: '\\tan' },
      { display: 'sec', value: 'sec', latex: '\\sec' },
      { display: 'csc', value: 'csc', latex: '\\csc' },
      { display: 'cot', value: 'cot', latex: '\\cot' },
      { display: 'sin⁻¹', value: 'arcsin', latex: '\\arcsin' },
      { display: 'cos⁻¹', value: 'arccos', latex: '\\arccos' },
      { display: 'tan⁻¹', value: 'arctan', latex: '\\arctan' },
      { display: 'log', value: 'log', latex: '\\log' },
      { display: 'ln', value: 'ln', latex: '\\ln' },
      { display: '|x|', value: '||', latex: '|{}|' },
    ],
  },
  {
    name: 'Calculus',
    icon: '∫',
    symbols: [
      { display: '∫', value: '∫', latex: '\\int' },
      { display: '∬', value: '∬', latex: '\\iint' },
      { display: '∑', value: '∑', latex: '\\sum' },
      { display: '∏', value: '∏', latex: '\\prod' },
      { display: 'lim', value: 'lim', latex: '\\lim' },
      { display: '∞', value: '∞', latex: '\\infty' },
      { display: 'd/dx', value: 'd/dx', latex: '\\frac{d}{dx}' },
      { display: '∂', value: '∂', latex: '\\partial' },
      { display: '∇', value: '∇', latex: '\\nabla' },
      { display: 'dx', value: 'dx', latex: 'dx' },
      { display: '→', value: '→', latex: '\\to' },
      { display: '°', value: '°', latex: '^{\\circ}' },
    ],
  },
  {
    name: 'Brackets',
    icon: '( )',
    symbols: [
      { display: '(', value: '(' },
      { display: ')', value: ')' },
      { display: '[', value: '[' },
      { display: ']', value: ']' },
      { display: '{', value: '{', latex: '\\{' },
      { display: '}', value: '}', latex: '\\}' },
      { display: '⟨', value: '⟨', latex: '\\langle' },
      { display: '⟩', value: '⟩', latex: '\\rangle' },
    ],
  },
  {
    name: 'Sets',
    icon: '∈',
    symbols: [
      { display: '∈', value: '∈', latex: '\\in' },
      { display: '∉', value: '∉', latex: '\\notin' },
      { display: '⊂', value: '⊂', latex: '\\subset' },
      { display: '⊃', value: '⊃', latex: '\\supset' },
      { display: '⊆', value: '⊆', latex: '\\subseteq' },
      { display: '∪', value: '∪', latex: '\\cup' },
      { display: '∩', value: '∩', latex: '\\cap' },
      { display: '∅', value: '∅', latex: '\\emptyset' },
      { display: 'ℝ', value: 'ℝ', latex: '\\mathbb{R}' },
      { display: 'ℤ', value: 'ℤ', latex: '\\mathbb{Z}' },
      { display: 'ℕ', value: 'ℕ', latex: '\\mathbb{N}' },
      { display: 'ℂ', value: 'ℂ', latex: '\\mathbb{C}' },
    ],
  },
  {
    name: 'Matrices',
    icon: '[ ]',
    symbols: [
      { display: '[a b]', value: 'matrix', latex: '\\begin{bmatrix}a & b\\end{bmatrix}' },
      { display: '[2×2]', value: 'matrix2x2', latex: '\\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix}' },
      { display: '|det|', value: 'det', latex: '\\det' },
      { display: 'A⁻¹', value: '^{-1}', latex: '^{-1}' },
      { display: 'Aᵀ', value: '^T', latex: '^{T}' },
      { display: '·', value: '·', latex: '\\cdot' },
      { display: '⊗', value: '⊗', latex: '\\otimes' },
      { display: '→', value: '→', latex: '\\vec{}' },
    ],
  },
]

export default function MathSymbolsPanel({ onInsert, disabled = false, buttonClassName = '' }: MathSymbolsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Update panel position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPanelPosition({
        top: rect.top - 8, // 8px margin above button
        left: Math.max(8, rect.right - 320), // Align right edge with button, min 8px from left
      })
    }
  }, [isOpen])

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        panelRef.current && 
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSymbolClick = (symbol: Symbol) => {
    onInsert(symbol.value, symbol.latex)
    // Keep panel open for multiple insertions
  }

  // Handle button click - prevent propagation to avoid MathLive focus issues
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  if (disabled) return null

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus stealing from MathLive
        className={`flex items-center justify-center h-full px-3 border-l border-gray-200 transition-all ${
          isOpen 
            ? 'bg-blue-50 text-blue-600' 
            : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        } ${buttonClassName}`}
        title="Math symbols (Σ)"
        aria-label="Open math symbols panel"
      >
        <span className="text-lg font-serif">Σ</span>
      </button>

      {isOpen && (
        <div 
          ref={panelRef}
          className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 w-[320px]"
          style={{ 
            zIndex: 9999,
            top: panelPosition.top,
            left: panelPosition.left,
            transform: 'translateY(-100%)',
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent focus stealing
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <span className="text-sm font-medium">Math Symbols</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick Access Section */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Quick Access</div>
            <div className="flex gap-1 flex-wrap">
              {FREQUENT_SYMBOLS.map((symbol, idx) => (
                <button
                  key={`freq-${idx}`}
                  onClick={() => handleSymbolClick(symbol)}
                  className="w-8 h-8 flex items-center justify-center text-sm rounded-md hover:bg-blue-100 hover:text-blue-600 transition-colors bg-white border border-gray-200 hover:border-blue-300 shadow-sm"
                  title={symbol.latex || symbol.value}
                >
                  {symbol.display}
                </button>
              ))}
            </div>
          </div>

          {/* Category tabs - horizontal scroll */}
          <div className="flex gap-0.5 px-2 py-1.5 border-b border-gray-100 overflow-x-auto">
            {SYMBOL_CATEGORIES.map((category, idx) => (
              <button
                key={category.name}
                onClick={() => setActiveCategory(idx)}
                className={`px-2 py-1 text-xs font-medium rounded transition-all whitespace-nowrap ${
                  activeCategory === idx
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={category.name}
              >
                {category.icon}
              </button>
            ))}
          </div>

          {/* Category name label */}
          <div className="px-2 pt-1.5 pb-0.5">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{SYMBOL_CATEGORIES[activeCategory].name}</div>
          </div>

          {/* Symbols grid */}
          <div className="p-2 pt-1 max-h-[180px] overflow-y-auto">
            <div className="grid grid-cols-6 gap-0.5">
              {SYMBOL_CATEGORIES[activeCategory].symbols.map((symbol, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSymbolClick(symbol)}
                  className="h-9 flex items-center justify-center text-base rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  title={symbol.latex || symbol.value}
                >
                  {symbol.display}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Export for use in tests
export { SYMBOL_CATEGORIES, FREQUENT_SYMBOLS }
export type { Symbol, SymbolCategory }
