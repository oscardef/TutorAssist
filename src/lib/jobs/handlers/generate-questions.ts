import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import { completeJob, failJob } from '../queue'
import { 
  QUESTION_GENERATION_SYSTEM_PROMPT, 
  validateQuestionLatex,
  stripLatexToPlainText,
  normalizeAnswer,
  type GeneratedQuestion 
} from '@/lib/prompts/question-generation'

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
  excludeQuestionIds?: string[]
}

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
    
    // Get existing questions to avoid duplicates
    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('prompt_text')
      .eq('workspace_id', workspaceId)
      .eq('topic_id', topicId)
      .limit(50)
    
    const existingPrompts = existingQuestions?.map(q => q.prompt_text.toLowerCase().trim()) || []
    
    // Get source material context if specified
    let materialContext = ''
    if (fromMaterialId) {
      const { data: material } = await supabase
        .from('source_materials')
        .select('extracted_text')
        .eq('id', fromMaterialId)
        .single()
      
      if (material?.extracted_text) {
        materialContext = `\n\nBase questions on this source material:\n${material.extracted_text.slice(0, 4000)}`
      }
    }
    
    // Generate questions using centralized prompt
    const difficultyPrompt = difficulty === 'mixed'
      ? 'Include a mix of difficulties (1-5 scale).'
      : `All questions should be ${difficulty === 'easy' ? '1-2' : difficulty === 'medium' ? '3' : '4-5'} difficulty.`
    
    const stylePrompt = style ? `Question style preference: ${style}` : ''
    
    const avoidDuplicatesPrompt = existingPrompts.length > 0
      ? `\n\nIMPORTANT: Avoid generating questions similar to these existing ones:\n${existingPrompts.slice(0, 10).join('\n')}`
      : ''
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUESTION_GENERATION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate ${count} practice questions for the topic: "${topic.name}"
          
Topic description: ${topic.description || 'N/A'}

${difficultyPrompt}
${stylePrompt}
${materialContext}
${avoidDuplicatesPrompt}

Return a JSON object with a "questions" array containing exactly ${count} questions.
Remember: Use \\( \\) for inline math and \\[ \\] for display math. Include the "latex" field in all answers.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.7,  // Lower temperature for more consistent output
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const questions: GeneratedQuestion[] = result.questions || []
    
    if (questions.length === 0) {
      throw new Error('No questions generated')
    }
    
    // Validate and filter questions
    const validQuestions: GeneratedQuestion[] = []
    const invalidQuestions: { question: GeneratedQuestion; errors: string[] }[] = []
    
    for (const q of questions) {
      const validation = validateQuestionLatex(q)
      if (validation.valid) {
        validQuestions.push(q)
      } else {
        // Try to auto-fix minor issues
        const fixed = attemptAutoFix(q)
        const revalidation = validateQuestionLatex(fixed)
        if (revalidation.valid) {
          validQuestions.push(fixed)
        } else {
          invalidQuestions.push({ question: q, errors: revalidation.errors })
          console.warn('Invalid question filtered:', revalidation.errors)
        }
      }
    }
    
    // Filter out duplicates
    const uniqueQuestions = validQuestions.filter(q => {
      const normalized = stripLatexToPlainText(q.questionLatex).toLowerCase().trim()
      return !existingPrompts.some(existing => 
        existing === normalized || 
        levenshteinSimilarity(existing, normalized) > 0.85
      )
    })
    
    if (uniqueQuestions.length === 0) {
      throw new Error(`No valid questions after validation. ${invalidQuestions.length} failed validation.`)
    }
    
    // Insert questions with proper formatting
    const questionsToInsert = uniqueQuestions.map((q) => ({
      workspace_id: workspaceId,
      topic_id: topicId,
      source_material_id: fromMaterialId || null,
      origin: 'ai_generated' as const,
      status: 'active' as const,  // Active by default - flagging handles issues
      prompt_text: stripLatexToPlainText(q.questionLatex),
      prompt_latex: q.questionLatex,
      answer_type: q.answerType || 'exact',
      correct_answer_json: normalizeAnswer(q.correctAnswer, q.answerType),
      difficulty: Math.min(5, Math.max(1, q.difficulty || 3)),
      hints_json: q.hints || [],
      solution_steps_json: q.solutionSteps || [],
      tags_json: q.tags || [],
      quality_score: 1.0,  // Starts at 1.0, can decrease with flags
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
      questionsGenerated: uniqueQuestions.length,
      questionIds: insertedQuestions?.map((q) => q.id) || [],
      duplicatesFiltered: validQuestions.length - uniqueQuestions.length,
      invalidFiltered: invalidQuestions.length,
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

/**
 * Attempt to auto-fix common issues in generated questions
 */
function attemptAutoFix(q: GeneratedQuestion): GeneratedQuestion {
  const fixed = { ...q }
  
  // Ensure questionLatex has proper delimiters for math content
  if (!/\\\(|\\\[/.test(fixed.questionLatex)) {
    // Try to detect and wrap math content
    fixed.questionLatex = fixed.questionLatex.replace(
      /(\d+\s*[+\-*/×÷=]\s*\d+|\d*x\s*[+\-*/×÷=]\s*\d+|[a-z]\s*[+\-*/×÷=]\s*[a-z\d]+)/gi,
      '\\($1\\)'
    )
  }
  
  // Ensure answer has latex field
  if (!fixed.correctAnswer.latex && fixed.correctAnswer.value !== undefined) {
    const val = String(fixed.correctAnswer.value)
    fixed.correctAnswer = {
      ...fixed.correctAnswer,
      latex: `\\(${val}\\)`
    }
  }
  
  // Ensure hints is an array
  if (!Array.isArray(fixed.hints)) {
    fixed.hints = fixed.hints ? [String(fixed.hints)] : ['Think about what the question is asking.']
  }
  
  // Ensure solutionSteps is an array
  if (!Array.isArray(fixed.solutionSteps)) {
    fixed.solutionSteps = [{ step: 'Solve the problem', latex: fixed.correctAnswer.latex || '' }]
  }
  
  // Clamp difficulty
  fixed.difficulty = Math.min(5, Math.max(1, fixed.difficulty || 3))
  
  return fixed
}

// Simple Levenshtein similarity for duplicate detection
function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0) return b.length === 0 ? 1 : 0
  if (b.length === 0) return 0
  
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  const maxLen = Math.max(a.length, b.length)
  return 1 - matrix[b.length][a.length] / maxLen
}

// Regenerate a variant of an existing question
export async function handleRegenVariant(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as { questionId: string; variationType?: 'similar' | 'harder' | 'easier' }
  const { questionId, variationType = 'similar' } = payload
  
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
    
    const difficultyAdjustment = variationType === 'harder' 
      ? Math.min(original.difficulty + 1, 5)
      : variationType === 'easier'
      ? Math.max(original.difficulty - 1, 1)
      : original.difficulty
    
    const variationPrompt = variationType === 'harder'
      ? 'Make this variant MORE CHALLENGING - add complexity, extra steps, or trickier numbers.'
      : variationType === 'easier'
      ? 'Make this variant EASIER - simpler numbers, fewer steps, more straightforward.'
      : 'Create a similar variant with different numbers/context but same difficulty.'
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUESTION_GENERATION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate a variant of this math question:

Original question: ${original.prompt_latex || original.prompt_text}
Original answer: ${JSON.stringify(original.correct_answer_json)}
Topic: ${(original.topics as { name: string })?.name || 'Math'}
Current difficulty: ${original.difficulty}

${variationPrompt}
Target difficulty: ${difficultyAdjustment}

Create ONE new question that tests the same mathematical concept.

Return JSON with a single "question" object (not a "questions" array).
Remember: Use \\( \\) for inline math. Include the "latex" field in the answer.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0.8,
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const variant: GeneratedQuestion = result.question
    
    if (!variant) {
      throw new Error('No variant generated')
    }
    
    // Validate and auto-fix
    const validation = validateQuestionLatex(variant)
    let finalVariant = variant
    if (!validation.valid) {
      finalVariant = attemptAutoFix(variant)
      const revalidation = validateQuestionLatex(finalVariant)
      if (!revalidation.valid) {
        console.warn('Variant validation warnings:', revalidation.errors)
        // Proceed anyway with fixed version
      }
    }
    
    // Insert variant
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        workspace_id: original.workspace_id,
        topic_id: original.topic_id,
        parent_question_id: original.parent_question_id || original.id,
        origin: 'variant' as const,
        status: 'active' as const,
        prompt_text: stripLatexToPlainText(finalVariant.questionLatex),
        prompt_latex: finalVariant.questionLatex,
        answer_type: finalVariant.answerType || original.answer_type,
        correct_answer_json: normalizeAnswer(finalVariant.correctAnswer, finalVariant.answerType),
        difficulty: difficultyAdjustment,
        hints_json: finalVariant.hints || [],
        solution_steps_json: finalVariant.solutionSteps || [],
        tags_json: finalVariant.tags || original.tags_json || [],
        quality_score: 1.0,
        created_by: job.created_by_user_id,
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
      variationType,
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
