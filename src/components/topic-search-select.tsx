'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSearch } from '@/lib/hooks/use-search'

export interface TopicOption {
  id: string
  name: string
  description: string | null
  program?: { id: string; code: string; name: string } | null
  grade_level?: { id: string; code: string; name: string } | null
  questionCount?: number
}

interface TopicSearchSelectProps {
  topics: TopicOption[]
  selectedTopics: string[]
  onChange: (selected: string[]) => void
  multiple?: boolean
  placeholder?: string
  showQuestionCount?: boolean
  maxDisplayed?: number
  className?: string
  disabled?: boolean
  emptyMessage?: string
}

export function TopicSearchSelect({
  topics,
  selectedTopics,
  onChange,
  multiple = true,
  placeholder = 'Search topics...',
  showQuestionCount = false,
  maxDisplayed = 6,
  className = '',
  disabled = false,
  emptyMessage = 'No topics found',
}: TopicSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { query, setQuery, results, clear } = useSearch(topics, {
    keys: ['name', 'description', 'program.name', 'program.code', 'grade_level.name', 'grade_level.code'],
    threshold: 0.3,
    debounceMs: 150,
  })

  // Get selected topics data
  const selectedTopicsData = useMemo(() => 
    selectedTopics.map(id => topics.find(t => t.id === id)).filter(Boolean) as TopicOption[],
    [selectedTopics, topics]
  )

  // Group results by program
  const groupedResults = useMemo(() => {
    const groups: Record<string, TopicOption[]> = {}
    
    results.forEach(topic => {
      const group = topic.program?.name || 'Other'
      if (!groups[group]) groups[group] = []
      groups[group].push(topic)
    })
    
    return groups
  }, [results])

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
          handleSelect(results[focusedIndex].id)
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
      case 'Backspace':
        if (query === '' && selectedTopics.length > 0) {
          onChange(selectedTopics.slice(0, -1))
        }
        break
    }
  }, [disabled, focusedIndex, results, query, selectedTopics, onChange])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-topic-item]')
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  const handleSelect = useCallback((id: string) => {
    if (multiple) {
      if (selectedTopics.includes(id)) {
        onChange(selectedTopics.filter(t => t !== id))
      } else {
        onChange([...selectedTopics, id])
      }
    } else {
      onChange([id])
      setIsOpen(false)
    }
    clear()
    inputRef.current?.focus()
  }, [multiple, selectedTopics, onChange, clear])

  const handleRemove = useCallback((id: string) => {
    onChange(selectedTopics.filter(t => t !== id))
  }, [selectedTopics, onChange])

  const handleClearAll = useCallback(() => {
    onChange([])
    clear()
  }, [onChange, clear])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected topics + input */}
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
        {selectedTopicsData.slice(0, maxDisplayed).map(topic => (
          <span 
            key={topic.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
          >
            <span className="truncate max-w-[150px]">{topic.name}</span>
            {topic.program && (
              <span className="text-xs text-blue-600">({topic.program.code})</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove(topic.id)
              }}
              className="hover:text-blue-600 ml-0.5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        
        {/* Overflow indicator */}
        {selectedTopicsData.length > maxDisplayed && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-md">
            +{selectedTopicsData.length - maxDisplayed} more
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
          placeholder={selectedTopics.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm disabled:cursor-not-allowed"
        />

        {/* Clear all button */}
        {selectedTopics.length > 1 && (
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
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {query ? emptyMessage : 'Type to search topics...'}
            </div>
          ) : (
            Object.entries(groupedResults).map(([group, groupTopics]) => (
              <div key={group}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  {group}
                </div>
                {groupTopics.map((topic, idx) => {
                  const isSelected = selectedTopics.includes(topic.id)
                  const globalIndex = results.indexOf(topic)
                  return (
                    <div
                      key={topic.id}
                      data-topic-item
                      onClick={() => handleSelect(topic.id)}
                      className={`
                        px-3 py-2 cursor-pointer
                        ${globalIndex === focusedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        ${isSelected && !multiple ? 'bg-blue-50' : ''}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        {multiple && (
                          <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{topic.name}</span>
                            {topic.grade_level && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {topic.grade_level.code}
                              </span>
                            )}
                          </div>
                          {topic.description && (
                            <div className="text-xs text-gray-500 truncate mt-0.5">{topic.description}</div>
                          )}
                          {showQuestionCount && topic.questionCount !== undefined && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {topic.questionCount} question{topic.questionCount !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default TopicSearchSelect
