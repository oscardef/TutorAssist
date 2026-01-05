import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import { completeJob, failJob, setBatchId } from '../queue'
import { logAIUsage, createGenerationMetadata, AI_MODELS, PROMPT_VERSIONS } from '@/lib/ai-usage'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface BatchGeneratePayload {
  requests: {
    topicId: string
    workspaceId: string
    count: number
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  }[]
}

interface BatchRequest {
  custom_id: string
  method: 'POST'
  url: '/v1/chat/completions'
  body: {
    model: string
    messages: Array<{ role: string; content: string }>
    response_format: { type: 'json_object' }
    max_tokens: number
    temperature: number
  }
}

const SYSTEM_PROMPT = `You are an expert math tutor. Generate practice questions with perfect LaTeX formatting.

CRITICAL LaTeX Rules:
- The "questionLatex" field is PRIMARY - use \\( \\) for inline math, \\[ \\] for display math
- "answerLatex" should also use proper delimiters
- Regular text stays plain, only wrap actual math expressions

CORRECT EXAMPLES:
- "Solve for \\(x\\): \\(3x - 7 = 14\\)"
- "Calculate \\(\\frac{2}{3} \\times \\frac{5}{4}\\)"
- "Find the area of a circle with radius \\(r = 5\\) cm."

Output JSON with "questions" array. Each question has:
- questionLatex: string (question with properly delimited LaTeX)
- answerLatex: string (answer with LaTeX if needed, e.g., "\\(\\frac{3}{4}\\)")
- answerValue: string | number (the raw answer value)
- answerType: "exact" | "numeric" | "multiple_choice" | "expression"
- difficulty: "easy" | "medium" | "hard"
- hints: string[] (with LaTeX where appropriate)
- solutionSteps: {step: string, latex?: string}[]
- tags: string[]`

// Strip LaTeX for plain text version
function stripLatex(text: string): string {
  return text
    .replace(/\\\[|\\\]/g, '')
    .replace(/\\\(|\\\)/g, '')
    .replace(/\$\$?/g, '')
    // Handle text commands BEFORE removing commands - extract content
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\mbox\{([^}]*)\}/g, '$1')
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

export async function handleBatchGenerate(job: Job): Promise<void> {
  const payload = job.payload_json as unknown as BatchGeneratePayload
  const { requests } = payload
  
  try {
    const supabase = await createAdminClient()
    
    // Get topic info for all requests
    const topicIds = [...new Set(requests.map((r) => r.topicId))]
    const { data: topics } = await supabase
      .from('topics')
      .select('id, name, description')
      .in('id', topicIds)
    
    const topicMap = new Map(topics?.map((t) => [t.id, t]) || [])
    
    // Build batch requests
    const batchRequests: BatchRequest[] = requests.map((req, index) => {
      const topic = topicMap.get(req.topicId)
      const difficultyPrompt = req.difficulty === 'mixed'
        ? 'Include a mix of easy, medium, and hard questions.'
        : `All questions should be ${req.difficulty} difficulty.`
      
      return {
        custom_id: `req-${index}-topic-${req.topicId}`,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Generate ${req.count} questions for "${topic?.name || 'Math'}".
              
Description: ${topic?.description || 'Practice questions'}

${difficultyPrompt}

Return JSON with "questions" array of exactly ${req.count} questions.`,
            },
          ],
          response_format: { type: 'json_object' as const },
          max_tokens: 4000,
          temperature: 0.8,
        },
      }
    })
    
    // Create JSONL content
    const jsonlContent = batchRequests.map((r) => JSON.stringify(r)).join('\n')
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' })
    
    // Upload file to OpenAI
    const file = await openai.files.create({
      file: new File([blob], 'batch_requests.jsonl', { type: 'application/jsonl' }),
      purpose: 'batch',
    })
    
    // Create batch
    const batch = await openai.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: {
        job_id: job.id,
        workspace_id: requests[0]?.workspaceId || '',
      },
    })
    
    // Store batch ID in job
    await setBatchId(job.id, batch.id)
    
    // Update job status to batch_processing
    await supabase
      .from('jobs')
      .update({
        status: 'batch_processing',
        result_json: {
          batchId: batch.id,
          fileId: file.id,
          requestCount: requests.length,
          status: batch.status,
        },
      })
      .eq('id', job.id)
    
    // Note: Batch results will be processed by a separate webhook/polling job
    console.log(`Batch created: ${batch.id} for job ${job.id}`)
    
    // Log batch submission (actual usage will be logged when batch completes)
    await logAIUsage({
      workspaceId: requests[0]?.workspaceId || job.workspace_id,
      userId: job.created_by_user_id,
      operationType: 'batch_generate_submit',
      model: AI_MODELS.GPT4O_MINI,
      tokensInput: 0, // Not known until batch completes
      tokensOutput: 0,
      durationMs: 0,
      success: true,
      batchId: batch.id,
      jobId: job.id,
      metadata: {
        requestCount: requests.length,
        totalQuestionsRequested: requests.reduce((sum, r) => sum + r.count, 0),
      },
    })
  } catch (error) {
    console.error('Batch generate failed:', error)
    await failJob(
      job.id,
      error instanceof Error ? error.message : 'Unknown error',
      true
    )
  }
}

// Check batch status and process results
export async function checkBatchStatus(jobId: string): Promise<boolean> {
  const supabase = await createAdminClient()
  
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()
  
  if (!job || !job.openai_batch_id) {
    return false
  }
  
  try {
    const batch = await openai.batches.retrieve(job.openai_batch_id)
    
    if (batch.status === 'completed' && batch.output_file_id) {
      // Download results
      const fileResponse = await openai.files.content(batch.output_file_id)
      const content = await fileResponse.text()
      const results = content.split('\n').filter(Boolean).map((line) => JSON.parse(line))
      
      // Process each result
      const payload = job.payload_json as unknown as BatchGeneratePayload
      
      for (const result of results) {
        const customId = result.custom_id as string
        const indexMatch = customId.match(/req-(\d+)-topic-(.+)/)
        if (!indexMatch) continue
        
        const reqIndex = parseInt(indexMatch[1])
        const request = payload.requests[reqIndex]
        if (!request) continue
        
        const responseContent = result.response?.body?.choices?.[0]?.message?.content
        if (!responseContent) continue
        
        try {
          const parsed = JSON.parse(responseContent)
          const questions = parsed.questions || []
          
          // Map difficulty strings to numbers
          const difficultyMap: Record<string, number> = {
            'easy': 2,
            'medium': 3,
            'hard': 4
          }
          
          // Insert questions with proper field mapping
          const questionsToInsert = questions.map((q: {
            questionLatex: string
            answerLatex?: string
            answerValue?: string | number
            answerType?: string
            difficulty: string | number
            hints: string[]
            solutionSteps: { step: string; latex?: string }[] | string[]
            tags: string[]
          }) => ({
            workspace_id: request.workspaceId,
            topic_id: request.topicId,
            origin: 'ai_generated' as const,
            status: 'active' as const,
            prompt_text: stripLatex(q.questionLatex),
            prompt_latex: q.questionLatex,
            answer_type: q.answerType || 'exact',
            correct_answer_json: {
              value: q.answerValue || q.answerLatex,
              latex: q.answerLatex,
            },
            difficulty: typeof q.difficulty === 'number' 
              ? q.difficulty 
              : (difficultyMap[q.difficulty] || 3),
            hints_json: q.hints || [],
            solution_steps_json: q.solutionSteps || [],
            tags_json: q.tags || [],
            quality_score: 1.0,
            created_by: job.created_by_user_id,
            generation_metadata: createGenerationMetadata({
              model: AI_MODELS.GPT4O_MINI,
              promptVersion: PROMPT_VERSIONS.QUESTION_GEN,
              batchId: batch.id,
            }),
          }))
          
          await supabase.from('questions').insert(questionsToInsert)
        } catch (parseError) {
          console.error('Failed to parse batch result:', parseError)
        }
      }
      
      await completeJob(jobId, {
        success: true,
        batchId: batch.id,
        totalProcessed: results.length,
      })
      
      return true
    } else if (batch.status === 'failed' || batch.status === 'expired' || batch.status === 'cancelled') {
      await failJob(jobId, `Batch ${batch.status}`, false)
      return true
    }
    
    // Still processing
    return false
  } catch (error) {
    console.error('Check batch status failed:', error)
    return false
  }
}

// Handler for processing batch results manually (called by cron or webhook)
export async function handleProcessBatchResult(job: Job): Promise<void> {
  const processed = await checkBatchStatus(job.id)
  
  if (!processed) {
    // Batch still processing, re-queue for later
    console.log(`Batch for job ${job.id} still processing, will check again later`)
    throw new Error('Batch still processing')
  }
}
