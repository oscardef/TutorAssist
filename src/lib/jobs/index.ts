import type { Job, JobType } from '@/lib/types'
import { handleExtractMaterial } from './handlers/extract-material'
import { handleGenerateQuestions, handleRegenVariant } from './handlers/generate-questions'
import { handleBatchGenerate, handleProcessBatchResult } from './handlers/batch-generate'
import { handleGeneratePdf } from './handlers/generate-pdf'
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

// Process available jobs (called by API route or cron)
export async function processJobs(limit: number = 5): Promise<number> {
  const jobs = await claimJobs(limit)
  
  if (jobs.length === 0) {
    return 0
  }
  
  console.log(`Processing ${jobs.length} jobs`)
  
  // Process jobs sequentially to avoid overwhelming resources
  for (const job of jobs) {
    try {
      await processJob(job)
    } catch (error) {
      // Error handling is done in the handler
      console.error(`Job ${job.id} processing error:`, error)
    }
  }
  
  return jobs.length
}

// Export handlers for direct use
export { handlers }
export * from './queue'
export { checkBatchStatus } from './handlers/batch-generate'
