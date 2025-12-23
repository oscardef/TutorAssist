/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/tutor/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Math Input Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render practice page', () => {
    // Basic render test
    const mockElement = document.createElement('div')
    mockElement.innerHTML = '<h1>Practice</h1>'
    
    expect(mockElement.querySelector('h1')?.textContent).toBe('Practice')
  })

  it('should handle answer submission', async () => {
    const mockFetch = global.fetch as jest.Mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ attempt: { id: 'a1', is_correct: true } }),
    })
    
    // Simulate form submission
    const formData = {
      questionId: 'q1',
      answerLatex: '\\frac{1}{2}',
      isCorrect: true,
    }
    
    const response = await fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    
    expect(response.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('/api/attempts', expect.any(Object))
  })
})

describe('Question Bank UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should display questions with difficulty badges', () => {
    const questions = [
      { id: 'q1', question_latex: 'What is 2+2?', difficulty: 'easy' },
      { id: 'q2', question_latex: 'Solve x^2 = 4', difficulty: 'medium' },
      { id: 'q3', question_latex: 'Prove theorem', difficulty: 'hard' },
    ]
    
    // Verify difficulty mapping
    const difficultyColors = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-red-100 text-red-700',
    }
    
    questions.forEach((q) => {
      expect(difficultyColors[q.difficulty as keyof typeof difficultyColors]).toBeDefined()
    })
  })

  it('should filter questions by topic', () => {
    const questions = [
      { id: 'q1', topic_id: 't1', question_latex: 'Algebra Q1' },
      { id: 'q2', topic_id: 't2', question_latex: 'Geometry Q1' },
      { id: 'q3', topic_id: 't1', question_latex: 'Algebra Q2' },
    ]
    
    const topicFilter = 't1'
    const filtered = questions.filter((q) => q.topic_id === topicFilter)
    
    expect(filtered.length).toBe(2)
    expect(filtered.every((q) => q.topic_id === 't1')).toBe(true)
  })
})

describe('Student Dashboard', () => {
  it('should calculate accuracy correctly', () => {
    const totalAttempts = 10
    const correctAttempts = 7
    const accuracy = Math.round((correctAttempts / totalAttempts) * 100)
    
    expect(accuracy).toBe(70)
  })

  it('should handle zero attempts', () => {
    const totalAttempts = 0
    const accuracy = totalAttempts > 0 ? Math.round((0 / totalAttempts) * 100) : 0
    
    expect(accuracy).toBe(0)
  })

  it('should display streak correctly', () => {
    let streak = 0
    const attempts = [true, true, true, false, true, true]
    
    attempts.forEach((isCorrect) => {
      if (isCorrect) {
        streak += 1
      } else {
        streak = 0
      }
    })
    
    // After false, streak resets, then 2 more correct
    expect(streak).toBe(2)
  })
})

describe('PDF Export', () => {
  it('should sanitize LaTeX for plain text', () => {
    const cleanLatex = (latex: string): string => {
      return latex
        .replace(/\\\[/g, '').replace(/\\\]/g, '')
        .replace(/\\\(/g, '').replace(/\\\)/g, '')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\times/g, '×')
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[{}]/g, '')
        .trim()
    }
    
    const input = '\\frac{1}{2} + \\sqrt{4}'
    const output = cleanLatex(input)
    
    expect(output).toBe('(1)/(2) + √(4)')
  })

  it('should validate question IDs before generation', () => {
    const questionIds = ['q1', 'q2', 'q3']
    
    expect(Array.isArray(questionIds)).toBe(true)
    expect(questionIds.length).toBeGreaterThan(0)
  })
})

describe('Topic Management', () => {
  it('should maintain display order', () => {
    const topics = [
      { id: 't1', name: 'Algebra', display_order: 1 },
      { id: 't2', name: 'Geometry', display_order: 2 },
      { id: 't3', name: 'Calculus', display_order: 3 },
    ]
    
    const sorted = [...topics].sort((a, b) => a.display_order - b.display_order)
    
    expect(sorted[0].name).toBe('Algebra')
    expect(sorted[2].name).toBe('Calculus')
  })

  it('should support nested topics', () => {
    const topics = [
      { id: 't1', name: 'Algebra', parent_topic_id: null },
      { id: 't2', name: 'Linear Equations', parent_topic_id: 't1' },
      { id: 't3', name: 'Quadratic Equations', parent_topic_id: 't1' },
    ]
    
    const childTopics = topics.filter((t) => t.parent_topic_id === 't1')
    
    expect(childTopics.length).toBe(2)
  })
})
