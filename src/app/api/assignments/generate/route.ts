import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { 
  ASSIGNMENT_GENERATION_SYSTEM_PROMPT,
  stripLatexToPlainText,
  normalizeAnswer,
} from '@/lib/prompts/question-generation'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface StudentHistory {
  topicsStruggled: { topicId: string; topicName: string; errorRate: number }[]
  recentTopics: string[]
  averageDifficulty: number
  totalAttempts: number
  overallAccuracy: number
}

interface GenerateAssignmentRequest {
  studentId?: string      // Legacy: single student
  studentIds?: string[]   // New: multiple students
  prompt?: string         // Legacy: AI prompt
  title?: string          // New: assignment title
  topicIds?: string[]     // Topics to draw questions from
  questionCount?: number
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive'
  dueDate?: string        // New: ISO date string
  instructions?: string   // New: instructions for students
  options?: {             // New: additional options
    timeLimit?: number | null
    shuffleQuestions?: boolean
    showResultsImmediately?: boolean
  }
  includeMarkscheme?: boolean
  includeSolutionSteps?: boolean
  focusOnWeakAreas?: boolean
}

interface SelectedQuestion {
  id: string
  promptText: string
  promptLatex?: string
  difficulty: number
  topicName: string
  answerType: string
  correctAnswer: unknown
  hints?: string[]
  solutionSteps?: unknown[]
  isGenerated?: boolean
}

interface GeneratedAssignment {
  title: string
  description: string
  questions: SelectedQuestion[]
  suggestedDueDate: string
  estimatedMinutes: number
  topicsCovered: string[]
  difficultyBreakdown: { easy: number; medium: number; hard: number }
}

// Get student's learning history and weak areas
async function getStudentHistory(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  studentProfileId: string,
  workspaceId: string
): Promise<StudentHistory> {
  // Get student profile to find user_id
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('user_id')
    .eq('id', studentProfileId)
    .single()

  if (!profile?.user_id) {
    return {
      topicsStruggled: [],
      recentTopics: [],
      averageDifficulty: 3,
      totalAttempts: 0,
      overallAccuracy: 0,
    }
  }

  // Get attempts with question info
  const { data: attempts } = await supabase
    .from('attempts')
    .select(`
      is_correct,
      question_id,
      questions!inner(
        difficulty,
        topic_id,
        topics(id, name)
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('student_user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!attempts || attempts.length === 0) {
    return {
      topicsStruggled: [],
      recentTopics: [],
      averageDifficulty: 3,
      totalAttempts: 0,
      overallAccuracy: 0,
    }
  }

  // Calculate topic performance
  const topicStats: Record<string, { correct: number; total: number; name: string }> = {}
  let totalCorrect = 0
  let totalDifficulty = 0
  const recentTopicIds: string[] = []

  for (const attempt of attempts) {
    const questions = attempt.questions as unknown as {
      difficulty: number
      topic_id: string
      topics: { id: string; name: string }[] | null
    }[] | null
    const question = questions?.[0]
    
    if (question?.topics?.[0]) {
      const topicId = question.topics[0].id
      const topicName = question.topics[0].name

      if (!topicStats[topicId]) {
        topicStats[topicId] = { correct: 0, total: 0, name: topicName }
      }
      topicStats[topicId].total++
      if (attempt.is_correct) {
        topicStats[topicId].correct++
        totalCorrect++
      }

      if (!recentTopicIds.includes(topicId) && recentTopicIds.length < 5) {
        recentTopicIds.push(topicId)
      }

      totalDifficulty += question.difficulty || 3
    }
  }

  // Find topics where student struggles (error rate > 40%)
  const topicsStruggled = Object.entries(topicStats)
    .map(([topicId, stats]) => ({
      topicId,
      topicName: stats.name,
      errorRate: 1 - (stats.correct / stats.total),
    }))
    .filter((t) => t.errorRate > 0.4 && topicStats[t.topicId].total >= 3)
    .sort((a, b) => b.errorRate - a.errorRate)

  return {
    topicsStruggled,
    recentTopics: recentTopicIds,
    averageDifficulty: totalDifficulty / attempts.length,
    totalAttempts: attempts.length,
    overallAccuracy: totalCorrect / attempts.length,
  }
}

// AI function to select and generate questions
async function generateAssignmentWithAI(
  prompt: string,
  studentHistory: StudentHistory,
  availableQuestions: SelectedQuestion[],
  topics: { id: string; name: string }[],
  options: GenerateAssignmentRequest
): Promise<GeneratedAssignment> {
  const targetCount = options.questionCount || 10
  const difficulty = options.difficulty || 'adaptive'
  
  // Build context about student for AI
  const studentContext = studentHistory.totalAttempts > 0
    ? `
Student Performance Context:
- Overall accuracy: ${Math.round(studentHistory.overallAccuracy * 100)}%
- Average difficulty handled: ${studentHistory.averageDifficulty.toFixed(1)}/5
- Topics they struggle with: ${studentHistory.topicsStruggled.map(t => `${t.topicName} (${Math.round(t.errorRate * 100)}% error rate)`).join(', ') || 'None identified'}
- Recent topics practiced: ${studentHistory.recentTopics.length > 0 ? 'Has recent practice history' : 'New student'}
${options.focusOnWeakAreas ? '- PRIORITY: Focus on weak areas to help improvement' : ''}
`
    : 'New student - no practice history available.'

  // Format available questions for AI
  const questionsContext = availableQuestions.slice(0, 50).map((q, i) => ({
    index: i,
    id: q.id,
    topic: q.topicName,
    difficulty: q.difficulty,
    preview: q.promptText.slice(0, 100),
  }))

  const topicsContext = topics.map(t => t.name).join(', ')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',  // Use cheaper model for assignment selection
    messages: [
      { role: 'system', content: ASSIGNMENT_GENERATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `
Tutor's Request: "${prompt}"

Target Question Count: ${targetCount}
Difficulty Setting: ${difficulty}
Include Solutions/Markscheme: ${options.includeMarkscheme ? 'Yes' : 'No'}
Include Step-by-Step: ${options.includeSolutionSteps ? 'Yes' : 'No'}

${studentContext}

Available Topics: ${topicsContext}

Available Questions from Question Bank:
${JSON.stringify(questionsContext, null, 2)}

Please create an assignment based on these requirements.
- Prefer selecting from existing questions when they match the requirements
- Only generate new questions if needed to fill gaps
- Remember: Use \\( \\) for inline math in any new questions`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    temperature: 0.7,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  // Map selected questions
  const selectedQuestions: SelectedQuestion[] = []
  
  // Add selected existing questions
  for (const idx of result.selectedQuestionIndices || []) {
    if (availableQuestions[idx]) {
      selectedQuestions.push(availableQuestions[idx])
    }
  }

  // Add newly generated questions - normalize them properly
  for (const newQ of result.newQuestions || []) {
    // Handle different field names from AI (questionLatex vs promptLatex)
    const questionText = newQ.questionLatex || newQ.promptLatex || newQ.promptText
    
    selectedQuestions.push({
      id: `generated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      promptText: stripLatexToPlainText(questionText),
      promptLatex: questionText,
      difficulty: Math.min(5, Math.max(1, newQ.difficulty || 3)),
      topicName: newQ.topicName,
      answerType: newQ.answerType || 'exact',
      correctAnswer: normalizeAnswer(newQ.correctAnswer, newQ.answerType || 'exact'),
      hints: Array.isArray(newQ.hints) ? newQ.hints : [],
      solutionSteps: Array.isArray(newQ.solutionSteps) ? newQ.solutionSteps : [],
      isGenerated: true,
    })
  }

  // Calculate difficulty breakdown
  const difficultyBreakdown = { easy: 0, medium: 0, hard: 0 }
  for (const q of selectedQuestions) {
    if (q.difficulty <= 2) difficultyBreakdown.easy++
    else if (q.difficulty <= 3) difficultyBreakdown.medium++
    else difficultyBreakdown.hard++
  }

  // Get unique topics covered
  const topicsCovered = [...new Set(selectedQuestions.map(q => q.topicName))]

  // Calculate suggested due date
  const suggestedDueDate = new Date()
  suggestedDueDate.setDate(suggestedDueDate.getDate() + (result.suggestedDueDays || 7))

  return {
    title: result.title || 'Practice Assignment',
    description: result.description || '',
    questions: selectedQuestions,
    suggestedDueDate: suggestedDueDate.toISOString().split('T')[0],
    estimatedMinutes: result.estimatedMinutes || selectedQuestions.length * 3,
    topicsCovered,
    difficultyBreakdown,
  }
}

// POST: Generate a new AI-powered assignment
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can generate assignments' }, { status: 403 })
  }

  try {
    const body: GenerateAssignmentRequest = await request.json()
    const {
      studentId,
      studentIds,
      prompt,
      title,
      topicIds,
      questionCount = 10,
      difficulty = 'adaptive',
      dueDate,
      instructions,
      options = {},
      includeMarkscheme = true,
      includeSolutionSteps = true,
      focusOnWeakAreas = false,
    } = body

    const supabase = await createServerClient()
    
    // Determine which students to create assignments for
    const targetStudentIds = studentIds?.length ? studentIds : studentId ? [studentId] : []
    
    // NEW FORMAT: Create assignments from topic questions for multiple students
    if (targetStudentIds.length > 0 && topicIds?.length) {
      // Get available questions from the selected topics
      let questionsQuery = supabase
        .from('questions')
        .select(`
          id,
          difficulty,
          topic_id
        `)
        .eq('workspace_id', context.workspaceId)
        .eq('status', 'active')
        .in('topic_id', topicIds)
      
      // Apply difficulty filter
      if (difficulty === 'easy') {
        questionsQuery = questionsQuery.lte('difficulty', 2)
      } else if (difficulty === 'medium') {
        questionsQuery = questionsQuery.gte('difficulty', 2).lte('difficulty', 4)
      } else if (difficulty === 'hard') {
        questionsQuery = questionsQuery.gte('difficulty', 4)
      }
      // For 'mixed' and 'adaptive', don't filter - include all difficulties
      
      const { data: questions, error: questionsError } = await questionsQuery
      
      if (questionsError) {
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
      }
      
      if (!questions || questions.length === 0) {
        return NextResponse.json({ 
          error: 'No questions found for the selected topics. Generate questions first.' 
        }, { status: 400 })
      }
      
      // Verify all students belong to workspace
      const { data: students, error: studentsError } = await supabase
        .from('student_profiles')
        .select('id, user_id, name')
        .eq('workspace_id', context.workspaceId)
        .in('id', targetStudentIds)
      
      if (studentsError || !students || students.length !== targetStudentIds.length) {
        return NextResponse.json({ error: 'Some students not found' }, { status: 404 })
      }
      
      // Create assignments for each student
      const createdAssignments: { studentId: string; studentName: string; assignmentId: string }[] = []
      
      for (const student of students) {
        // Select questions based on difficulty strategy
        let selectedQuestions = [...questions]
        
        // For 'mixed' difficulty, ensure variety across difficulty levels
        if (difficulty === 'mixed' && questions.length >= questionCount) {
          const easy = questions.filter(q => q.difficulty <= 2)
          const medium = questions.filter(q => q.difficulty > 2 && q.difficulty <= 4)
          const hard = questions.filter(q => q.difficulty > 4)
          
          // Aim for balanced distribution (roughly 1/3 each)
          const easyCount = Math.floor(questionCount / 3)
          const mediumCount = Math.floor(questionCount / 3)
          const hardCount = questionCount - easyCount - mediumCount
          
          selectedQuestions = [
            ...easy.sort(() => Math.random() - 0.5).slice(0, Math.min(easyCount, easy.length)),
            ...medium.sort(() => Math.random() - 0.5).slice(0, Math.min(mediumCount, medium.length)),
            ...hard.sort(() => Math.random() - 0.5).slice(0, Math.min(hardCount, hard.length)),
          ]
          
          // If we don't have enough in each category, fill from all
          if (selectedQuestions.length < questionCount) {
            const remaining = questions
              .filter(q => !selectedQuestions.find(sq => sq.id === q.id))
              .sort(() => Math.random() - 0.5)
              .slice(0, questionCount - selectedQuestions.length)
            selectedQuestions.push(...remaining)
          }
          
          // Shuffle the final selection
          if (options.shuffleQuestions !== false) {
            selectedQuestions = selectedQuestions.sort(() => Math.random() - 0.5)
          }
        } else {
          // Standard shuffle and slice
          if (options.shuffleQuestions !== false) {
            selectedQuestions = selectedQuestions.sort(() => Math.random() - 0.5)
          }
          selectedQuestions = selectedQuestions.slice(0, questionCount)
        }
        
        // Create the assignment
        const { data: assignment, error: assignmentError } = await supabase
          .from('assignments')
          .insert({
            workspace_id: context.workspaceId,
            created_by: user.id,
            student_profile_id: student.id,
            assigned_student_user_id: student.user_id,
            title: title || 'AI-Generated Assignment',
            description: instructions || null,
            due_at: dueDate || null,
            settings_json: {
              timeLimit: options.timeLimit || null,
              shuffleQuestions: options.shuffleQuestions ?? true,
              showResultsImmediately: options.showResultsImmediately ?? false,
              generatedFrom: 'ai-studio',
              topicIds,
            },
            status: 'active',
          })
          .select('id')
          .single()
        
        if (assignmentError || !assignment) {
          console.error('Failed to create assignment for student:', student.id, assignmentError)
          continue
        }
        
        // Create assignment items (link questions to assignment)
        const assignmentItems = selectedQuestions.map((q, idx) => ({
          workspace_id: context.workspaceId,
          assignment_id: assignment.id,
          question_id: q.id,
          order_index: idx,
          points: 1,
        }))
        
        await supabase.from('assignment_items').insert(assignmentItems)
        
        createdAssignments.push({
          studentId: student.id,
          studentName: student.name,
          assignmentId: assignment.id,
        })
      }
      
      return NextResponse.json({
        success: true,
        assignmentsCreated: createdAssignments.length,
        assignments: createdAssignments,
        message: `Created ${createdAssignments.length} assignment(s) with ${questionCount} questions each`,
      })
    }

    // LEGACY FORMAT: AI-powered assignment generation with prompt
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Please provide a prompt describing the assignment or select students and topics' }, { status: 400 })
    }

    // Verify student if specified
    if (studentId) {
      const { data: student, error: studentError } = await supabase
        .from('student_profiles')
        .select('id, name')
        .eq('id', studentId)
        .eq('workspace_id', context.workspaceId)
        .single()

      if (studentError || !student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }
    }

    // Get student history
    const studentHistory = studentId
      ? await getStudentHistory(supabase, studentId, context.workspaceId)
      : {
          topicsStruggled: [],
          recentTopics: [],
          averageDifficulty: 3,
          totalAttempts: 0,
          overallAccuracy: 0,
        }

    // Get available questions
    let questionsQuery = supabase
      .from('questions')
      .select(`
        id,
        prompt_text,
        prompt_latex,
        difficulty,
        answer_type,
        correct_answer_json,
        hints_json,
        solution_steps_json,
        topics!inner(id, name)
      `)
      .eq('workspace_id', context.workspaceId)
      .eq('status', 'active')
      .limit(100)

    if (topicIds && topicIds.length > 0) {
      questionsQuery = questionsQuery.in('topic_id', topicIds)
    }

    const { data: questions } = await questionsQuery

    const availableQuestions: SelectedQuestion[] = (questions || []).map((q) => ({
      id: q.id,
      promptText: q.prompt_text,
      promptLatex: q.prompt_latex || undefined,
      difficulty: q.difficulty || 3,
      topicName: ((q.topics as unknown as { name: string }[] | null)?.[0])?.name || 'Unknown',
      answerType: q.answer_type,
      correctAnswer: q.correct_answer_json,
      hints: q.hints_json as string[] || [],
      solutionSteps: q.solution_steps_json as unknown[] || [],
    }))

    // Get all topics
    const { data: topics } = await supabase
      .from('topics')
      .select('id, name')
      .eq('workspace_id', context.workspaceId)

    // Generate assignment with AI
    const assignment = await generateAssignmentWithAI(
      prompt,
      studentHistory,
      availableQuestions,
      topics || [],
      {
        studentId,
        prompt,
        questionCount,
        difficulty,
        includeMarkscheme,
        includeSolutionSteps,
        focusOnWeakAreas,
        topicIds,
      }
    )

    return NextResponse.json({
      success: true,
      assignment,
      studentHistory: {
        totalAttempts: studentHistory.totalAttempts,
        overallAccuracy: Math.round(studentHistory.overallAccuracy * 100),
        topicsStruggled: studentHistory.topicsStruggled.slice(0, 5),
      },
    })
  } catch (error) {
    console.error('Generate assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to generate assignment' },
      { status: 500 }
    )
  }
}
