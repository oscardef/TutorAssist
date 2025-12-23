'use client'

import { useState, useRef, useEffect } from 'react'

interface MathSymbolsPanelProps {
  onInsert: (symbol: string) => void
}

interface SymbolCategory {
  name: string
  symbols: { display: string; value: string; latex?: string }[]
}

const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    name: 'Basic',
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
    ],
  },
  {
    name: 'Fractions',
    symbols: [
      { display: '½', value: '1/2' },
      { display: '⅓', value: '1/3' },
      { display: '¼', value: '1/4' },
      { display: '⅔', value: '2/3' },
      { display: '¾', value: '3/4' },
      { display: '⅕', value: '1/5' },
      { display: 'a/b', value: '/', latex: '\\frac{a}{b}' },
    ],
  },
  {
    name: 'Powers & Roots',
    symbols: [
      { display: 'x²', value: '^2' },
      { display: 'x³', value: '^3' },
      { display: 'xⁿ', value: '^' },
      { display: '√', value: '√', latex: '\\sqrt{}' },
      { display: '∛', value: '∛', latex: '\\sqrt[3]{}' },
      { display: 'ⁿ√', value: 'root' },
    ],
  },
  {
    name: 'Greek',
    symbols: [
      { display: 'π', value: 'π', latex: '\\pi' },
      { display: 'θ', value: 'θ', latex: '\\theta' },
      { display: 'α', value: 'α', latex: '\\alpha' },
      { display: 'β', value: 'β', latex: '\\beta' },
      { display: 'γ', value: 'γ', latex: '\\gamma' },
      { display: 'δ', value: 'δ', latex: '\\delta' },
      { display: 'σ', value: 'σ', latex: '\\sigma' },
      { display: 'λ', value: 'λ', latex: '\\lambda' },
    ],
  },
  {
    name: 'Calculus',
    symbols: [
      { display: '∞', value: '∞', latex: '\\infty' },
      { display: '∫', value: '∫', latex: '\\int' },
      { display: '∑', value: '∑', latex: '\\sum' },
      { display: '∏', value: '∏', latex: '\\prod' },
      { display: 'lim', value: 'lim', latex: '\\lim' },
      { display: 'd/dx', value: 'd/dx' },
      { display: '∂', value: '∂', latex: '\\partial' },
      { display: '∇', value: '∇', latex: '\\nabla' },
    ],
  },
  {
    name: 'Functions',
    symbols: [
      { display: 'sin', value: 'sin' },
      { display: 'cos', value: 'cos' },
      { display: 'tan', value: 'tan' },
      { display: 'log', value: 'log' },
      { display: 'ln', value: 'ln' },
      { display: 'eˣ', value: 'e^' },
      { display: '|x|', value: '||', latex: '|x|' },
    ],
  },
  {
    name: 'Sets',
    symbols: [
      { display: '∈', value: '∈', latex: '\\in' },
      { display: '∉', value: '∉', latex: '\\notin' },
      { display: '⊂', value: '⊂', latex: '\\subset' },
      { display: '⊃', value: '⊃', latex: '\\supset' },
      { display: '∪', value: '∪', latex: '\\cup' },
      { display: '∩', value: '∩', latex: '\\cap' },
      { display: '∅', value: '∅', latex: '\\emptyset' },
    ],
  },
  {
    name: 'Parentheses',
    symbols: [
      { display: '( )', value: '()' },
      { display: '[ ]', value: '[]' },
      { display: '{ }', value: '{}' },
      { display: '⟨ ⟩', value: '⟨⟩', latex: '\\langle \\rangle' },
    ],
  },
]

export default function MathSymbolsPanel({ onInsert }: MathSymbolsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
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

  const handleSymbolClick = (symbol: { display: string; value: string; latex?: string }) => {
    onInsert(symbol.value)
    // Keep panel open for multiple insertions
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg border transition-colors ${
          isOpen 
            ? 'bg-blue-50 border-blue-300 text-blue-600' 
            : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
        }`}
        title="Math symbols"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.745 3A23.933 23.933 0 0 0 3 12c0 3.183.62 6.22 1.745 9M19.5 3c.967 2.78 1.5 5.817 1.5 9s-.533 6.22-1.5 9M8.25 8.885l1.444-.89a.75.75 0 0 1 1.105.402l2.402 7.206a.75.75 0 0 0 1.104.401l1.445-.889m-8.25.75.213.09a1.687 1.687 0 0 0 2.062-.617l4.45-6.676a1.688 1.688 0 0 1 2.062-.618l.213.09" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-80">
          {/* Category tabs */}
          <div className="flex overflow-x-auto border-b border-gray-200 p-1 gap-1">
            {SYMBOL_CATEGORIES.map((category, idx) => (
              <button
                key={category.name}
                onClick={() => setActiveCategory(idx)}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  activeCategory === idx
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Symbols grid */}
          <div className="p-3">
            <div className="grid grid-cols-6 gap-1">
              {SYMBOL_CATEGORIES[activeCategory].symbols.map((symbol, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSymbolClick(symbol)}
                  className="w-10 h-10 flex items-center justify-center text-lg rounded hover:bg-blue-50 hover:text-blue-600 transition-colors border border-transparent hover:border-blue-200"
                  title={symbol.latex || symbol.value}
                >
                  {symbol.display}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
            Click a symbol to insert • Type normally for text
          </div>
        </div>
      )}
    </div>
  )
}
