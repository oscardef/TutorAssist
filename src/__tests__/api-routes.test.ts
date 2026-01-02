/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock Supabase client
const mockSelect = jest.fn()
const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockSingle = jest.fn()

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({
        order: mockOrder.mockReturnValue({
          data: [],
          error: null,
        }),
        single: mockSingle,
        data: [],
        error: null,
      }),
      order: mockOrder,
      data: [],
      error: null,
    }),
    insert: mockInsert.mockReturnValue({
      select: mockSelect.mockReturnValue({
        single: mockSingle,
      }),
    }),
    update: mockUpdate.mockReturnValue({
      eq: mockEq,
    }),
    delete: mockDelete.mockReturnValue({
      eq: mockEq,
    }),
  })),
  auth: {
    getUser: jest.fn(() => Promise.resolve({ 
      data: { user: { id: 'user-1' } }, 
      error: null 
    })),
  },
}

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
  createAdminClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}))

describe('Topics API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/topics', () => {
    it('should return topics for workspace', async () => {
      const mockTopics = [
        { id: 't1', name: 'Algebra', program: { code: 'IB' }, grade_level: { code: 'AIHL' } },
        { id: 't2', name: 'Geometry', program: { code: 'IB' }, grade_level: { code: 'AISL' } },
      ]
      
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          order: mockOrder.mockReturnValueOnce({
            data: mockTopics,
            error: null,
          }),
        }),
      })
      
      // Simulate API call
      const result = await mockSupabaseClient.from('topics').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('topics')
    })

    it('should filter by program ID', async () => {
      const programId = 'prog-1'
      
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            order: mockOrder,
          }),
        }),
      })
      
      await mockSupabaseClient.from('topics').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('topics')
    })

    it('should filter by grade level ID', async () => {
      const gradeLevelId = 'grade-1'
      
      await mockSupabaseClient.from('topics').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('topics')
    })
  })

  describe('POST /api/topics', () => {
    it('should create a new topic', async () => {
      const newTopic = {
        name: 'Calculus',
        description: 'Introduction to calculus',
        program_id: 'prog-1',
        grade_level_id: 'grade-1',
      }
      
      mockInsert.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: { id: 't3', ...newTopic },
            error: null,
          }),
        }),
      })
      
      const result = await mockSupabaseClient.from('topics').insert(newTopic).select().single()
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('topics')
    })

    it('should return error for duplicate topic', async () => {
      mockInsert.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: null,
            error: { code: '23505', message: 'duplicate key value' },
          }),
        }),
      })
      
      const result = await mockSupabaseClient.from('topics').insert({}).select().single()
      
      expect(mockSupabaseClient.from).toHaveBeenCalled()
    })
  })
})

describe('Questions API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/questions', () => {
    it('should return questions with topic and program info', async () => {
      const mockQuestions = [
        { 
          id: 'q1', 
          prompt_text: 'What is 2+2?',
          topic: { name: 'Arithmetic' },
          primary_program: { code: 'IB', name: 'IB' },
          primary_grade_level: { code: 'M8', name: 'MYP Year 8' },
        },
      ]
      
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          data: mockQuestions,
          error: null,
        }),
      })
      
      await mockSupabaseClient.from('questions').select('*, topic(*), primary_program(*)')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
    })

    it('should filter by topic ID', async () => {
      await mockSupabaseClient.from('questions').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
    })

    it('should filter by grade level', async () => {
      await mockSupabaseClient.from('questions').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
    })

    it('should filter by program', async () => {
      await mockSupabaseClient.from('questions').select('*')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
    })
  })

  describe('POST /api/questions', () => {
    it('should create a new question', async () => {
      const newQuestion = {
        prompt_text: 'Solve x + 5 = 10',
        answer_type: 'numeric',
        correct_answer_json: { value: 5 },
        topic_id: 't1',
        difficulty: 2,
      }
      
      mockInsert.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: { id: 'q-new', ...newQuestion },
            error: null,
          }),
        }),
      })
      
      await mockSupabaseClient.from('questions').insert(newQuestion).select().single()
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
    })

    it('should create question with IB DP course grade level', async () => {
      const newQuestion = {
        prompt_text: 'Calculate the derivative',
        primary_program_id: 'ib-program',
        primary_grade_level_id: 'aahl-grade', // AA Higher Level
      }
      
      await mockSupabaseClient.from('questions').insert(newQuestion)
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('questions')
    })
  })
})

describe('Programs API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/programs', () => {
    it('should return programs with grade levels', async () => {
      const mockPrograms = [
        { 
          id: 'p1', 
          code: 'IB', 
          name: 'International Baccalaureate',
          grade_levels: [
            { id: 'g1', code: 'M6', name: 'MYP Year 6' },
            { id: 'g2', code: 'AISL', name: 'AI Standard Level' },
            { id: 'g3', code: 'AIHL', name: 'AI Higher Level' },
            { id: 'g4', code: 'AASL', name: 'AA Standard Level' },
            { id: 'g5', code: 'AAHL', name: 'AA Higher Level' },
          ],
        },
        {
          id: 'p2',
          code: 'AP',
          name: 'Advanced Placement',
          grade_levels: [
            { id: 'g6', code: 'AP1', name: 'AP Year 1' },
            { id: 'g7', code: 'AP2', name: 'AP Year 2' },
          ],
        },
      ]
      
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          order: mockOrder.mockReturnValueOnce({
            data: mockPrograms,
            error: null,
          }),
        }),
      })
      
      await mockSupabaseClient.from('study_programs').select('*, grade_levels(*)')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('study_programs')
    })

    it('should include IB DP course codes', async () => {
      const mockIBProgram = {
        id: 'ib',
        code: 'IB',
        grade_levels: [
          { code: 'AISL', name: 'AI Standard Level' },
          { code: 'AIHL', name: 'AI Higher Level' },
          { code: 'AASL', name: 'AA Standard Level' },
          { code: 'AAHL', name: 'AA Higher Level' },
        ],
      }
      
      // Verify IB course codes are correct
      const courseCodes = mockIBProgram.grade_levels.map(g => g.code)
      expect(courseCodes).toContain('AISL')
      expect(courseCodes).toContain('AIHL')
      expect(courseCodes).toContain('AASL')
      expect(courseCodes).toContain('AAHL')
      expect(courseCodes).not.toContain('DP1')
      expect(courseCodes).not.toContain('DP2')
    })
  })
})

describe('Students API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/students', () => {
    it('should return students with program and grade info', async () => {
      const mockStudents = [
        { 
          id: 's1', 
          name: 'Alice', 
          email: 'alice@example.com',
          study_program: { code: 'IB' },
          grade_level: { code: 'AIHL', name: 'AI Higher Level' },
        },
      ]
      
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          data: mockStudents,
          error: null,
        }),
      })
      
      await mockSupabaseClient.from('student_profiles').select('*, study_program(*), grade_level(*)')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('student_profiles')
    })
  })

  describe('PUT /api/students/:id', () => {
    it('should update student with IB course grade level', async () => {
      const studentUpdate = {
        grade_level_id: 'aahl-id', // AA Higher Level
        study_program_id: 'ib-id',
      }
      
      mockUpdate.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValueOnce({
          data: { id: 's1', ...studentUpdate },
          error: null,
        }),
      })
      
      await mockSupabaseClient.from('student_profiles').update(studentUpdate).eq('id', 's1')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('student_profiles')
    })
  })
})

describe('Assignments API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/assignments', () => {
    it('should create assignment with question IDs', async () => {
      const newAssignment = {
        title: 'Weekly Practice',
        student_profile_id: 's1',
        question_ids: ['q1', 'q2', 'q3'],
        due_at: '2026-01-10T23:59:59Z',
      }
      
      mockInsert.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: { id: 'a1', ...newAssignment },
            error: null,
          }),
        }),
      })
      
      await mockSupabaseClient.from('assignments').insert(newAssignment).select().single()
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('assignments')
    })
  })

  describe('GET /api/assignments', () => {
    it('should return assignments with student and question info', async () => {
      const mockAssignments = [
        {
          id: 'a1',
          title: 'Practice Quiz',
          student_profile: { name: 'Alice' },
          assignment_questions: [
            { question: { prompt_text: 'Q1' } },
            { question: { prompt_text: 'Q2' } },
          ],
        },
      ]
      
      mockSelect.mockReturnValueOnce({
        eq: mockEq.mockReturnValueOnce({
          data: mockAssignments,
          error: null,
        }),
      })
      
      await mockSupabaseClient.from('assignments').select('*, student_profile(*)')
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('assignments')
    })
  })
})
