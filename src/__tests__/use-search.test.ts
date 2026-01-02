/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSearch } from '@/lib/hooks/use-search'

describe('useSearch Hook', () => {
  const mockItems = [
    { id: '1', name: 'Algebra', tags: ['math', 'equations'] },
    { id: '2', name: 'Geometry', tags: ['math', 'shapes'] },
    { id: '3', name: 'Calculus', tags: ['math', 'derivatives'] },
    { id: '4', name: 'Statistics', tags: ['data', 'probability'] },
    { id: '5', name: 'Physics', tags: ['science', 'mechanics'] },
  ]

  it('should initialize with empty query', () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name', 'tags'] })
    )
    
    expect(result.current.query).toBe('')
    expect(result.current.isSearching).toBe(false)
  })

  it('should return all items when query is empty', () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name'] })
    )
    
    expect(result.current.results).toHaveLength(5)
  })

  it('should filter items based on search query', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery('alg')
    })
    
    await waitFor(() => {
      expect(result.current.results).toHaveLength(1)
      expect(result.current.results[0].name).toBe('Algebra')
    })
  })

  it('should search across multiple keys', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name', 'tags'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery('math')
    })
    
    await waitFor(() => {
      // Should find items with 'math' in tags
      expect(result.current.results.length).toBeGreaterThan(0)
    })
  })

  it('should handle fuzzy search', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { 
        keys: ['name'], 
        threshold: 0.4, 
        debounceMs: 0 
      })
    )
    
    act(() => {
      result.current.setQuery('algebr')  // Slightly different spelling
    })
    
    await waitFor(() => {
      expect(result.current.results.some(r => r.name === 'Algebra')).toBe(true)
    })
  })

  it('should respect minChars setting', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { 
        keys: ['name'], 
        minChars: 3,
        debounceMs: 0 
      })
    )
    
    act(() => {
      result.current.setQuery('al')  // Only 2 chars
    })
    
    await waitFor(() => {
      expect(result.current.isSearching).toBe(false)
    })
    
    act(() => {
      result.current.setQuery('alg')  // 3 chars
    })
    
    await waitFor(() => {
      expect(result.current.isSearching).toBe(true)
    })
  })

  it('should clear search', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery('calculus')
    })
    
    await waitFor(() => {
      expect(result.current.results).toHaveLength(1)
    })
    
    act(() => {
      result.current.clear()
    })
    
    expect(result.current.query).toBe('')
    
    // Wait for debounced query to clear and results to reset
    await waitFor(() => {
      expect(result.current.results).toHaveLength(5)
    })
  })

  it('should return results with scores when enabled', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { 
        keys: ['name'], 
        includeScore: true,
        debounceMs: 0 
      })
    )
    
    act(() => {
      result.current.setQuery('geometry')
    })
    
    await waitFor(() => {
      expect(result.current.resultsWithScores.length).toBeGreaterThan(0)
      expect(result.current.resultsWithScores[0]).toHaveProperty('score')
    })
  })

  it('should limit results when limit is set', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { 
        keys: ['tags'], 
        limit: 2,
        debounceMs: 0 
      })
    )
    
    act(() => {
      result.current.setQuery('math')
    })
    
    await waitFor(() => {
      expect(result.current.results.length).toBeLessThanOrEqual(2)
    })
  })

  it('should return total results count', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery('a')
    })
    
    await waitFor(() => {
      expect(result.current.totalResults).toBeGreaterThan(0)
    })
  })

  it('should handle empty items array', () => {
    const { result } = renderHook(() => 
      useSearch([], { keys: ['name'] })
    )
    
    expect(result.current.results).toHaveLength(0)
  })

  it('should update when items change', async () => {
    let items = mockItems.slice(0, 3)
    
    const { result, rerender } = renderHook(
      ({ items }) => useSearch(items, { keys: ['name'], debounceMs: 0 }),
      { initialProps: { items } }
    )
    
    expect(result.current.results).toHaveLength(3)
    
    items = mockItems
    rerender({ items })
    
    await waitFor(() => {
      expect(result.current.results).toHaveLength(5)
    })
  })

  it('should handle case-insensitive search', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery('ALGEBRA')
    })
    
    await waitFor(() => {
      expect(result.current.results.some(r => r.name === 'Algebra')).toBe(true)
    })
  })

  it('should debounce search queries', async () => {
    const { result } = renderHook(() => 
      useSearch(mockItems, { keys: ['name'], debounceMs: 100 })
    )
    
    act(() => {
      result.current.setQuery('a')
      result.current.setQuery('al')
      result.current.setQuery('alg')
    })
    
    // Should still show isPending during debounce
    expect(result.current.isPending).toBe(true)
    
    await waitFor(() => {
      expect(result.current.debouncedQuery).toBe('alg')
    })
  })
})

describe('useSearch with nested keys', () => {
  const nestedItems = [
    { id: '1', topic: { name: 'Algebra', code: 'ALG' }, program: { name: 'IB' } },
    { id: '2', topic: { name: 'Geometry', code: 'GEO' }, program: { name: 'AP' } },
    { id: '3', topic: { name: 'Calculus', code: 'CAL' }, program: { name: 'IB' } },
  ]

  it('should search nested object properties', async () => {
    const { result } = renderHook(() => 
      useSearch(nestedItems, { 
        keys: ['topic.name', 'program.name'], 
        debounceMs: 0 
      })
    )
    
    act(() => {
      result.current.setQuery('IB')
    })
    
    await waitFor(() => {
      expect(result.current.results.length).toBe(2)
    })
  })

  it('should search by nested code', async () => {
    const { result } = renderHook(() => 
      useSearch(nestedItems, { 
        keys: ['topic.code'], 
        debounceMs: 0 
      })
    )
    
    act(() => {
      result.current.setQuery('GEO')
    })
    
    await waitFor(() => {
      expect(result.current.results.length).toBe(1)
      expect(result.current.results[0].topic.name).toBe('Geometry')
    })
  })
})

describe('useSearch edge cases', () => {
  it('should handle special characters in search', async () => {
    const items = [
      { id: '1', name: 'x² + 2x + 1' },
      { id: '2', name: 'sin(θ)' },
      { id: '3', name: 'f(x) = x' },
    ]
    
    const { result } = renderHook(() => 
      useSearch(items, { keys: ['name'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery('x²')
    })
    
    // Should not throw
    await waitFor(() => {
      expect(result.current.results).toBeDefined()
    })
  })

  it('should handle items with null/undefined values', async () => {
    const items = [
      { id: '1', name: 'Algebra', description: null },
      { id: '2', name: 'Geometry', description: undefined },
      { id: '3', name: 'Calculus', description: 'Math topic' },
    ]
    
    const { result } = renderHook(() => 
      useSearch(items, { keys: ['name', 'description'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery('math')
    })
    
    await waitFor(() => {
      expect(result.current.results.length).toBe(1)
      expect(result.current.results[0].name).toBe('Calculus')
    })
  })

  it('should handle very long search queries', async () => {
    const items = [
      { id: '1', name: 'Short' },
      { id: '2', name: 'Medium length name' },
    ]
    
    const longQuery = 'a'.repeat(100)
    
    const { result } = renderHook(() => 
      useSearch(items, { keys: ['name'], debounceMs: 0 })
    )
    
    act(() => {
      result.current.setQuery(longQuery)
    })
    
    // Should not throw
    await waitFor(() => {
      expect(result.current.results).toHaveLength(0)
    })
  })
})
