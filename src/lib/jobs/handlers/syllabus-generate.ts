import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import { completeJob, failJob } from '../queue'
import { logAIUsage, createGenerationMetadata, AI_MODELS, PROMPT_VERSIONS } from '@/lib/ai-usage'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface SyllabusBatchPayload {
  topicId: string
  topicName: string
  count: number
  difficulties: number[]
  subtopics?: string[]
  syllabusContext?: {
    curriculum: string
    grade: string
    courseTitle: string
  }
}

interface GeneratedQuestion {
  questionLatex: string
  answerType: 'exact' | 'numeric' | 'multiple_choice' | 'expression'
  correctAnswer: {
    value: string | number
    latex?: string
    tolerance?: number
    choices?: { text: string; latex?: string }[]
    correct?: number
  }
  difficulty: number
  hints: string[]
  solutionSteps: { step: string; latex?: string }[]
  tags: string[]
}

const SYSTEM_PROMPT = `You are an expert math curriculum designer and question generator. Generate high-quality, curriculum-aligned practice questions.

CRITICAL LaTeX Rules:
1. The "questionLatex" field is PRIMARY - use \\( \\) for inline math, \\[ \\] for display math
2. Regular text stays plain, only wrap actual math expressions in delimiters
3. Include proper LaTeX in hints and solution steps where math appears

CORRECT EXAMPLES:
- "Solve for \\(x\\) in the equation \\(2x + 5 = 13\\)."
- "Calculate \\(\\frac{3}{4} + \\frac{2}{5}\\) and simplify."
- "Find all values of \\(\\theta\\) where \\(\\sin(\\theta) = \\frac{1}{2}\\) for \\(0 \\leq \\theta < 2\\pi\\)."

Guidelines:
1. Questions should match the specified curriculum standards
2. Use clear, unambiguous language appropriate for the grade level
3. Include 2-3 step-by-step hints for students
4. Include complete solution steps with LaTeX
5. Vary question styles: direct calculation, word problems, proofs, applications
6. Ensure mathematical correctness
7. Match difficulty level (1=basic, 2=easy, 3=medium, 4=hard, 5=challenging)

Output JSON with "questions" array. Each question has:
{
  "questionLatex": "Question with \\\\( \\\\) or \\\\[ \\\\] LaTeX delimiters",
  "answerType": "exact|numeric|multiple_choice|expression",
  "correctAnswer": {"value": "answer", "latex": "\\\\(LaTeX\\\\)", "tolerance": 0.01},
  "difficulty": 1-5,
  "hints": ["hint with \\\\(LaTeX\\\\) if needed"],
  "solutionSteps": [{"step": "description", "latex": "\\\\(math\\\\)"}],
  "tags": ["tag1", "tag2"]
}`

// Strip LaTeX for plain text version
function stripLatex(text: string): string {
  return text
    .replace(/\\\[|\\\]/g, '')
    .replace(/\\\(|\\\)/g, '')
    .replace(/\$\$?/g, '')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function handleSyllabusBatchGenerate(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as SyllabusBatchPayload
  const { topicId, topicName, count, difficulties, subtopics, syllabusContext } = payload
  
  try {
    const supabase = await createAdminClient()
    
    // Build context prompt
    let contextPrompt = ''
    if (syllabusContext) {
      contextPrompt = `
Curriculum: ${syllabusContext.curriculum}
Grade Level: ${syllabusContext.grade}
Course: ${syllabusContext.courseTitle}
`
    }
    
    const subtopicsPrompt = subtopics && subtopics.length > 0
      ? `\nSubtopics to cover: ${subtopics.join(', ')}`
      : ''
    
    // Calculate difficulty distribution string
    const difficultyDist = difficulties.reduce((acc, d) => {
      acc[d] = (acc[d] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    const difficultyPrompt = Object.entries(difficultyDist)
      .map(([level, cnt]) => `${cnt} questions at difficulty ${level}`)
      .join(', ')
    
    const startTime = Date.now()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate ${count} practice questions for:

Topic: ${topicName}
${contextPrompt}
${subtopicsPrompt}

Difficulty distribution: ${difficultyPrompt}

Generate exactly ${count} questions with the specified difficulty distribution.
Return a JSON object with a "questions" array.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
      temperature: 0.8,
    })
    const generationTimeMs = Date.now() - startTime
    
    const tokensInput = response.usage?.prompt_tokens || 0
    const tokensOutput = response.usage?.completion_tokens || 0
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const questions: GeneratedQuestion[] = result.questions || []
    
    if (questions.length === 0) {
      throw new Error('No questions generated')
    }
    
    // Insert questions into database with proper field mapping
    const questionsToInsert = questions.map((q) => ({
      workspace_id: job.workspace_id,
      topic_id: topicId,
      origin: 'ai_generated' as const,
      status: 'active' as const,
      prompt_text: stripLatex(q.questionLatex),
      prompt_latex: q.questionLatex,
      answer_type: q.answerType || 'exact',
      correct_answer_json: q.correctAnswer,
      difficulty: q.difficulty || 3,
      hints_json: q.hints || [],
      solution_steps_json: q.solutionSteps || [],
      tags_json: [
        ...(q.tags || []),
        topicName,
        ...(syllabusContext ? [syllabusContext.curriculum, syllabusContext.grade] : [])
      ],
      quality_score: 1.0,
      created_by: job.created_by_user_id,
      generation_metadata: createGenerationMetadata({
        model: AI_MODELS.GPT4O,
        promptVersion: PROMPT_VERSIONS.SYLLABUS_GEN,
        tokensInput,
        tokensOutput,
        durationMs: generationTimeMs,
        syllabusContext,
        subtopics,
      }),
    }))
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('id')
    
    if (insertError) {
      throw new Error(`Failed to insert questions: ${insertError.message}`)
    }
    
    // Log AI usage
    await logAIUsage({
      workspaceId: job.workspace_id,
      userId: job.created_by_user_id,
      operationType: 'syllabus_generate',
      model: AI_MODELS.GPT4O,
      tokensInput,
      tokensOutput,
      durationMs: generationTimeMs,
      success: true,
      jobId: job.id,
      metadata: {
        topicId,
        topicName,
        questionsRequested: count,
        questionsGenerated: insertedQuestions?.length || 0,
        syllabusContext,
        subtopics,
      },
    })
    
    await completeJob(job.id, {
      success: true,
      topicId,
      topicName,
      questionsGenerated: insertedQuestions?.length || 0,
      questionIds: insertedQuestions?.map(q => q.id) || [],
      tokensUsed: tokensInput + tokensOutput,
      generationTimeMs,
    })
    
  } catch (error) {
    console.error('Syllabus batch generate failed:', error)
    await failJob(
      job.id,
      error instanceof Error ? error.message : 'Unknown error',
      true
    )
  }
}
