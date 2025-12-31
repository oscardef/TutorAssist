'use client'

import { useState, useCallback } from 'react'

interface NumberInputProps {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  placeholder?: string
  className?: string
  allowNull?: boolean
  disabled?: boolean
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  placeholder,
  className = '',
  allowNull = false,
  disabled = false,
}: NumberInputProps) {
  // Track whether user is actively editing
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // Display either the edit value (while editing) or the formatted external value
  const displayValue = isEditing ? editValue : (value !== null ? value.toString() : '')

  const handleFocus = useCallback(() => {
    setIsEditing(true)
    setEditValue(value !== null ? value.toString() : '')
    setError(null)
  }, [value])

  const validateAndUpdate = useCallback((inputValue: string) => {
    const trimmed = inputValue.trim()
    
    // Handle empty input
    if (trimmed === '') {
      if (allowNull) {
        setError(null)
        onChange(null)
      } else {
        setError('Value is required')
      }
      setIsEditing(false)
      return
    }
    
    const num = parseInt(trimmed, 10)
    
    // Check if it's a valid number
    if (isNaN(num)) {
      setError('Please enter a valid number')
      setIsEditing(false)
      return
    }
    
    // Check min/max bounds
    if (min !== undefined && num < min) {
      setError(`Minimum value is ${min}`)
      onChange(min)
      setIsEditing(false)
      return
    }
    
    if (max !== undefined && num > max) {
      setError(`Maximum value is ${max}`)
      onChange(max)
      setIsEditing(false)
      return
    }
    
    // Valid input
    setError(null)
    onChange(num)
    setIsEditing(false)
  }, [allowNull, min, max, onChange])

  const handleBlur = useCallback(() => {
    validateAndUpdate(editValue)
  }, [editValue, validateAndUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validateAndUpdate(editValue)
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue('')
      setError(null)
    }
  }, [editValue, validateAndUpdate])

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={displayValue}
        onChange={(e) => {
          if (isEditing) {
            setEditValue(e.target.value)
          }
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  )
}

export default NumberInput
