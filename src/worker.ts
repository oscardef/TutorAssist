/**
 * Background worker: polls the jobs table and runs handlers from lib/jobs.
 * Replaces the "cron hits /api/jobs/process" design that only made sense on Vercel.
 *
 *   npx tsx src/worker.ts            (development)
 *   node .worker/worker.js           (container; built by `npm run build:worker`)
 */
import { processJobs } from '@/lib/jobs'

const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 5000)
const JOBS_PER_TICK = Number(process.env.WORKER_JOBS_PER_TICK || 5)

let stopping = false

async function tick() {
  try {
    const processed = await processJobs(JOBS_PER_TICK)
    if (processed > 0) console.log(`[worker] processed ${processed} job(s)`)
  } catch (error) {
    console.error('[worker] processJobs failed:', error)
  }
}

async function main() {
  console.log(`[worker] started; polling every ${POLL_MS} ms`)
  while (!stopping) {
    await tick()
    await new Promise(resolve => setTimeout(resolve, POLL_MS))
  }
  console.log('[worker] stopped')
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true
  })
}

main().catch(error => {
  console.error('[worker] fatal:', error)
  process.exit(1)
})
