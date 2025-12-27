import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface CleanupResult {
  questionsProcessed: number
  latexConverted: number
  duplicateColumnsFixed: number
  errors: string[]
}

// Clean up and normalize question data
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can run data cleanup' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === 'true'
  const batchSize = parseInt(searchParams.get('batchSize') || '50')
  
  const supabase = await createServerClient()
  const result: CleanupResult = {
    questionsProcessed: 0,
    latexConverted: 0,
    duplicateColumnsFixed: 0,
    errors: [],
  }
  
  try {
    // Fetch questions that might need cleanup
    const { data: questions, error: fetchError } = await supabase
      .from('questions')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .limit(batchSize)
    
    if (fetchError) {
      throw new Error(`Failed to fetch questions: ${fetchError.message}`)
    }
    
    if (!questions || questions.length === 0) {
      return NextResponse.json({ 
        message: 'No questions to process',
        result 
      })
    }
    
    for (const question of questions) {
      result.questionsProcessed++
      
      try {
        const updates: Record<string, unknown> = {}
        
        // 1. Check if prompt needs LaTeX conversion
        if (question.prompt_text && !question.prompt_latex) {
          const needsLatex = containsMathContent(question.prompt_text)
          if (needsLatex) {
            const latex = await convertToLatex(question.prompt_text)
            if (latex) {
              updates.prompt_latex = latex
              result.latexConverted++
            }
          }
        }
        
        // 2. Clean up answer - convert to proper format with LaTeX if needed
        if (question.correct_answer_json) {
          const answer = question.correct_answer_json
          if (typeof answer.value === 'string' && containsMathContent(answer.value)) {
            const cleanedAnswer = cleanMathAnswer(answer.value)
            if (cleanedAnswer !== answer.value) {
              updates.correct_answer_json = {
                ...answer,
                value: cleanedAnswer,
              }
            }
          }
        }
        
        // 3. Clean up hints - convert to LaTeX if needed
        if (question.hints_json && Array.isArray(question.hints_json)) {
          const cleanedHints = question.hints_json.map((hint: string) => {
            if (containsMathContent(hint)) {
              return cleanMathAnswer(hint)
            }
            return hint
          })
          
          if (JSON.stringify(cleanedHints) !== JSON.stringify(question.hints_json)) {
            updates.hints_json = cleanedHints
          }
        }
        
        // 4. Clean up solution steps
        if (question.solution_steps_json && Array.isArray(question.solution_steps_json)) {
          const cleanedSteps = question.solution_steps_json.map((step: { step: string; result?: string }) => ({
            step: containsMathContent(step.step) ? cleanMathAnswer(step.step) : step.step,
            result: step.result && containsMathContent(step.result) ? cleanMathAnswer(step.result) : step.result,
          }))
          
          if (JSON.stringify(cleanedSteps) !== JSON.stringify(question.solution_steps_json)) {
            updates.solution_steps_json = cleanedSteps
          }
        }
        
        // 5. Normalize column naming (if old columns exist, migrate data)
        // This handles cases where data might be in different columns
        if (question.hints && !question.hints_json) {
          updates.hints_json = question.hints
          result.duplicateColumnsFixed++
        }
        if (question.solution_steps && !question.solution_steps_json) {
          updates.solution_steps_json = question.solution_steps
          result.duplicateColumnsFixed++
        }
        if (question.tags && !question.tags_json) {
          updates.tags_json = question.tags
          result.duplicateColumnsFixed++
        }
        
        // Apply updates if any
        if (Object.keys(updates).length > 0 && !dryRun) {
          updates.updated_at = new Date().toISOString()
          
          const { error: updateError } = await supabase
            .from('questions')
            .update(updates)
            .eq('id', question.id)
          
          if (updateError) {
            result.errors.push(`Question ${question.id}: ${updateError.message}`)
          }
        }
      } catch (questionError) {
        result.errors.push(`Question ${question.id}: ${questionError instanceof Error ? questionError.message : 'Unknown error'}`)
      }
    }
    
    return NextResponse.json({
      message: dryRun ? 'Dry run completed' : 'Cleanup completed',
      result,
    })
  } catch (error) {
    console.error('Data cleanup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed', result },
      { status: 500 }
    )
  }
}

// Check if text contains mathematical content that should be LaTeX
function containsMathContent(text: string): boolean {
  const mathPatterns = [
    /\d+\s*[\+\-\*\/\×\÷]\s*\d+/, // Simple arithmetic
    /\d+\s*[=<>≤≥≠]\s*\d+/, // Comparisons
    /\^[\d\w]/, // Exponents
    /sqrt|√/, // Square roots
    /\d+\/\d+/, // Fractions
    /[πθαβγ]/, // Greek letters
    /\bx\b|\by\b|\bz\b/, // Variables
    /sin|cos|tan|log|ln/, // Functions
    /\d+\s*(m|cm|mm|km|kg|g|mg|s|h|min)/, // Units
  ]
  
  return mathPatterns.some(pattern => pattern.test(text))
}

// Clean up math answer to use proper LaTeX formatting
function cleanMathAnswer(text: string): string {
  let cleaned = text
  
  // Convert common math symbols to LaTeX
  cleaned = cleaned
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/√(\d+)/g, '\\sqrt{$1}')
    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/(\d+)\^(\d+)/g, '$1^{$2}')
    .replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}')
    .replace(/≤/g, '\\leq ')
    .replace(/≥/g, '\\geq ')
    .replace(/≠/g, '\\neq ')
    .replace(/π/g, '\\pi ')
    .replace(/θ/g, '\\theta ')
    .replace(/α/g, '\\alpha ')
    .replace(/β/g, '\\beta ')
    .replace(/γ/g, '\\gamma ')
  
  // Wrap in math delimiters if not already
  if (!cleaned.startsWith('$') && /\\[a-zA-Z]+/.test(cleaned)) {
    cleaned = `$${cleaned}$`
  }
  
  return cleaned
}

// Use AI to convert complex text to proper LaTeX
async function convertToLatex(text: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a math LaTeX converter. Convert the given text to proper LaTeX format.
Rules:
- Wrap mathematical expressions in $ delimiters
- Use proper LaTeX commands (\\frac, \\sqrt, \\times, etc.)
- Keep non-math text as-is
- Return only the converted text, no explanations
- If the text doesn't need LaTeX, return it unchanged`
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
    })
    
    return response.choices[0]?.message?.content?.trim() || null
  } catch (error) {
    console.error('LaTeX conversion error:', error)
    return null
  }
}

// Get cleanup status/stats
export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  
  const supabase = await createServerClient()
  
  // Get stats about questions that might need cleanup
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, prompt_text, prompt_latex, correct_answer_json, hints_json, solution_steps_json')
    .eq('workspace_id', context.workspaceId)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  const stats = {
    total: questions?.length || 0,
    missingLatex: 0,
    needsAnswerCleanup: 0,
    needsHintCleanup: 0,
  }
  
  for (const q of questions || []) {
    if (q.prompt_text && !q.prompt_latex && containsMathContent(q.prompt_text)) {
      stats.missingLatex++
    }
    if (q.correct_answer_json?.value && typeof q.correct_answer_json.value === 'string' && containsMathContent(q.correct_answer_json.value)) {
      stats.needsAnswerCleanup++
    }
    if (q.hints_json && Array.isArray(q.hints_json)) {
      if (q.hints_json.some((h: string) => containsMathContent(h))) {
        stats.needsHintCleanup++
      }
    }
  }
  
  return NextResponse.json({ stats })
}
