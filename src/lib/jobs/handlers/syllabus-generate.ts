import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import { completeJob, failJob } from '../queue'

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
  promptText: string
  promptLatex?: string
  answerType: 'exact' | 'numeric' | 'multiple_choice'
  correctAnswer: {
    value: string | number
    tolerance?: number
    options?: string[]
  }
  difficulty: number
  hints: string[]
  solutionSteps: string[]
  tags: string[]
}

const SYSTEM_PROMPT = `You are an expert math curriculum designer and question generator. Generate high-quality, curriculum-aligned practice questions.

Guidelines:
1. Questions should match the specified curriculum standards
2. Use clear, unambiguous language appropriate for the grade level
3. Include step-by-step solution hints for students
4. Use LaTeX for math expressions (wrap in \\( \\) for inline or \\[ \\] for display)
5. Vary question styles: direct calculation, word problems, proofs, applications
6. Ensure mathematical correctness
7. Match difficulty level (1=easy, 5=hard)

Output JSON with "questions" array. Each question has:
{
  "promptText": "Question text",
  "promptLatex": "LaTeX version if needed",
  "answerType": "exact|numeric|multiple_choice",
  "correctAnswer": {"value": "answer", "tolerance": 0.01, "options": ["a","b","c","d"]},
  "difficulty": 1-5,
  "hints": ["hint1", "hint2"],
  "solutionSteps": ["step1", "step2"],
  "tags": ["tag1", "tag2"]
}`

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
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const questions: GeneratedQuestion[] = result.questions || []
    
    if (questions.length === 0) {
      throw new Error('No questions generated')
    }
    
    // Insert questions into database
    const questionsToInsert = questions.map((q) => ({
      workspace_id: job.workspace_id,
      topic_id: topicId,
      origin: 'ai_generated' as const,
      status: 'active' as const,
      prompt_text: q.promptText,
      prompt_latex: q.promptLatex || null,
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
    }))
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('id')
    
    if (insertError) {
      throw new Error(`Failed to insert questions: ${insertError.message}`)
    }
    
    await completeJob(job.id, {
      success: true,
      topicId,
      topicName,
      questionsGenerated: insertedQuestions?.length || 0,
      questionIds: insertedQuestions?.map(q => q.id) || [],
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
