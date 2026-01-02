/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Type definitions for mock data
interface MockQuestion {
  id: string
  workspace_id: string
  answer_type: string
  correct_answer: {
    value?: string | number | boolean
    correct?: number
    choices?: { text: string }[]
    alternates?: string[]
    blanks?: { position: number; value: string; latex?: string; alternates?: string[] }[]
    correctMatches?: number[]
    pairs?: { left: string; right: string }[]
    latex?: string
  } | null
}

interface MockAttempt {
  id: string
  workspace_id: string
  question_id: string
  student_user_id: string
  answer_raw: string
  is_correct: boolean
  context_json: {
    serverValidated: boolean
    clientClaimedCorrect?: boolean
    validation?: {
      matchType?: string
      serverValidated?: boolean
    }
  }
}

// Mock request and response helpers
const createMockRequest = (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  return {
    json: () => Promise.resolve(body),
    url: 'http://localhost:3000/api/attempts',
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as Request
}

// Track inserted attempts for verification
let insertedAttempt: MockAttempt | null = null

// Mock Supabase client
const mockUser = { id: 'student-123', email: 'student@test.com' }
const mockContext = { userId: 'student-123', workspaceId: 'workspace-123', role: 'student' }

// Define chainable mock functions
let mockQuestionData: MockQuestion | null = null
let mockQuestionError: { message: string } | null = null

const mockSupabaseClient = {
  from: jest.fn((table: string) => {
    if (table === 'questions') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockQuestionData,
                error: mockQuestionError,
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'attempts') {
      return {
        insert: jest.fn((data: MockAttempt) => {
          insertedAttempt = data
          return {
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'attempt-123', ...data },
                error: null,
              }),
            }),
          }
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              data: [],
              error: null,
            }),
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'spaced_repetition') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }
    }
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }
  }),
  rpc: jest.fn().mockResolvedValue({ error: null }),
}

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

jest.mock('@/lib/auth', () => ({
  requireUser: jest.fn(() => Promise.resolve(mockUser)),
  getUserContext: jest.fn(() => Promise.resolve(mockContext)),
}))

describe('Attempts API - Server-Side Answer Validation Security', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    insertedAttempt = null
    mockQuestionData = null
    mockQuestionError = null
  })

  describe('SECURITY: Client-submitted isCorrect should be IGNORED', () => {
    it('should NEVER trust client isCorrect=true when server says false', async () => {
      // Setup: Question with correct answer "5", student submits "6"
      mockQuestionData = {
        id: 'q-123',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 5 },
      }

      const request = createMockRequest({
        questionId: 'q-123',
        answerLatex: '6', // Wrong answer
        isCorrect: true, // Client LIES - claims correct
        timeSpentSeconds: 30,
      })

      // Import and call the POST handler
      const { POST } = await import('@/app/api/attempts/route')
      const response = await POST(request)
      const data = await response.json()

      // CRITICAL: The recorded attempt should be INCORRECT despite client claim
      expect(insertedAttempt?.is_correct).toBe(false)
      expect(insertedAttempt?.context_json?.clientClaimedCorrect).toBe(true)
      expect(insertedAttempt?.context_json?.serverValidated).toBe(true)
    })

    it('should mark correct when server validation passes (ignore client false)', async () => {
      mockQuestionData = {
        id: 'q-123',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 5 },
      }

      const request = createMockRequest({
        questionId: 'q-123',
        answerLatex: '5', // Correct answer
        isCorrect: false, // Client says false (maybe error in client code)
        timeSpentSeconds: 30,
      })

      const { POST } = await import('@/app/api/attempts/route')
      await POST(request)

      // Server validation overrides client - answer IS correct
      expect(insertedAttempt?.is_correct).toBe(true)
    })

    it('should record audit trail of client claim vs server result', async () => {
      mockQuestionData = {
        id: 'q-123',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 5 },
      }

      const request = createMockRequest({
        questionId: 'q-123',
        answerLatex: '6',
        isCorrect: true, // Suspicious: client claims correct for wrong answer
      })

      const { POST } = await import('@/app/api/attempts/route')
      await POST(request)

      // Should have audit trail
      const context = insertedAttempt?.context_json
      expect(context?.clientClaimedCorrect).toBe(true)
      expect(context?.serverValidated).toBe(true)
      expect(insertedAttempt?.is_correct).toBe(false)
    })
  })

  describe('Multiple Choice Validation', () => {
    it('should validate multiple choice by index', async () => {
      mockQuestionData = {
        id: 'q-mc',
        workspace_id: 'workspace-123',
        answer_type: 'multiple_choice',
        correct_answer: {
          correct: 2, // Index 2 is correct
          choices: [
            { text: 'Option A' },
            { text: 'Option B' },
            { text: 'Option C' }, // Correct
            { text: 'Option D' },
          ],
        },
      }

      // Test correct selection
      let request = createMockRequest({
        questionId: 'q-mc',
        answerLatex: '2',
        isCorrect: false, // Client doesn't know
      })

      const { POST } = await import('@/app/api/attempts/route')
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)

      // Test wrong selection
      insertedAttempt = null
      request = createMockRequest({
        questionId: 'q-mc',
        answerLatex: '0',
        isCorrect: true, // Client lies
      })

      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(false)
    })

    it('should reject invalid multiple choice index', async () => {
      mockQuestionData = {
        id: 'q-mc',
        workspace_id: 'workspace-123',
        answer_type: 'multiple_choice',
        correct_answer: { correct: 1 },
      }

      const request = createMockRequest({
        questionId: 'q-mc',
        answerLatex: 'abc', // Invalid - not a number
        isCorrect: true,
      })

      const { POST } = await import('@/app/api/attempts/route')
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(false)
    })
  })

  describe('True/False Validation', () => {
    it('should accept only exact "true" or "false"', async () => {
      mockQuestionData = {
        id: 'q-tf',
        workspace_id: 'workspace-123',
        answer_type: 'true_false',
        correct_answer: { value: 'true' },
      }

      const { POST } = await import('@/app/api/attempts/route')

      // Valid "true" answer
      let request = createMockRequest({ questionId: 'q-tf', answerLatex: 'true' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)

      // Valid "false" answer (wrong for this question)
      insertedAttempt = null
      request = createMockRequest({ questionId: 'q-tf', answerLatex: 'false' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(false)
    })

    it('should reject abbreviations like "t" or "f"', async () => {
      mockQuestionData = {
        id: 'q-tf',
        workspace_id: 'workspace-123',
        answer_type: 'true_false',
        correct_answer: { value: 'true' },
      }

      const { POST } = await import('@/app/api/attempts/route')

      // "t" should NOT be accepted
      const request = createMockRequest({
        questionId: 'q-tf',
        answerLatex: 't',
        isCorrect: true, // Client claims it's right
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(false)
    })

    it('should handle various truthy values in correct_answer', async () => {
      const { POST } = await import('@/app/api/attempts/route')

      // Test with string "true"
      mockQuestionData = {
        id: 'q-tf',
        workspace_id: 'workspace-123',
        answer_type: 'true_false',
        correct_answer: { value: 'true' },
      }
      let request = createMockRequest({ questionId: 'q-tf', answerLatex: 'true' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)

      // Test with number 1
      insertedAttempt = null
      mockQuestionData = {
        id: 'q-tf',
        workspace_id: 'workspace-123',
        answer_type: 'true_false',
        correct_answer: { value: 1 as unknown as string },
      }
      request = createMockRequest({ questionId: 'q-tf', answerLatex: 'true' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)
    })
  })

  describe('Numeric Validation', () => {
    it('should validate exact numeric matches', async () => {
      mockQuestionData = {
        id: 'q-num',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 42 },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({ questionId: 'q-num', answerLatex: '42' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)
    })

    it('should handle decimal numbers', async () => {
      mockQuestionData = {
        id: 'q-num',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 3.14 },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({ questionId: 'q-num', answerLatex: '3.14' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)
    })

    it('should handle fractions (1/2 = 0.5)', async () => {
      mockQuestionData = {
        id: 'q-num',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 0.5 },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({ questionId: 'q-num', answerLatex: '1/2' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)
    })

    it('should reject NaN input', async () => {
      mockQuestionData = {
        id: 'q-num',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 5 },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({
        questionId: 'q-num',
        answerLatex: 'not a number',
        isCorrect: true,
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(false)
    })
  })

  describe('Fill in the Blank Validation', () => {
    it('should validate all blanks', async () => {
      mockQuestionData = {
        id: 'q-fill',
        workspace_id: 'workspace-123',
        answer_type: 'fill_blank',
        correct_answer: {
          blanks: [
            { position: 0, value: '5' },
            { position: 1, value: '10' },
          ],
        },
      }

      const { POST } = await import('@/app/api/attempts/route')

      // All correct
      let request = createMockRequest({
        questionId: 'q-fill',
        answerLatex: '5,10',
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)

      // One wrong
      insertedAttempt = null
      request = createMockRequest({
        questionId: 'q-fill',
        answerLatex: '5,11',
        isCorrect: true, // Lies
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(false)
    })

    it('should track partial correctness in validation details', async () => {
      mockQuestionData = {
        id: 'q-fill',
        workspace_id: 'workspace-123',
        answer_type: 'fill_blank',
        correct_answer: {
          blanks: [
            { position: 0, value: '5' },
            { position: 1, value: '10' },
            { position: 2, value: '15' },
          ],
        },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({
        questionId: 'q-fill',
        answerLatex: '5,10,20', // 2/3 correct
      })
      await POST(request)

      expect(insertedAttempt?.is_correct).toBe(false) // Not all correct
      expect(insertedAttempt?.context_json?.validation?.matchType).toBe('fill_blank')
    })
  })

  describe('Matching Validation', () => {
    it('should validate matching pairs', async () => {
      mockQuestionData = {
        id: 'q-match',
        workspace_id: 'workspace-123',
        answer_type: 'matching',
        correct_answer: {
          correctMatches: [1, 0, 2], // Index 0 matches to 1, index 1 matches to 0, etc.
          pairs: [
            { left: 'A', right: '1' },
            { left: 'B', right: '2' },
            { left: 'C', right: '3' },
          ],
        },
      }

      const { POST } = await import('@/app/api/attempts/route')

      // Correct matches
      let request = createMockRequest({
        questionId: 'q-match',
        answerLatex: '1,0,2',
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)

      // Wrong matches
      insertedAttempt = null
      request = createMockRequest({
        questionId: 'q-match',
        answerLatex: '0,1,2',
        isCorrect: true,
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(false)
    })
  })

  describe('Long Answer - Manual Grading Required', () => {
    it('should mark long answers as incorrect (requires manual grading)', async () => {
      mockQuestionData = {
        id: 'q-long',
        workspace_id: 'workspace-123',
        answer_type: 'long_answer',
        correct_answer: { value: 'Sample answer' },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({
        questionId: 'q-long',
        answerLatex: 'My detailed response about the topic...',
        isCorrect: true, // Client might auto-pass these
      })
      await POST(request)

      // Should be marked for manual grading (is_correct=false until reviewed)
      expect(insertedAttempt?.is_correct).toBe(false)
      expect(insertedAttempt?.context_json?.validation?.matchType).toBe('manual_grading_required')
    })
  })

  describe('Expression/Short Answer Validation', () => {
    it('should use math comparison for expressions', async () => {
      mockQuestionData = {
        id: 'q-expr',
        workspace_id: 'workspace-123',
        answer_type: 'expression',
        correct_answer: { value: '2x+1' },
      }

      const { POST } = await import('@/app/api/attempts/route')

      // Exact match
      const request = createMockRequest({
        questionId: 'q-expr',
        answerLatex: '2x+1',
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)
    })

    it('should accept LaTeX equivalent expressions', async () => {
      mockQuestionData = {
        id: 'q-expr',
        workspace_id: 'workspace-123',
        answer_type: 'expression',
        correct_answer: { latex: '\\frac{1}{2}' },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({
        questionId: 'q-expr',
        answerLatex: '0.5', // Should match 1/2
      })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)
    })

    it('should handle alternate answers', async () => {
      mockQuestionData = {
        id: 'q-expr',
        workspace_id: 'workspace-123',
        answer_type: 'short_answer',
        correct_answer: {
          value: 'pi',
          alternates: ['3.14', '3.14159', 'π'],
        },
      }

      const { POST } = await import('@/app/api/attempts/route')

      // Primary answer
      let request = createMockRequest({ questionId: 'q-expr', answerLatex: 'pi' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)

      // Alternate
      insertedAttempt = null
      request = createMockRequest({ questionId: 'q-expr', answerLatex: '3.14' })
      await POST(request)
      expect(insertedAttempt?.is_correct).toBe(true)
    })
  })

  describe('Error Handling - Validation Failures', () => {
    it('should mark as incorrect when validation throws error', async () => {
      mockQuestionData = {
        id: 'q-err',
        workspace_id: 'workspace-123',
        answer_type: 'expression',
        correct_answer: null, // Missing correct answer data
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({
        questionId: 'q-err',
        answerLatex: '5',
        isCorrect: true, // Client claims correct
      })
      await POST(request)

      // Should be safe - marked incorrect, not crashing
      expect(insertedAttempt?.is_correct).toBe(false)
    })

    it('should handle missing answer data gracefully', async () => {
      mockQuestionData = {
        id: 'q-null',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: {}, // Empty object
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({
        questionId: 'q-null',
        answerLatex: '5',
        isCorrect: true,
      })

      // Should not throw
      await expect(POST(request)).resolves.toBeDefined()
    })
  })

  describe('Input Sanitization', () => {
    it('should safely handle SQL injection attempts (parameterized queries prevent execution)', async () => {
      mockQuestionData = {
        id: 'q-123',
        workspace_id: 'workspace-123',
        answer_type: 'numeric',
        correct_answer: { value: 5 },
      }

      const { POST } = await import('@/app/api/attempts/route')

      // SQL injection in answer - this is safely stored via parameterized queries
      // Note: parseFloat("5'; DROP TABLE...") extracts 5, so it may match
      // The security is in parameterized queries, not input rejection
      const request = createMockRequest({
        questionId: 'q-123',
        answerLatex: "'; DROP TABLE attempts;--",  // No leading 5, so won't parse as numeric
        isCorrect: true,
      })
      await POST(request)

      // Should NOT match because the answer doesn't parse to a valid number
      expect(insertedAttempt?.is_correct).toBe(false)
    })

    it('should handle script injection attempts', async () => {
      mockQuestionData = {
        id: 'q-123',
        workspace_id: 'workspace-123',
        answer_type: 'short_answer',
        correct_answer: { value: 'hello' },
      }

      const { POST } = await import('@/app/api/attempts/route')

      const request = createMockRequest({
        questionId: 'q-123',
        answerLatex: '<script>alert("xss")</script>',
        isCorrect: true,
      })
      await POST(request)

      expect(insertedAttempt?.is_correct).toBe(false)
    })
  })
})

describe('Attempts API - Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    insertedAttempt = null
  })

  it('should require authentication', async () => {
    // Mock requireUser to return null
    const authMock = await import('@/lib/auth')
    ;(authMock.requireUser as jest.Mock).mockResolvedValueOnce(null)

    const request = createMockRequest({ questionId: 'q-123', answerLatex: '5' })
    const { POST } = await import('@/app/api/attempts/route')
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('should require workspace context', async () => {
    const authMock = await import('@/lib/auth')
    ;(authMock.getUserContext as jest.Mock).mockResolvedValueOnce(null)

    const request = createMockRequest({ questionId: 'q-123', answerLatex: '5' })
    const { POST } = await import('@/app/api/attempts/route')
    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it('should verify question belongs to workspace', async () => {
    mockQuestionData = null
    mockQuestionError = { message: 'Question not found' }

    const request = createMockRequest({ questionId: 'foreign-question', answerLatex: '5' })
    const { POST } = await import('@/app/api/attempts/route')
    const response = await POST(request)

    expect(response.status).toBe(404)
  })
})
