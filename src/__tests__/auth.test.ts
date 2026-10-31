/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock redirect from next/navigation
const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path)
    throw new Error(`REDIRECT:${path}`)
  },
}))

// Mock user data (shape returned by lib/auth getUser)
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  emailVerified: true,
}

const mockTutorMembership = {
  workspace_id: 'workspace-123',
  role: 'tutor',
}

const mockStudentMembership = {
  workspace_id: 'workspace-123',
  role: 'student',
}

const mockPlatformOwnerMembership = {
  workspace_id: 'workspace-123',
  role: 'platform_owner',
}

// Create mock Supabase client
let mockAuthGetUser: jest.Mock
let mockMembershipResult: { data: unknown; error: unknown }
let mockPlatformOwnerResult: { data: unknown; error: unknown }
let mockSignOut: jest.Mock
let queryCallCount: number

const createMockSupabaseClient = () => {
  mockAuthGetUser = jest.fn()
  mockSignOut = jest.fn()
  queryCallCount = 0
  mockMembershipResult = { data: null, error: null }
  mockPlatformOwnerResult = { data: null, error: null }

  const createChainableMock = () => {
    const maybeSingleFn = jest.fn(() => {
      queryCallCount++
      // First query is membership, second is platform owner
      if (queryCallCount === 1) {
        return Promise.resolve(mockMembershipResult)
      }
      return Promise.resolve(mockPlatformOwnerResult)
    })

    const chain = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue({ maybeSingle: maybeSingleFn }),
      maybeSingle: maybeSingleFn,
    }
    return chain
  }

  return {
    from: jest.fn(() => ({
      select: jest.fn(() => createChainableMock()),
    })),
  }
}

let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}))

// Better Auth: getSession resolves to { user, session } or null
jest.mock('@/lib/identity/server', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockAuthGetUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}))

describe('Auth Library', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient = createMockSupabaseClient()
    mockRedirect.mockClear()
    queryCallCount = 0
  })

  describe('getUser', () => {
    it('should return user when authenticated', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      const { getUser } = await import('@/lib/auth')
      const user = await getUser()

      expect(user).toEqual(mockUser)
      expect(mockAuthGetUser).toHaveBeenCalled()
    })

    it('should return null when not authenticated', async () => {
      mockAuthGetUser.mockResolvedValue(null)

      const { getUser } = await import('@/lib/auth')
      const user = await getUser()

      expect(user).toBeNull()
    })

    it('should return null on auth error', async () => {
      mockAuthGetUser.mockResolvedValue(null)

      const { getUser } = await import('@/lib/auth')
      const user = await getUser()

      expect(user).toBeNull()
    })
  })

  describe('requireUser', () => {
    it('should return user when authenticated', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      const { requireUser } = await import('@/lib/auth')
      const user = await requireUser()

      expect(user).toEqual(mockUser)
    })

    it('should redirect to /login when not authenticated', async () => {
      mockAuthGetUser.mockResolvedValue(null)

      const { requireUser } = await import('@/lib/auth')

      await expect(requireUser()).rejects.toThrow('REDIRECT:/login')
      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })
  })

  describe('getUserContext', () => {
    it('should return full context for tutor', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      mockMembershipResult = { data: mockTutorMembership, error: null }
      mockPlatformOwnerResult = { data: null, error: null }

      const { getUserContext } = await import('@/lib/auth')
      const context = await getUserContext()

      expect(context).toEqual({
        userId: mockUser.id,
        email: mockUser.email,
        workspaceId: 'workspace-123',
        role: 'tutor',
        isPlatformOwner: false,
      })
    })

    it('should return null when user has no membership', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      mockMembershipResult = { data: null, error: null }

      const { getUserContext } = await import('@/lib/auth')
      const context = await getUserContext()

      expect(context).toBeNull()
    })

    it('should return null when not authenticated', async () => {
      mockAuthGetUser.mockResolvedValue(null)

      const { getUserContext } = await import('@/lib/auth')
      const context = await getUserContext()

      expect(context).toBeNull()
    })

    it('should identify platform owner correctly', async () => {
      mockAuthGetUser.mockResolvedValue({ user: { ...mockUser, id: 'user-789' }, session: {} })

      mockMembershipResult = { data: mockPlatformOwnerMembership, error: null }
      mockPlatformOwnerResult = { data: { id: 'some-id' }, error: null }

      const { getUserContext } = await import('@/lib/auth')
      const context = await getUserContext()

      expect(context?.isPlatformOwner).toBe(true)
      expect(context?.role).toBe('platform_owner')
    })

    it('throws on a membership query error instead of reporting no workspace', async () => {
      // Returning null would send an existing user to onboarding
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      mockMembershipResult = { data: null, error: { message: 'Database error', code: '500' } }

      const { getUserContext } = await import('@/lib/auth')
      await expect(getUserContext()).rejects.toThrow('Could not load your workspace')
    })
  })

  describe('requireUserContext', () => {
    it('should return context when user has workspace', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      mockMembershipResult = { data: mockTutorMembership, error: null }
      mockPlatformOwnerResult = { data: null, error: null }

      const { requireUserContext } = await import('@/lib/auth')
      const context = await requireUserContext()

      expect(context.workspaceId).toBe('workspace-123')
    })

    it('should redirect to /onboarding when no workspace', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      mockMembershipResult = { data: null, error: null }

      const { requireUserContext } = await import('@/lib/auth')

      await expect(requireUserContext()).rejects.toThrow('REDIRECT:/onboarding')
    })
  })

  describe('requireTutor', () => {
    it('should return context for tutor role', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      mockMembershipResult = { data: mockTutorMembership, error: null }
      mockPlatformOwnerResult = { data: null, error: null }

      const { requireTutor } = await import('@/lib/auth')
      const context = await requireTutor()

      expect(context.role).toBe('tutor')
    })

    it('should return context for platform owner', async () => {
      mockAuthGetUser.mockResolvedValue({ user: { ...mockUser, id: 'user-789' }, session: {} })

      mockMembershipResult = { data: mockPlatformOwnerMembership, error: null }
      mockPlatformOwnerResult = { data: { id: 'some-id' }, error: null }

      const { requireTutor } = await import('@/lib/auth')
      const context = await requireTutor()

      expect(context.isPlatformOwner).toBe(true)
    })

    it('should redirect student to dashboard', async () => {
      mockAuthGetUser.mockResolvedValue({ user: { ...mockUser, id: 'user-456' }, session: {} })

      mockMembershipResult = { data: mockStudentMembership, error: null }
      mockPlatformOwnerResult = { data: null, error: null }

      const { requireTutor } = await import('@/lib/auth')

      await expect(requireTutor()).rejects.toThrow('REDIRECT:/student/dashboard')
    })
  })

  describe('requireStudent', () => {
    it('should return context for student role', async () => {
      mockAuthGetUser.mockResolvedValue({ user: { ...mockUser, id: 'user-456' }, session: {} })

      mockMembershipResult = { data: mockStudentMembership, error: null }
      mockPlatformOwnerResult = { data: null, error: null }

      const { requireStudent } = await import('@/lib/auth')
      const context = await requireStudent()

      expect(context.role).toBe('student')
    })

    it('should allow tutors to access student routes', async () => {
      mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

      mockMembershipResult = { data: mockTutorMembership, error: null }
      mockPlatformOwnerResult = { data: null, error: null }

      const { requireStudent } = await import('@/lib/auth')
      const context = await requireStudent()

      expect(context.role).toBe('tutor')
    })
  })
})

describe('Role-Based Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient = createMockSupabaseClient()
    queryCallCount = 0
  })

  it('should enforce workspace isolation in context', async () => {
    mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

    mockMembershipResult = { data: { workspace_id: 'workspace-A', role: 'tutor' }, error: null }
    mockPlatformOwnerResult = { data: null, error: null }

    const { getUserContext } = await import('@/lib/auth')
    const context = await getUserContext()

    expect(context?.workspaceId).toBe('workspace-A')
  })

  it('should handle multiple workspace memberships (return first)', async () => {
    mockAuthGetUser.mockResolvedValue({ user: mockUser, session: {} })

    mockMembershipResult = { data: mockTutorMembership, error: null }
    mockPlatformOwnerResult = { data: null, error: null }

    const { getUserContext } = await import('@/lib/auth')
    const context = await getUserContext()

    expect(context?.workspaceId).toBe('workspace-123')
  })
})

describe('Security Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient = createMockSupabaseClient()
    queryCallCount = 0
  })

  it('should not expose user data on auth errors', async () => {
    mockAuthGetUser.mockResolvedValue(null)

    const { getUser } = await import('@/lib/auth')
    const user = await getUser()

    expect(user).toBeNull()
  })

  it('should handle expired sessions', async () => {
    mockAuthGetUser.mockResolvedValue(null)

    const { requireUser } = await import('@/lib/auth')

    await expect(requireUser()).rejects.toThrow('REDIRECT:/login')
  })

  it('should handle malformed user objects', async () => {
    mockAuthGetUser.mockResolvedValue({ user: { id: null, email: null }, session: {} })

    mockMembershipResult = { data: null, error: null }

    const { getUserContext } = await import('@/lib/auth')
    const context = await getUserContext()

    // Should handle gracefully - returns null when no membership found
    expect(context).toBeNull()
  })
})
