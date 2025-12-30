'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSearch, SearchConfig } from '@/lib/hooks/use-search'

export interface SearchableSelectOption {
  id: string
  label: string
  description?: string
  group?: string
  disabled?: boolean
  [key: string]: unknown
}

export interface SearchableSelectProps<T extends SearchableSelectOption> {
  /** Available options to select from */
  options: T[]
  /** Currently selected option IDs */
  selected: string[]
  /** Callback when selection changes */
  onChange: (selected: string[]) => void
  /** Placeholder text */
  placeholder?: string
  /** Allow multiple selections */
  multiple?: boolean
  /** Search configuration (keys default to ['label', 'description']) */
  searchConfig?: Partial<SearchConfig<T>>
  /** Custom render for option */
  renderOption?: (option: T, isSelected: boolean) => React.ReactNode
  /** Custom render for selected badge */
  renderBadge?: (option: T) => React.ReactNode
  /** Show clear all button when multiple items selected */
  showClearAll?: boolean
  /** Maximum items to show before scrolling */
  maxDisplayed?: number
  /** Disabled state */
  disabled?: boolean
  /** Class name for container */
  className?: string
  /** Empty state message */
  emptyMessage?: string
  /** Group options by group field */
  groupBy?: boolean
}

export function SearchableSelect<T extends SearchableSelectOption>({
  options,
  selected,
  onChange,
  placeholder = 'Search...',
  multiple = true,
  searchConfig,
  renderOption,
  renderBadge,
  showClearAll = true,
  maxDisplayed = 6,
  disabled = false,
  className = '',
  emptyMessage = 'No results found',
  groupBy = false,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Default search config
  const fullSearchConfig: SearchConfig<T> = useMemo(() => ({
    keys: ['label', 'description', 'group'] as (keyof T)[],
    threshold: 0.3,
    debounceMs: 150,
    ...searchConfig,
  }), [searchConfig])

  const { query, setQuery, results, isSearching, clear } = useSearch(options, fullSearchConfig)

  // Get selected options data
  const selectedOptions = useMemo(() => 
    selected.map(id => options.find(o => o.id === id)).filter(Boolean) as T[],
    [selected, options]
  )

  // Group results if needed
  const groupedResults = useMemo(() => {
    if (!groupBy) return { ungrouped: results }
    
    return results.reduce((acc, option) => {
      const group = option.group || 'Other'
      if (!acc[group]) acc[group] = []
      acc[group].push(option)
      return acc
    }, {} as Record<string, T[]>)
  }, [results, groupBy])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setIsOpen(true)
        setFocusedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < results.length) {
          const selectedId = results[focusedIndex].id
          if (multiple) {
            if (selected.includes(selectedId)) {
              onChange(selected.filter(s => s !== selectedId))
            } else {
              onChange([...selected, selectedId])
            }
          } else {
            onChange([selectedId])
            setIsOpen(false)
          }
          clear()
          inputRef.current?.focus()
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
      case 'Backspace':
        if (query === '' && selected.length > 0) {
          // Remove last selected item
          onChange(selected.slice(0, -1))
        }
        break
    }
  }, [disabled, focusedIndex, results, query, selected, onChange, multiple, clear])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement
      focusedElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  const handleSelect = useCallback((id: string) => {
    if (multiple) {
      if (selected.includes(id)) {
        onChange(selected.filter(s => s !== id))
      } else {
        onChange([...selected, id])
      }
    } else {
      onChange([id])
      setIsOpen(false)
    }
    clear()
    inputRef.current?.focus()
  }, [multiple, selected, onChange, clear])

  const handleRemove = useCallback((id: string) => {
    onChange(selected.filter(s => s !== id))
  }, [selected, onChange])

  const handleClearAll = useCallback(() => {
    onChange([])
    clear()
  }, [onChange, clear])

  const defaultRenderOption = (option: T, isSelected: boolean) => (
    <div className="flex items-center gap-2">
      {multiple && (
        <div className={`w-4 h-4 border rounded flex items-center justify-center ${
          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{option.label}</div>
        {option.description && (
          <div className="text-xs text-gray-500 truncate">{option.description}</div>
        )}
      </div>
    </div>
  )

  const defaultRenderBadge = (option: T) => (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md">
      <span className="truncate max-w-[150px]">{option.label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          handleRemove(option.id)
        }}
        className="hover:text-blue-600"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected items + input */}
      <div
        className={`
          flex flex-wrap gap-1 p-2 border rounded-lg bg-white min-h-[42px]
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'}
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-text'}
        `}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
      >
        {/* Selected badges */}
        {selectedOptions.slice(0, maxDisplayed).map(option => (
          <div key={option.id}>
            {renderBadge ? renderBadge(option) : defaultRenderBadge(option)}
          </div>
        ))}
        
        {/* Overflow indicator */}
        {selectedOptions.length > maxDisplayed && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-md">
            +{selectedOptions.length - maxDisplayed} more
          </span>
        )}

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm disabled:cursor-not-allowed"
        />

        {/* Clear all button */}
        {showClearAll && selected.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleClearAll()
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {isSearching ? emptyMessage : 'Type to search...'}
            </div>
          ) : groupBy ? (
            // Grouped rendering
            Object.entries(groupedResults).map(([group, groupOptions]) => (
              <div key={group}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  {group}
                </div>
                {groupOptions.map((option) => {
                  const isSelected = selected.includes(option.id)
                  const globalIndex = results.indexOf(option)
                  return (
                    <div
                      key={option.id}
                      onClick={() => !option.disabled && handleSelect(option.id)}
                      className={`
                        px-3 py-2 cursor-pointer
                        ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        ${globalIndex === focusedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        ${isSelected && !multiple ? 'bg-blue-50' : ''}
                      `}
                    >
                      {renderOption ? renderOption(option, isSelected) : defaultRenderOption(option, isSelected)}
                    </div>
                  )
                })}
              </div>
            ))
          ) : (
            // Flat rendering
            results.map((option, idx) => {
              const isSelected = selected.includes(option.id)
              return (
                <div
                  key={option.id}
                  onClick={() => !option.disabled && handleSelect(option.id)}
                  className={`
                    px-3 py-2 cursor-pointer
                    ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${idx === focusedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    ${isSelected && !multiple ? 'bg-blue-50' : ''}
                  `}
                >
                  {renderOption ? renderOption(option, isSelected) : defaultRenderOption(option, isSelected)}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
