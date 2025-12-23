import { createAdminClient } from '@/lib/supabase/server'
import type { Job, JobType, JobStatus } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

const WORKER_ID = `worker-${process.env.VERCEL_REGION || 'local'}-${uuidv4().slice(0, 8)}`

export interface EnqueueJobOptions {
  workspaceId: string
  userId?: string
  type: JobType
  payload: Record<string, unknown>
  priority?: number
  runAfter?: Date
}

// Enqueue a new job
export async function enqueueJob(options: EnqueueJobOptions): Promise<Job | null> {
  const supabase = await createAdminClient()
  
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      workspace_id: options.workspaceId,
      created_by_user_id: options.userId || null,
      type: options.type,
      status: 'pending',
      priority: options.priority || 0,
      payload_json: options.payload,
      run_after: options.runAfter?.toISOString() || new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    console.error('Failed to enqueue job:', error)
    return null
  }
  
  return data
}

// Claim jobs for processing (with locking)
export async function claimJobs(limit: number = 5): Promise<Job[]> {
  const supabase = await createAdminClient()
  const now = new Date().toISOString()
  const lockTimeout = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min timeout
  
  // Find and lock available jobs
  const { data: jobs, error } = await supabase
    .from('jobs')
    .update({
      status: 'processing',
      locked_at: now,
      locked_by: WORKER_ID,
    })
    .or(`status.eq.pending,and(status.eq.processing,locked_at.lt.${lockTimeout})`)
    .lte('run_after', now)
    .lt('attempts', 3)
    .order('priority', { ascending: false })
    .order('created_at')
    .limit(limit)
    .select()
  
  if (error) {
    console.error('Failed to claim jobs:', error)
    return []
  }
  
  return jobs || []
}

// Complete a job successfully
export async function completeJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<boolean> {
  const supabase = await createAdminClient()
  
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'completed' as JobStatus,
      result_json: result,
      locked_at: null,
      locked_by: null,
    })
    .eq('id', jobId)
  
  if (error) {
    console.error('Failed to complete job:', error)
    return false
  }
  
  return true
}

// Fail a job
export async function failJob(
  jobId: string,
  error: string,
  retry: boolean = true
): Promise<boolean> {
  const supabase = await createAdminClient()
  
  // Get current job to check attempts
  const { data: job } = await supabase
    .from('jobs')
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .single()
  
  const newAttempts = (job?.attempts || 0) + 1
  const maxAttempts = job?.max_attempts || 3
  const shouldRetry = retry && newAttempts < maxAttempts
  
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      status: shouldRetry ? 'pending' : 'failed',
      error_text: error,
      attempts: newAttempts,
      locked_at: null,
      locked_by: null,
      // Exponential backoff for retries
      run_after: shouldRetry 
        ? new Date(Date.now() + Math.pow(2, newAttempts) * 1000).toISOString()
        : undefined,
    })
    .eq('id', jobId)
  
  if (updateError) {
    console.error('Failed to update job status:', updateError)
    return false
  }
  
  return true
}

// Get job by ID
export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = await createAdminClient()
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()
  
  if (error) {
    return null
  }
  
  return data
}

// Get pending jobs count
export async function getPendingJobsCount(workspaceId?: string): Promise<number> {
  const supabase = await createAdminClient()
  
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId)
  }
  
  const { count } = await query
  
  return count || 0
}

// Enqueue batch job for OpenAI Batch API
export async function enqueueBatchJob(options: EnqueueJobOptions): Promise<Job | null> {
  const supabase = await createAdminClient()
  
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      workspace_id: options.workspaceId,
      created_by_user_id: options.userId || null,
      type: options.type,
      status: 'batch_pending',
      priority: options.priority || 0,
      payload_json: options.payload,
      run_after: options.runAfter?.toISOString() || new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    console.error('Failed to enqueue batch job:', error)
    return null
  }
  
  return data
}

// Update job with batch ID
export async function setBatchId(jobId: string, batchId: string): Promise<boolean> {
  const supabase = await createAdminClient()
  
  const { error } = await supabase
    .from('jobs')
    .update({ openai_batch_id: batchId })
    .eq('id', jobId)
  
  return !error
}
