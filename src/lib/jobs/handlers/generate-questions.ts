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
  excludeQuestionIds?: string[] // Avoid duplicates
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
  difficulty: number // 1-5
  hints: string[]
  solutionSteps: string[]
  tags: string[]
}

const SYSTEM_PROMPT = `You are an expert math tutor and question generator. Generate high-quality practice questions that help students learn and build mastery.

CRITICAL: LaTeX Formatting Rules:
1. All math expressions MUST be wrapped in delimiters:
   - Use \\( ... \\) for inline math within sentences
   - Use \\[ ... \\] for display/block math equations
2. Plain text should NEVER contain raw LaTeX commands
3. In promptText, use words: "5 times 3" not "5 \\times 3"
4. In promptLatex, properly delimit: "Calculate \\(5 \\times 3\\)"
5. For fractions in text: "15 divided by 35" or "15/35"
6. For fractions in LaTeX: "Simplify \\(\\frac{15}{35}\\)"

Example correct formats:
- promptText: "A biologist models bacterial growth using N(t) = N0 * e^(kt). If the colony doubles every 3 hours, find k."
- promptLatex: "A biologist models bacterial growth using \\(N(t) = N_0 \\cdot e^{kt}\\). If the colony doubles every 3 hours, find \\(k\\)."

Guidelines:
1. Questions should be clear and unambiguous
2. Include step-by-step solution hints
3. Vary question styles: direct calculation, word problems, proofs, applications
4. Ensure answers are mathematically correct
5. Match difficulty to the requested level (1=easy, 2=medium-easy, 3=medium, 4=medium-hard, 5=hard)

Output JSON array with this structure for each question:
{
  "promptText": "The question text in PLAIN language (no LaTeX, use words)",
  "promptLatex": "Same question with math expressions wrapped in \\\\( \\\\) or \\\\[ \\\\] delimiters",
  "answerType": "exact|numeric|multiple_choice",
  "correctAnswer": {"value": "the answer", "tolerance": 0.01 (for numeric), "options": ["a","b","c","d"] (for multiple choice)},
  "difficulty": 1-5,
  "hints": ["hint 1", "hint 2"],
  "solutionSteps": ["step 1", "step 2"],
  "tags": ["relevant", "topic", "tags"]
}`

export async function handleGenerateQuestions(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as GenerateQuestionsPayload
  const { topicId, workspaceId, count, difficulty = 'mixed', style, fromMaterialId, excludeQuestionIds = [] } = payload
  
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
    
    // Generate questions
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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate ${count} practice questions for the topic: "${topic.name}"
          
Topic description: ${topic.description || 'N/A'}

${difficultyPrompt}
${stylePrompt}
${materialContext}
${avoidDuplicatesPrompt}

Return a JSON object with a "questions" array containing exactly ${count} questions.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.8,
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    const questions: GeneratedQuestion[] = result.questions || []
    
    if (questions.length === 0) {
      throw new Error('No questions generated')
    }
    
    // Filter out any duplicates
    const uniqueQuestions = questions.filter(q => {
      const normalized = q.promptText.toLowerCase().trim()
      return !existingPrompts.some(existing => 
        existing === normalized || 
        levenshteinSimilarity(existing, normalized) > 0.85
      )
    })
    
    if (uniqueQuestions.length === 0) {
      throw new Error('All generated questions were duplicates of existing ones')
    }
    
    // Insert questions into database with correct column names
    const questionsToInsert = uniqueQuestions.map((q) => ({
      workspace_id: workspaceId,
      topic_id: topicId,
      source_material_id: fromMaterialId || null,
      origin: 'ai_generated' as const,
      status: 'active' as const,
      prompt_text: q.promptText,
      prompt_latex: q.promptLatex || null,
      answer_type: q.answerType || 'exact',
      correct_answer_json: q.correctAnswer,
      difficulty: q.difficulty || 3,
      hints_json: q.hints || [],
      solution_steps_json: q.solutionSteps || [],
      tags_json: q.tags || [],
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
      questionsGenerated: uniqueQuestions.length,
      questionIds: insertedQuestions?.map((q) => q.id) || [],
      duplicatesFiltered: questions.length - uniqueQuestions.length,
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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate a variant of this math question:

Original question: ${original.prompt_text}
${original.prompt_latex ? `LaTeX: ${original.prompt_latex}` : ''}
Original answer: ${JSON.stringify(original.correct_answer_json)}
Topic: ${(original.topics as { name: string })?.name || 'Math'}
Current difficulty: ${original.difficulty}

${variationPrompt}
Target difficulty: ${difficultyAdjustment}

Create ONE new question that tests the same mathematical concept.

Return JSON with a single "question" object matching the format from the system prompt.`,
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
    
    // Insert variant with correct column names
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        workspace_id: original.workspace_id,
        topic_id: original.topic_id,
        parent_question_id: original.parent_question_id || original.id,
        origin: 'variant' as const,
        status: 'active' as const,
        prompt_text: variant.promptText,
        prompt_latex: variant.promptLatex || null,
        answer_type: variant.answerType || original.answer_type,
        correct_answer_json: variant.correctAnswer,
        difficulty: difficultyAdjustment,
        hints_json: variant.hints || [],
        solution_steps_json: variant.solutionSteps || [],
        tags_json: variant.tags || original.tags_json || [],
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
