/**
 * Background worker: polls the jobs table and runs handlers from lib/jobs.
 * Replaces the "cron hits /api/jobs/process" design that only made sense on Vercel.
 *
 *   npx tsx src/worker.ts            (development)
 *   node .worker/worker.js           (container; built by `npm run build:worker`)
 */
import { processJobs } from '@/lib/jobs'
import { runAccountHygiene, ACCOUNT_HYGIENE_INTERVAL_MS } from '@/lib/lifecycle'

const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 5000)
const JOBS_PER_TICK = Number(process.env.WORKER_JOBS_PER_TICK || 5)

let stopping = false
// Daily: inactive-account warnings and deletions (first run a minute after start)
let nextHygiene = Date.now() + 60_000

async function tick() {
  if (Date.now() >= nextHygiene) {
    nextHygiene = Date.now() + ACCOUNT_HYGIENE_INTERVAL_MS
    try {
      const r = await runAccountHygiene()
      if (r.warned || r.deleted || r.skipped || r.reset) console.log(`[worker] accounts: ${r.warned} warned, ${r.deleted} deleted, ${r.skipped} skipped, ${r.reset} active again`)
    } catch (error) {
      console.error('[worker] account hygiene failed:', error)
    }
  }
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
