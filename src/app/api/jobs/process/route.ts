import { NextResponse } from 'next/server'
import { processJobs } from '@/lib/jobs'

// Process pending jobs
// Can be called by cron or webhook
export async function POST(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const processed = await processJobs(10)
    
    return NextResponse.json({
      success: true,
      processed,
    })
  } catch (error) {
    console.error('Job processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process jobs' },
      { status: 500 }
    )
  }
}

// Get job processing status
export async function GET() {
  // This would return stats about pending jobs
  // For now, just return a health check
  return NextResponse.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  })
}
