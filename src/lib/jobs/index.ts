import type { Job, JobType } from '@/lib/types'
import { createAdminClient } from '@/lib/supabase/server'
import { handleExtractMaterial } from './handlers/extract-material'
import { handleGenerateQuestions, handleRegenVariant } from './handlers/generate-questions'
import { handleBatchGenerate, handleProcessBatchResult } from './handlers/batch-generate'
import { handleGeneratePdf } from './handlers/generate-pdf'
import { handleSyllabusBatchGenerate } from './handlers/syllabus-generate'
import { claimJobs } from './queue'

type JobHandler = (job: Job) => Promise<void>

// Placeholder for spaced repetition refresh (runs daily via cron)
async function handleDailySpacedRepRefresh(job: Job): Promise<void> {
  // This job refreshes spaced repetition queues for all students
  // In production, this would calculate new review items based on SM-2 algorithm
  console.log(`Processing daily spaced rep refresh for workspace ${job.workspace_id}`)
  // Implementation would go here
}

const handlers: Record<JobType, JobHandler> = {
  EXTRACT_MATERIAL: handleExtractMaterial,
  GENERATE_QUESTIONS: handleGenerateQuestions,
  GENERATE_QUESTIONS_BATCH: handleBatchGenerate,
  BATCH_GENERATE: handleSyllabusBatchGenerate,
  REGEN_VARIANT: handleRegenVariant,
  GENERATE_PDF: handleGeneratePdf,
  DAILY_SPACED_REP_REFRESH: handleDailySpacedRepRefresh,
  PROCESS_BATCH_RESULT: handleProcessBatchResult,
}

// Process a single job
async function processJob(job: Job): Promise<void> {
  const handler = handlers[job.type]
  
  if (!handler) {
    console.error(`No handler for job type: ${job.type}`)
    return
  }
  
  console.log(`Processing job ${job.id} (${job.type})`)
  
  try {
    await handler(job)
    console.log(`Job ${job.id} completed`)
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error)
    throw error
  }
}

// Process specific jobs by ID (for synchronous/immediate processing)
export async function processJobsById(jobIds: string[]): Promise<number> {
  if (jobIds.length === 0) return 0
  
  console.log(`[Jobs] Processing specific jobs: ${jobIds.join(', ')}`)
  
  const supabase = await createAdminClient()
  const now = new Date().toISOString()
  
  // Claim and fetch the specific jobs
  const { data: jobs, error } = await supabase
    .from('jobs')
    .update({
      status: 'processing',
      locked_at: now,
      locked_by: 'direct-process',
    })
    .in('id', jobIds)
    .eq('status', 'pending')
    .select()
  
  if (error) {
    console.error('[Jobs] Failed to claim specific jobs:', error)
    return 0
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('[Jobs] No pending jobs found with those IDs')
    return 0
  }
  
  console.log(`[Jobs] Claimed ${jobs.length} jobs for direct processing`)
  
  // Process jobs sequentially
  for (const job of jobs) {
    try {
      await processJob(job)
    } catch (error) {
      console.error(`[Jobs] Job ${job.id} processing error:`, error)
    }
  }
  
  console.log(`[Jobs] Finished processing ${jobs.length} jobs`)
  return jobs.length
}

// Process available jobs (called by API route or cron)
export async function processJobs(limit: number = 5): Promise<number> {
  console.log(`[Jobs] Starting to process up to ${limit} jobs...`)
  
  const jobs = await claimJobs(limit)
  
  if (jobs.length === 0) {
    console.log('[Jobs] No jobs to process')
    return 0
  }
  
  console.log(`[Jobs] Claimed ${jobs.length} jobs: ${jobs.map(j => `${j.id} (${j.type})`).join(', ')}`)
  
  // Process jobs sequentially to avoid overwhelming resources
  for (const job of jobs) {
    try {
      await processJob(job)
    } catch (error) {
      // Error handling is done in the handler
      console.error(`[Jobs] Job ${job.id} processing error:`, error)
    }
  }
  
  console.log(`[Jobs] Finished processing ${jobs.length} jobs`)
  return jobs.length
}

// Export handlers for direct use
export { handlers }
export * from './queue'
export { checkBatchStatus } from './handlers/batch-generate'
