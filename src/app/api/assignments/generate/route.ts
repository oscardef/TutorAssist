import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

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
  studentId: string
  prompt: string
  questionCount?: number
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive'
  includeMarkscheme?: boolean
  includeSolutionSteps?: boolean
  focusOnWeakAreas?: boolean
  topicIds?: string[] // Optional specific topics to focus on
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

  const systemPrompt = `You are an expert educational AI assistant helping tutors create personalized assignments for students.

Your task is to:
1. Analyze the tutor's prompt to understand what kind of assignment they want
2. Consider the student's learning history and weak areas
3. Select appropriate questions from the available question bank
4. If needed, generate NEW questions to fill gaps (you'll specify these)
5. Create a well-balanced, pedagogically sound assignment

Guidelines:
- For adaptive difficulty: Start easier, progress harder
- For weak area focus: Include remedial questions on struggled topics
- Ensure topic variety unless specifically focused
- Include a mix of question types when possible
- New questions should follow proper LaTeX formatting for math
- Generated questions should have proper hints and solution steps

Output a JSON object with this structure:
{
  "title": "A descriptive title for the assignment",
  "description": "Brief description of what this assignment covers",
  "reasoning": "Brief explanation of your selection strategy",
  "selectedQuestionIndices": [0, 3, 5], // Indices from the provided question bank
  "newQuestions": [
    {
      "promptText": "Question text",
      "promptLatex": "LaTeX version if needed",
      "difficulty": 1-5,
      "topicName": "Topic this belongs to",
      "answerType": "exact|numeric|multiple_choice",
      "correctAnswer": {"value": "answer"},
      "hints": ["hint 1", "hint 2"],
      "solutionSteps": [{"step": "Step 1", "result": "result"}]
    }
  ],
  "suggestedDueDays": 7,
  "estimatedMinutes": 30
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
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

Please create an assignment based on these requirements.`,
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

  // Add newly generated questions
  for (const newQ of result.newQuestions || []) {
    selectedQuestions.push({
      id: `generated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      promptText: newQ.promptText,
      promptLatex: newQ.promptLatex,
      difficulty: newQ.difficulty || 3,
      topicName: newQ.topicName,
      answerType: newQ.answerType || 'exact',
      correctAnswer: newQ.correctAnswer,
      hints: newQ.hints || [],
      solutionSteps: newQ.solutionSteps || [],
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
      prompt,
      questionCount = 10,
      difficulty = 'adaptive',
      includeMarkscheme = true,
      includeSolutionSteps = true,
      focusOnWeakAreas = false,
      topicIds,
    } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Please provide a prompt describing the assignment' }, { status: 400 })
    }

    const supabase = await createServerClient()

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
