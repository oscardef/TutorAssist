'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSearch } from '@/lib/hooks/use-search'

export interface StudentOption {
  id: string
  name: string
  email: string | null
  program?: { id: string; code: string; name: string } | null
  grade_level?: { id: string; code: string; name: string } | null
}

interface StudentSearchSelectProps {
  students: StudentOption[]
  selectedStudents: string[]
  onChange: (selected: string[]) => void
  multiple?: boolean
  placeholder?: string
  maxDisplayed?: number
  className?: string
  disabled?: boolean
  emptyMessage?: string
  allowSelectAll?: boolean
}

export function StudentSearchSelect({
  students,
  selectedStudents,
  onChange,
  multiple = true,
  placeholder = 'Search students...',
  maxDisplayed = 6,
  className = '',
  disabled = false,
  emptyMessage = 'No students found',
  allowSelectAll = true,
}: StudentSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { query, setQuery, results, clear } = useSearch(students, {
    keys: ['name', 'email', 'program.name', 'program.code', 'grade_level.name', 'grade_level.code'],
    threshold: 0.3,
    debounceMs: 150,
  })

  // Get selected students data
  const selectedStudentsData = useMemo(() => 
    selectedStudents.map(id => students.find(s => s.id === id)).filter(Boolean) as StudentOption[],
    [selectedStudents, students]
  )

  // Group results by program/grade
  const groupedResults = useMemo(() => {
    const groups: Record<string, StudentOption[]> = {}
    
    results.forEach(student => {
      const group = student.grade_level?.name || student.program?.name || 'Unassigned'
      if (!groups[group]) groups[group] = []
      groups[group].push(student)
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
        if (query === '' && selectedStudents.length > 0) {
          onChange(selectedStudents.slice(0, -1))
        }
        break
    }
  }, [disabled, focusedIndex, results, query, selectedStudents, onChange])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-student-item]')
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  const handleSelect = useCallback((id: string) => {
    if (multiple) {
      if (selectedStudents.includes(id)) {
        onChange(selectedStudents.filter(s => s !== id))
      } else {
        onChange([...selectedStudents, id])
      }
    } else {
      onChange([id])
      setIsOpen(false)
    }
    clear()
    inputRef.current?.focus()
  }, [multiple, selectedStudents, onChange, clear])

  const handleRemove = useCallback((id: string) => {
    onChange(selectedStudents.filter(s => s !== id))
  }, [selectedStudents, onChange])

  const handleClearAll = useCallback(() => {
    onChange([])
    clear()
  }, [onChange, clear])

  const handleSelectAll = useCallback(() => {
    if (selectedStudents.length === students.length) {
      onChange([])
    } else {
      onChange(students.map(s => s.id))
    }
  }, [selectedStudents, students, onChange])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected students + input */}
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
        {selectedStudentsData.slice(0, maxDisplayed).map(student => (
          <span 
            key={student.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-md"
          >
            <span className="truncate max-w-[120px]">{student.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove(student.id)
              }}
              className="hover:text-green-600 ml-0.5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        
        {/* Overflow indicator */}
        {selectedStudentsData.length > maxDisplayed && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-md">
            +{selectedStudentsData.length - maxDisplayed} more
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
          placeholder={selectedStudents.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm disabled:cursor-not-allowed"
        />

        {/* Clear all button */}
        {selectedStudents.length > 1 && (
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
          {/* Select all option */}
          {allowSelectAll && multiple && students.length > 0 && (
            <div
              onClick={handleSelectAll}
              className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                  selectedStudents.length === students.length ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedStudents.length === students.length && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'} ({students.length})
                </span>
              </div>
            </div>
          )}

          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {query ? emptyMessage : 'Type to search students...'}
            </div>
          ) : (
            Object.entries(groupedResults).map(([group, groupStudents]) => (
              <div key={group}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  {group}
                </div>
                {groupStudents.map((student) => {
                  const isSelected = selectedStudents.includes(student.id)
                  const globalIndex = results.indexOf(student)
                  return (
                    <div
                      key={student.id}
                      data-student-item
                      onClick={() => handleSelect(student.id)}
                      className={`
                        px-3 py-2 cursor-pointer
                        ${globalIndex === focusedIndex ? 'bg-green-50' : 'hover:bg-gray-50'}
                        ${isSelected && !multiple ? 'bg-green-50' : ''}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        {multiple && (
                          <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
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
                            <span className="font-medium text-gray-900 truncate">{student.name}</span>
                            {student.grade_level && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {student.grade_level.code}
                              </span>
                            )}
                          </div>
                          {student.email && (
                            <div className="text-xs text-gray-500 truncate">{student.email}</div>
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

export default StudentSearchSelect
