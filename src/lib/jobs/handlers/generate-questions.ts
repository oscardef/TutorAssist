import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import { completeJob, failJob } from '../queue'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface GenerateQuestionsPayload {
  topicId: string
  workspaceId: string
  count: number
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'
  style?: string
  fromMaterialId?: string
}

interface GeneratedQuestion {
  questionLatex: string
  answerLatex: string
  difficulty: 'easy' | 'medium' | 'hard'
  hints: string[]
  solutionSteps: string[]
  tags: string[]
}

const SYSTEM_PROMPT = `You are an expert math tutor and question generator. Generate high-quality practice questions that help students learn and build mastery.

Guidelines:
1. Questions should be clear and unambiguous
2. Include step-by-step solution hints
3. Use LaTeX for all math expressions (wrap in \\( \\) for inline or \\[ \\] for display)
4. Vary question styles: direct calculation, word problems, proofs, applications
5. Ensure answers are mathematically correct
6. Match difficulty to the requested level

Output JSON array with this structure for each question:
{
  "questionLatex": "The question text with LaTeX math",
  "answerLatex": "The complete answer with LaTeX",
  "difficulty": "easy|medium|hard",
  "hints": ["hint 1", "hint 2", ...],
  "solutionSteps": ["step 1", "step 2", ...],
  "tags": ["relevant", "topic", "tags"]
}`

export async function handleGenerateQuestions(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as GenerateQuestionsPayload
  const { topicId, workspaceId, count, difficulty = 'mixed', style, fromMaterialId } = payload
  
  try {
    const supabase = await createAdminClient()
    
    // Get topic info
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('*')
      .eq('id', topicId)
      .single()
    
    if (topicError || !topic) {
      throw new Error(`Topic not found: ${topicId}`)
    }
    
    // Get source material context if specified
    let materialContext = ''
    if (fromMaterialId) {
      const { data: material } = await supabase
        .from('source_materials')
        .select('extracted_text, topics_json')
        .eq('id', fromMaterialId)
        .single()
      
      if (material?.extracted_text) {
        materialContext = `\n\nBase questions on this source material:\n${material.extracted_text.slice(0, 4000)}`
      }
    }
    
    // Generate questions
    const difficultyPrompt = difficulty === 'mixed'
      ? 'Include a mix of easy, medium, and hard questions.'
      : `All questions should be ${difficulty} difficulty.`
    
    const stylePrompt = style
      ? `Question style preference: ${style}`
      : ''
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate ${count} practice questions for the topic: "${topic.name}"
          
Topic description: ${topic.description || 'N/A'}

${difficultyPrompt}
${stylePrompt}
${materialContext}

Return a JSON object with a "questions" array containing exactly ${count} questions.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.8, // Some creativity for variety
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const questions: GeneratedQuestion[] = result.questions || []
    
    if (questions.length === 0) {
      throw new Error('No questions generated')
    }
    
    // Insert questions into database
    const questionsToInsert = questions.map((q) => ({
      workspace_id: workspaceId,
      topic_id: topicId,
      source_material_id: fromMaterialId || null,
      ai_generated: true,
      question_latex: q.questionLatex,
      answer_latex: q.answerLatex,
      difficulty: q.difficulty,
      hints_json: q.hints,
      solution_steps_json: q.solutionSteps,
      tags: q.tags,
      quality_score: 1.0, // Default score for new questions
    }))
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('id')
    
    if (insertError) {
      throw new Error(`Failed to insert questions: ${insertError.message}`)
    }
    
    // Update topic question count
    await supabase.rpc('increment_topic_question_count', {
      topic_id_param: topicId,
      increment_by: questions.length,
    })
    
    await completeJob(job.id, {
      success: true,
      questionsGenerated: questions.length,
      questionIds: insertedQuestions?.map((q) => q.id) || [],
    })
  } catch (error) {
    console.error('Generate questions failed:', error)
    await failJob(
      job.id,
      error instanceof Error ? error.message : 'Unknown error',
      true
    )
  }
}

// Regenerate a variant of an existing question
export async function handleRegenVariant(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as { questionId: string }
  const { questionId } = payload
  
  try {
    const supabase = await createAdminClient()
    
    // Get original question
    const { data: original, error } = await supabase
      .from('questions')
      .select('*, topics(name, description)')
      .eq('id', questionId)
      .single()
    
    if (error || !original) {
      throw new Error(`Question not found: ${questionId}`)
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate a variant of this math question that tests the same concept but with different numbers/context:

Original question: ${original.question_latex}
Original answer: ${original.answer_latex}
Topic: ${(original.topics as { name: string })?.name || 'Math'}
Difficulty: ${original.difficulty}

Create ONE new question that:
1. Tests the same mathematical concept
2. Has different numbers/values
3. Maintains the same difficulty level
4. Could optionally have a different context (word problem vs direct calculation, etc.)

Return JSON with a single "question" object.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0.9,
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const variant: GeneratedQuestion = result.question
    
    if (!variant) {
      throw new Error('No variant generated')
    }
    
    // Insert variant
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        workspace_id: original.workspace_id,
        topic_id: original.topic_id,
        parent_question_id: original.parent_question_id || original.id,
        ai_generated: true,
        question_latex: variant.questionLatex,
        answer_latex: variant.answerLatex,
        difficulty: variant.difficulty || original.difficulty,
        hints_json: variant.hints,
        solution_steps_json: variant.solutionSteps,
        tags: variant.tags || original.tags,
        quality_score: 1.0,
      })
      .select('id')
      .single()
    
    if (insertError) {
      throw new Error(`Failed to insert variant: ${insertError.message}`)
    }
    
    await completeJob(job.id, {
      success: true,
      variantId: newQuestion?.id,
      originalId: questionId,
    })
  } catch (error) {
    console.error('Regen variant failed:', error)
    await failJob(
      job.id,
      error instanceof Error ? error.message : 'Unknown error',
      true
    )
  }
}
