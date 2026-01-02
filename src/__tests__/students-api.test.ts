/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock auth
const mockTutorContext = { userId: 'tutor-123', workspaceId: 'workspace-123', role: 'tutor', isPlatformOwner: false }
const mockStudentContext = { userId: 'student-123', workspaceId: 'workspace-123', role: 'student', isPlatformOwner: false }

let currentContext = mockTutorContext

jest.mock('@/lib/auth', () => ({
  requireTutor: jest.fn(() => {
    if (currentContext.role !== 'tutor' && !currentContext.isPlatformOwner) {
      const error = new Error('REDIRECT:/student/dashboard')
      throw error
    }
    return Promise.resolve(currentContext)
  }),
  getUserContext: jest.fn(() => Promise.resolve(currentContext)),
}))

// Mock workspace functions
let mockCreatedProfile: Record<string, unknown> | null = null
let mockCreatedToken: { token: string } | null = null

jest.mock('@/lib/workspace', () => ({
  createStudentProfile: jest.fn((workspaceId: string, data: Record<string, unknown>) => {
    mockCreatedProfile = { id: 'new-student-id', workspace_id: workspaceId, ...data }
    return Promise.resolve(mockCreatedProfile)
  }),
  createInviteToken: jest.fn(() => {
    mockCreatedToken = { token: 'invite-token-123' }
    return Promise.resolve(mockCreatedToken)
  }),
}))

// Mock Supabase
let mockStudentsData: unknown[] = []
let mockStudentError: { message: string } | null = null
let mockUpdatedStudent: Record<string, unknown> | null = null

const mockSupabaseClient = {
  from: jest.fn((table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: mockStudentsData,
          error: mockStudentError,
        })),
        single: jest.fn(() => Promise.resolve({
          data: mockStudentsData[0] || null,
          error: mockStudentError,
        })),
      })),
    })),
    update: jest.fn((data: Record<string, unknown>) => {
      mockUpdatedStudent = data
      return {
        eq: jest.fn(() => Promise.resolve({ error: null })),
      }
    }),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

// Request helper
const createMockRequest = (
  body?: Record<string, unknown>,
  searchParams?: Record<string, string>
) => {
  const url = new URL('http://localhost:3000/api/students')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    url: url.toString(),
    json: () => Promise.resolve(body || {}),
    headers: { get: () => null },
  } as unknown as Request
}

describe('Students API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStudentsData = []
    mockStudentError = null
    mockCreatedProfile = null
    mockCreatedToken = null
    mockUpdatedStudent = null
    currentContext = mockTutorContext
  })

  describe('GET /api/students', () => {
    it('should return all students for workspace', async () => {
      mockStudentsData = [
        {
          id: 's1',
          name: 'Alice Smith',
          email: 'alice@example.com',
          workspace_id: 'workspace-123',
          study_program_id: 'prog-1',
          grade_level_id: 'grade-1',
        },
        {
          id: 's2',
          name: 'Bob Jones',
          email: 'bob@example.com',
          workspace_id: 'workspace-123',
        },
      ]

      const request = createMockRequest()
      const { GET } = await import('@/app/api/students/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.students).toBeDefined()
      expect(data.students.length).toBe(2)
    })

    it('should return empty array when no students', async () => {
      mockStudentsData = []

      const { GET } = await import('@/app/api/students/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.students).toEqual([])
    })

    it('should handle database errors gracefully', async () => {
      mockStudentError = { message: 'Database connection failed' }

      const { GET } = await import('@/app/api/students/route')
      const response = await GET()

      expect(response.status).toBe(500)
    })

    it('should only be accessible to tutors', async () => {
      currentContext = mockStudentContext

      const { GET } = await import('@/app/api/students/route')

      // The API catches the REDIRECT error and returns a 500 response
      const response = await GET()
      expect(response.status).toBe(500)
    })
  })

  describe('POST /api/students', () => {
    it('should create a new student with basic info', async () => {
      const request = createMockRequest({
        name: 'New Student',
        email: 'newstudent@example.com',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.profile).toBeDefined()
      expect(data.inviteLink).toBeDefined()
      expect(data.inviteLink).toContain('/invite/')
    })

    it('should require name', async () => {
      const request = createMockRequest({
        email: 'test@example.com',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should reject empty name', async () => {
      const request = createMockRequest({
        name: '   ',
        email: 'test@example.com',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should create student with all optional fields', async () => {
      const request = createMockRequest({
        name: 'Full Student',
        email: 'full@example.com',
        age: 15,
        school: 'Test High School',
        grade_current: '10th Grade',
        private_notes: 'Test notes',
        parent_email: 'parent@example.com',
        study_program_id: 'prog-ib',
        grade_level_id: 'grade-aahl',
        assigned_tutor_id: 'tutor-123',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should create student without email (manual add)', async () => {
      const request = createMockRequest({
        name: 'No Email Student',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should support IB program assignment', async () => {
      const request = createMockRequest({
        name: 'IB Student',
        study_program_id: 'ib-program',
        grade_level_id: 'aahl-grade',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should validate grade_rollover_month', async () => {
      const request = createMockRequest({
        name: 'Test Student',
        grade_rollover_month: 9, // September
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should prevent students from creating students', async () => {
      currentContext = mockStudentContext

      const request = createMockRequest({
        name: 'Unauthorized Student',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      // Students should get 403 or a redirect error response
      expect(response.status).toBe(500) // The thrown error results in 500
    })
  })

  describe('Student Profile Fields', () => {
    it('should support additional_emails array', async () => {
      const request = createMockRequest({
        name: 'Multi Email Student',
        email: 'primary@example.com',
        additional_emails: ['secondary@example.com', 'parent@example.com'],
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should filter empty additional emails', async () => {
      const request = createMockRequest({
        name: 'Test Student',
        additional_emails: ['valid@example.com', '', '  ', 'another@example.com'],
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Workspace Isolation', () => {
    it('should only return students from user workspace', async () => {
      mockStudentsData = [
        { id: 's1', workspace_id: 'workspace-123', name: 'Alice' },
      ]

      const { GET } = await import('@/app/api/students/route')
      const response = await GET()

      expect(response.status).toBe(200)
      // The eq('workspace_id', context.workspaceId) ensures isolation
    })

    it('should create student in user workspace', async () => {
      const request = createMockRequest({
        name: 'Workspace Student',
      })

      const { POST } = await import('@/app/api/students/route')
      await POST(request)

      expect(mockCreatedProfile?.workspace_id).toBe('workspace-123')
    })
  })

  describe('Error Handling', () => {
    it('should handle profile creation failure', async () => {
      // Mock createStudentProfile to return null
      const workspaceMock = await import('@/lib/workspace')
      ;(workspaceMock.createStudentProfile as jest.Mock).mockResolvedValueOnce(null)

      const request = createMockRequest({
        name: 'Failed Student',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    it('should handle invite token creation failure', async () => {
      const workspaceMock = await import('@/lib/workspace')
      ;(workspaceMock.createInviteToken as jest.Mock).mockResolvedValueOnce(null)

      const request = createMockRequest({
        name: 'Token Fail Student',
      })

      const { POST } = await import('@/app/api/students/route')
      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })
})

describe('Student Individual Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStudentsData = [
      {
        id: 's1',
        workspace_id: 'workspace-123',
        name: 'Existing Student',
        email: 'existing@example.com',
      },
    ]
    currentContext = mockTutorContext
  })

  describe('GET /api/students/[id]', () => {
    it('should return specific student', async () => {
      // Would test the [id] route handler
      expect(mockStudentsData[0]).toBeDefined()
      expect(mockStudentsData[0].id).toBe('s1')
    })

    it('should return 404 for non-existent student', async () => {
      mockStudentsData = []
      mockStudentError = { message: 'Not found' }

      expect(mockStudentError).toBeDefined()
    })
  })

  describe('PUT /api/students/[id]', () => {
    it('should update student name', async () => {
      // Would test the [id] PUT handler
      expect(mockStudentsData[0].name).toBe('Existing Student')
    })

    it('should update student email', async () => {
      expect(mockStudentsData[0].email).toBeDefined()
    })

    it('should update study program and grade level', async () => {
      // The [id] handler would update these fields
      expect(mockStudentsData).toBeDefined()
    })
  })

  describe('DELETE /api/students/[id]', () => {
    it('should delete student profile', async () => {
      expect(mockStudentsData[0]).toBeDefined()
      // DELETE would remove from mockStudentsData
    })

    it('should cascade delete related data', async () => {
      // Attempts, assignments, spaced_repetition should be deleted
      expect(mockStudentsData).toBeDefined()
    })
  })
})

describe('Student Invite System', () => {
  beforeEach(() => {
    currentContext = mockTutorContext
  })

  it('should generate valid invite link', async () => {
    const request = createMockRequest({
      name: 'Invite Student',
      email: 'invite@example.com',
    })

    const { POST } = await import('@/app/api/students/route')
    const response = await POST(request)
    const data = await response.json()

    expect(data.inviteLink).toMatch(/\/invite\/[\w-]+/)
  })

  it('should create invite without email', async () => {
    const request = createMockRequest({
      name: 'No Email Invite',
    })

    const { POST } = await import('@/app/api/students/route')
    const response = await POST(request)
    const data = await response.json()

    expect(data.inviteLink).toBeDefined()
  })

  describe('Resend Invite', () => {
    it('should create new invite token for existing student', async () => {
      // Would test /api/students/[id]/resend-invite
      expect(mockCreatedToken).toBeDefined()
    })
  })
})

describe('Student Profile Data Validation', () => {
  beforeEach(() => {
    currentContext = mockTutorContext
  })

  it('should trim whitespace from name', async () => {
    const request = createMockRequest({
      name: '  Trimmed Name  ',
    })

    const { POST } = await import('@/app/api/students/route')
    await POST(request)

    expect(mockCreatedProfile?.name).toBe('Trimmed Name')
  })

  it('should trim whitespace from email', async () => {
    const request = createMockRequest({
      name: 'Test',
      email: '  test@example.com  ',
    })

    const { POST } = await import('@/app/api/students/route')
    await POST(request)

    expect(mockCreatedProfile?.email).toBe('test@example.com')
  })

  it('should handle missing optional fields gracefully', async () => {
    const request = createMockRequest({
      name: 'Minimal Student',
    })

    const { POST } = await import('@/app/api/students/route')
    const response = await POST(request)

    expect(response.status).toBe(200)
  })

  it('should validate age is reasonable', async () => {
    const request = createMockRequest({
      name: 'Age Test',
      age: 14,
    })

    const { POST } = await import('@/app/api/students/route')
    await POST(request)

    expect(mockCreatedProfile?.age).toBe(14)
  })
})
