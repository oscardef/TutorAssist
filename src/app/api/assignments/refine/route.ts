import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RefineRequest {
  assignment: {
    title: string
    description: string
    questions: Array<{
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
    }>
    suggestedDueDate: string
    estimatedMinutes: number
    topicsCovered: string[]
  }
  refinementPrompt: string
  studentId?: string
}

// POST: Refine an existing assignment with AI
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can refine assignments' }, { status: 403 })
  }

  try {
    const body: RefineRequest = await request.json()
    const { assignment, refinementPrompt } = body

    if (!refinementPrompt?.trim()) {
      return NextResponse.json({ error: 'Please provide refinement instructions' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get available questions for potential additions
    const { data: questions } = await supabase
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
      .limit(50)

    const availableQuestions = (questions || []).map((q, idx) => ({
      index: idx,
      id: q.id,
      topic: ((q.topics as unknown as { name: string }[] | null)?.[0])?.name,
      difficulty: q.difficulty,
      preview: q.prompt_text.slice(0, 100),
      full: {
        promptText: q.prompt_text,
        promptLatex: q.prompt_latex,
        difficulty: q.difficulty || 3,
        topicName: ((q.topics as unknown as { name: string }[] | null)?.[0])?.name || 'Unknown',
        answerType: q.answer_type,
        correctAnswer: q.correct_answer_json,
        hints: q.hints_json || [],
        solutionSteps: q.solution_steps_json || [],
      },
    }))

    const systemPrompt = `You are an expert educational AI assistant helping tutors refine assignments.

You will be given an existing assignment and refinement instructions. Your job is to:
1. Understand what changes the tutor wants
2. Modify the assignment accordingly
3. You can: remove questions, reorder questions, modify questions, add new questions

Output a JSON object with this structure:
{
  "title": "Updated title (or keep same)",
  "description": "Updated description (or keep same)",
  "questions": [
    // Include ALL questions for the refined assignment
    // For existing questions, include them as-is with their original id
    // For new questions, use id: "generated-xxx"
    {
      "id": "original-id or generated-xxx",
      "promptText": "Question text",
      "promptLatex": "LaTeX if applicable",
      "difficulty": 1-5,
      "topicName": "Topic name",
      "answerType": "exact|numeric|multiple_choice",
      "correctAnswer": {"value": "answer"},
      "hints": ["hint1"],
      "solutionSteps": [{"step": "Step 1", "result": "result"}],
      "isGenerated": true/false
    }
  ],
  "suggestedDueDate": "YYYY-MM-DD",
  "estimatedMinutes": number,
  "changesMade": "Brief summary of what was changed"
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `
Current Assignment:
Title: ${assignment.title}
Description: ${assignment.description}
Due Date: ${assignment.suggestedDueDate}
Estimated Time: ${assignment.estimatedMinutes} minutes
Topics: ${assignment.topicsCovered.join(', ')}

Current Questions:
${JSON.stringify(assignment.questions.map((q, i) => ({
  index: i,
  id: q.id,
  topic: q.topicName,
  difficulty: q.difficulty,
  text: q.promptText,
  isGenerated: q.isGenerated,
})), null, 2)}

Additional Questions Available (can add from these):
${JSON.stringify(availableQuestions.slice(0, 30).map(q => ({
  bankIndex: q.index,
  id: q.id,
  topic: q.topic,
  difficulty: q.difficulty,
  preview: q.preview,
})), null, 2)}

Tutor's Refinement Request: "${refinementPrompt}"

Please refine the assignment based on the tutor's request.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.7,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    // Process the refined questions - fill in full data for existing questions
    const refinedQuestions = (result.questions || []).map((q: {
      id: string
      promptText?: string
      promptLatex?: string
      difficulty?: number
      topicName?: string
      answerType?: string
      correctAnswer?: unknown
      hints?: string[]
      solutionSteps?: unknown[]
      isGenerated?: boolean
    }) => {
      // Check if it's an existing question from the original assignment
      const existingQ = assignment.questions.find(eq => eq.id === q.id)
      if (existingQ && !q.promptText) {
        return existingQ
      }

      // Check if it's from the question bank
      const bankQ = availableQuestions.find(bq => bq.id === q.id)
      if (bankQ && !q.promptText) {
        return {
          id: bankQ.id,
          ...bankQ.full,
          isGenerated: false,
        }
      }

      // It's either a modified or new question
      return {
        id: q.id || `generated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        promptText: q.promptText,
        promptLatex: q.promptLatex,
        difficulty: q.difficulty || 3,
        topicName: q.topicName || 'General',
        answerType: q.answerType || 'exact',
        correctAnswer: q.correctAnswer || { value: '' },
        hints: q.hints || [],
        solutionSteps: q.solutionSteps || [],
        isGenerated: q.isGenerated !== false,
      }
    })

    // Calculate difficulty breakdown
    const difficultyBreakdown = { easy: 0, medium: 0, hard: 0 }
    for (const q of refinedQuestions) {
      if (q.difficulty <= 2) difficultyBreakdown.easy++
      else if (q.difficulty <= 3) difficultyBreakdown.medium++
      else difficultyBreakdown.hard++
    }

    const topicsCovered = [...new Set(refinedQuestions.map((q: { topicName: string }) => q.topicName))]

    return NextResponse.json({
      success: true,
      assignment: {
        title: result.title || assignment.title,
        description: result.description || assignment.description,
        questions: refinedQuestions,
        suggestedDueDate: result.suggestedDueDate || assignment.suggestedDueDate,
        estimatedMinutes: result.estimatedMinutes || refinedQuestions.length * 3,
        topicsCovered,
        difficultyBreakdown,
      },
      changesMade: result.changesMade || 'Assignment refined',
    })
  } catch (error) {
    console.error('Refine assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to refine assignment' },
      { status: 500 }
    )
  }
}
