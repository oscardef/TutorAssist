/**
 * AI Usage Tracking Utility
 * 
 * Tracks AI API calls for cost analytics and optimization.
 * All AI operations should use this to log usage.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { estimateAICost } from '@/lib/types'

export interface AIUsageParams {
  workspaceId: string | null
  userId: string | null
  operationType: string
  model: string
  tokensInput: number
  tokensOutput: number
  durationMs: number
  success: boolean
  errorMessage?: string
  jobId?: string
  batchId?: string
  metadata?: Record<string, unknown>
}

/**
 * Log AI API usage for analytics
 */
export async function logAIUsage(params: AIUsageParams): Promise<void> {
  try {
    const supabase = await createAdminClient()
    
    const costUsd = estimateAICost(params.model, params.tokensInput, params.tokensOutput)
    
    await supabase.from('ai_usage_log').insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      operation_type: params.operationType,
      model: params.model,
      tokens_input: params.tokensInput,
      tokens_output: params.tokensOutput,
      tokens_total: params.tokensInput + params.tokensOutput,
      cost_usd: costUsd,
      duration_ms: params.durationMs,
      success: params.success,
      error_message: params.errorMessage || null,
      job_id: params.jobId || null,
      batch_id: params.batchId || null,
      metadata: params.metadata || {},
    })
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('[AIUsage] Failed to log AI usage:', error)
  }
}

/**
 * Create generation metadata for a question
 */
export interface GenerationMetadataParams {
  model: string
  promptVersion: string
  temperature?: number
  generatedAt?: Date
  jobId?: string
  batchId?: string
  tokensInput?: number
  tokensOutput?: number
  generationTimeMs?: number
  durationMs?: number // Alias for generationTimeMs
  validationPassed?: boolean
  autoFixesApplied?: string[]
  sourceContext?: {
    materialId?: string
    topicContext?: string
  }
  [key: string]: unknown // Allow additional properties
}

export function createGenerationMetadata(params: GenerationMetadataParams): Record<string, unknown> {
  const tokensIn = params.tokensInput || 0
  const tokensOut = params.tokensOutput || 0
  const genTime = params.generationTimeMs || params.durationMs || 0
  
  return {
    model: params.model,
    model_version: getModelVersion(params.model),
    prompt_version: params.promptVersion,
    temperature: params.temperature ?? 0.8,
    generated_at: (params.generatedAt || new Date()).toISOString(),
    job_id: params.jobId || null,
    batch_id: params.batchId || null,
    tokens_used: {
      input: tokensIn,
      output: tokensOut,
      total: tokensIn + tokensOut,
    },
    generation_time_ms: genTime,
    cost_usd: estimateAICost(params.model, tokensIn, tokensOut),
    validation_passed: params.validationPassed ?? true,
    auto_fixes_applied: params.autoFixesApplied || [],
    source_context: params.sourceContext || {},
  }
}

/**
 * Get model version string based on model name
 */
function getModelVersion(model: string): string {
  // Add known model versions
  const versions: Record<string, string> = {
    'gpt-4o': '2024-08-06',
    'gpt-4o-mini': '2024-07-18',
    'gpt-4-turbo': '2024-04-09',
    'text-embedding-3-small': '2024-01-25',
    'text-embedding-3-large': '2024-01-25',
  }
  return versions[model] || 'unknown'
}

/**
 * Constants for prompt versioning
 */
export const PROMPT_VERSIONS = {
  QUESTION_GENERATION: 'v2.1.0',
  QUESTION_GEN: 'v2.1.0', // Alias
  ASSIGNMENT_GENERATION: 'v1.2.0',
  SYLLABUS_GENERATION: 'v1.0.0',
  SYLLABUS_GEN: 'v1.0.0', // Alias
  EMBEDDING_GENERATION: 'v1.0.0',
} as const

/**
 * Standard model names
 */
export const AI_MODELS = {
  QUESTION_GENERATION: 'gpt-4o-mini',
  GPT4O_MINI: 'gpt-4o-mini', // Alias
  ASSIGNMENT_GENERATION: 'gpt-4o',
  GPT4O: 'gpt-4o', // Alias
  EMBEDDING: 'text-embedding-3-small',
} as const
