'use client'

import { useState } from 'react'

interface ExpandableTopicsProps {
  topics: string[]
  maxVisible?: number
  size?: 'sm' | 'md'
}

export function ExpandableTopics({ topics, maxVisible = 3, size = 'sm' }: ExpandableTopicsProps) {
  const [expanded, setExpanded] = useState(false)
  
  if (topics.length === 0) return null
  
  const hasMore = topics.length > maxVisible
  const visibleTopics = expanded ? topics : topics.slice(0, maxVisible)
  const hiddenCount = topics.length - maxVisible
  
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm'
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {visibleTopics.map((topic) => (
        <span 
          key={topic} 
          className={`inline-flex items-center rounded-full bg-blue-50 font-medium text-blue-700 ${sizeClasses}`}
        >
          {topic}
        </span>
      ))}
      {hasMore && !expanded && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setExpanded(true)
          }}
          className={`inline-flex items-center rounded-full bg-gray-100 font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors cursor-pointer ${sizeClasses}`}
        >
          +{hiddenCount} more
        </button>
      )}
      {expanded && hasMore && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setExpanded(false)
          }}
          className={`inline-flex items-center rounded-full bg-gray-100 font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors cursor-pointer ${sizeClasses}`}
        >
          Show less
        </button>
      )}
    </div>
  )
}
