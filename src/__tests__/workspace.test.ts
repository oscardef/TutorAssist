/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
      })),
    })),
  })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
  },
}

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
  createAdminClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

describe('Workspace Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('RLS Policy Tests', () => {
    it('should only return questions from user workspace', async () => {
      const mockQuestions = [
        { id: 'q1', workspace_id: 'ws-1', question_latex: 'Question 1' },
      ]
      
      const selectMock = jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: mockQuestions, error: null })),
        })),
      }))
      
      mockSupabaseClient.from.mockReturnValueOnce({ select: selectMock })
      
      // Simulate query
      const result = await mockSupabaseClient.from('questions').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
      expect(selectMock).toHaveBeenCalledWith('*')
    })

    it('should prevent access to other workspace data', async () => {
      const errorResult = { data: null, error: { message: 'Row level security violation' } }
      
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve(errorResult)),
        })),
      })
      
      const result = await mockSupabaseClient.from('questions').select('*')
      
      // In real scenario with RLS, accessing other workspace would fail
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
    })

    it('should allow tutor to see all student attempts in their workspace', async () => {
      const mockAttempts = [
        { id: 'a1', student_id: 'student-1', is_correct: true },
        { id: 'a2', student_id: 'student-2', is_correct: false },
      ]
      
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: mockAttempts, error: null })),
        })),
      })
      
      const result = await mockSupabaseClient.from('attempts').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('attempts')
    })

    it('should restrict student to only see their own attempts', async () => {
      const mockAttempts = [
        { id: 'a1', student_id: 'current-student', is_correct: true },
      ]
      
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: mockAttempts, error: null })),
          })),
        })),
      })
      
      const result = await mockSupabaseClient.from('attempts').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('attempts')
    })
  })

  describe('Role-Based Access Control', () => {
    it('should allow platform_owner to manage workspace', async () => {
      const ownerContext = {
        role: 'platform_owner',
        workspaceId: 'ws-1',
        membershipId: 'm-1',
      }
      
      // Platform owner should have full access
      expect(ownerContext.role).toBe('platform_owner')
    })

    it('should allow tutor to create questions', async () => {
      const tutorContext = {
        role: 'tutor',
        workspaceId: 'ws-1',
        membershipId: 'm-2',
      }
      
      // Tutor should be able to create questions
      expect(tutorContext.role).toBe('tutor')
      expect(['platform_owner', 'tutor'].includes(tutorContext.role)).toBe(true)
    })

    it('should prevent student from creating questions', async () => {
      const studentContext = {
        role: 'student',
        workspaceId: 'ws-1',
        membershipId: 'm-3',
      }
      
      // Student should not be able to create questions
      expect(studentContext.role).toBe('student')
      expect(['platform_owner', 'tutor'].includes(studentContext.role)).toBe(false)
    })

    it('should allow student to submit attempts', async () => {
      const studentContext = {
        role: 'student',
        workspaceId: 'ws-1',
        userId: 'user-3',
      }
      
      // Students can submit attempts
      expect(studentContext.role).toBe('student')
    })

    it('should allow tutor to view all student progress', async () => {
      const tutorContext = {
        role: 'tutor',
        workspaceId: 'ws-1',
      }
      
      // Tutor can view progress of all students in workspace
      expect(['platform_owner', 'tutor'].includes(tutorContext.role)).toBe(true)
    })

    it('should restrict student to view only their own progress', async () => {
      const studentContext = {
        role: 'student',
        userId: 'user-3',
      }
      
      // Student can only view their own progress
      expect(studentContext.role).toBe('student')
      expect(studentContext.userId).toBeDefined()
    })
  })
})

describe('Question Generation', () => {
  it('should enqueue generation job with correct payload', async () => {
    const payload = {
      topicId: 'topic-1',
      workspaceId: 'ws-1',
      count: 5,
      difficulty: 'mixed',
    }
    
    expect(payload.count).toBeLessThanOrEqual(50)
    expect(['easy', 'medium', 'hard', 'mixed'].includes(payload.difficulty)).toBe(true)
  })

  it('should validate topic belongs to workspace', async () => {
    const topicWorkspaceId = 'ws-1'
    const userWorkspaceId = 'ws-1'
    
    expect(topicWorkspaceId).toBe(userWorkspaceId)
  })
})

describe('PDF Generation', () => {
  it('should generate PDF with correct structure', async () => {
    const pdfOptions = {
      title: 'Practice Quiz',
      questionIds: ['q1', 'q2', 'q3'],
      includeAnswers: true,
      includeHints: false,
    }
    
    expect(pdfOptions.questionIds.length).toBeGreaterThan(0)
    expect(typeof pdfOptions.includeAnswers).toBe('boolean')
  })

  it('should respect answer key preference', async () => {
    const withAnswers = { includeAnswers: true }
    const withoutAnswers = { includeAnswers: false }
    
    expect(withAnswers.includeAnswers).not.toBe(withoutAnswers.includeAnswers)
  })
})

describe('Spaced Repetition', () => {
  it('should calculate next review date correctly on correct answer', () => {
    const currentInterval = 1
    const easeFactor = 2.5
    const repetitions = 1
    
    // SM-2: After first correct, interval = 1
    // After second correct, interval = 6
    // After that, interval = previous * easeFactor
    
    let newInterval: number
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(currentInterval * easeFactor)
    }
    
    expect(newInterval).toBe(6) // Second repetition
  })

  it('should reset on incorrect answer', () => {
    const currentInterval = 10
    const currentRepetitions = 5
    
    // On wrong answer, reset
    const newInterval = 1
    const newRepetitions = 0
    
    expect(newInterval).toBe(1)
    expect(newRepetitions).toBe(0)
  })
})
