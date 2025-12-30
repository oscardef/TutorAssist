'use client'

import { useState, useMemo, useCallback } from 'react'
import Fuse, { IFuseOptions } from 'fuse.js'
import { useDebounce } from 'use-debounce'

export interface SearchConfig<T> {
  /** Keys to search within each item */
  keys: (keyof T | string)[]
  /** Fuzzy search threshold (0 = exact, 1 = anything matches). Default: 0.3 */
  threshold?: number
  /** Minimum characters before search activates. Default: 1 */
  minChars?: number
  /** Debounce delay in ms. Default: 300 */
  debounceMs?: number
  /** Include score in results for sorting. Default: true */
  includeScore?: boolean
  /** Maximum results to return. Default: unlimited */
  limit?: number
  /** Whether to sort by score. Default: true */
  sortByScore?: boolean
}

export interface SearchResult<T> {
  /** The matched item */
  item: T
  /** Match score (0 = perfect match, 1 = no match) */
  score?: number
  /** Indices of matched characters per key */
  matches?: ReadonlyArray<{
    key?: string
    value?: string
    indices: ReadonlyArray<[number, number]>
  }>
}

export interface UseSearchReturn<T> {
  /** Current search query */
  query: string
  /** Debounced search query */
  debouncedQuery: string
  /** Update search query */
  setQuery: (query: string) => void
  /** Filtered/searched results */
  results: T[]
  /** Results with match info (scores, matched indices) */
  resultsWithScores: SearchResult<T>[]
  /** Whether search is active (query meets minChars) */
  isSearching: boolean
  /** Whether debounce is pending */
  isPending: boolean
  /** Clear search */
  clear: () => void
  /** Total results count */
  totalResults: number
}

/**
 * A shared, reusable fuzzy search hook using Fuse.js
 * 
 * @example
 * ```tsx
 * const { query, setQuery, results, isSearching } = useSearch(questions, {
 *   keys: ['prompt_text', 'tags', 'topics.name'],
 *   threshold: 0.3,
 * })
 * ```
 */
export function useSearch<T>(
  items: T[],
  config: SearchConfig<T>
): UseSearchReturn<T> {
  const {
    keys,
    threshold = 0.3,
    minChars = 1,
    debounceMs = 300,
    includeScore = true,
    limit,
    sortByScore = true,
  } = config

  const [query, setQueryState] = useState('')
  const [debouncedQuery, { isPending }] = useDebounce(query, debounceMs)

  // Create Fuse instance with memoization
  const fuse = useMemo(() => {
    const fuseOptions: IFuseOptions<T> = {
      keys: keys as string[],
      threshold,
      includeScore,
      includeMatches: true,
      ignoreLocation: true, // Search entire string, not just beginning
      useExtendedSearch: false,
      findAllMatches: true,
    }
    return new Fuse(items, fuseOptions)
  }, [items, keys, threshold, includeScore])

  // Determine if search should be active
  const isSearching = debouncedQuery.length >= minChars

  // Perform search
  const searchResults = useMemo(() => {
    if (!isSearching) return []
    
    let results = fuse.search(debouncedQuery)
    
    if (sortByScore) {
      results = results.sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    }
    
    if (limit) {
      results = results.slice(0, limit)
    }
    
    return results
  }, [fuse, debouncedQuery, isSearching, limit, sortByScore])

  // Extract just items for simple use case
  const results = useMemo(() => {
    if (!isSearching) return items
    return searchResults.map(r => r.item)
  }, [searchResults, isSearching, items])

  // Results with full match info
  const resultsWithScores = useMemo((): SearchResult<T>[] => {
    if (!isSearching) {
      return items.map(item => ({ item }))
    }
    return searchResults.map(r => ({
      item: r.item,
      score: r.score,
      matches: r.matches,
    }))
  }, [searchResults, isSearching, items])

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)
  }, [])

  const clear = useCallback(() => {
    setQueryState('')
  }, [])

  return {
    query,
    debouncedQuery,
    setQuery,
    results,
    resultsWithScores,
    isSearching,
    isPending: isPending(),
    clear,
    totalResults: results.length,
  }
}

/**
 * Pre-configured search for common entity types
 */
export const searchConfigs = {
  questions: {
    keys: ['prompt_text', 'tags', 'topics.name', 'correct_answer_json.value'],
    threshold: 0.3,
  } satisfies SearchConfig<unknown>,
  
  topics: {
    keys: ['name', 'description', 'curriculum_code', 'learning_objectives'],
    threshold: 0.3,
  } satisfies SearchConfig<unknown>,
  
  students: {
    keys: ['full_name', 'email', 'school', 'notes'],
    threshold: 0.2,
  } satisfies SearchConfig<unknown>,
  
  assignments: {
    keys: ['title', 'description', 'student_profiles.full_name'],
    threshold: 0.3,
  } satisfies SearchConfig<unknown>,
}

export default useSearch
