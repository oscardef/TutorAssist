import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { enqueueJob, enqueueBatchJob, getJob } from '@/lib/jobs'
import { createServerClient } from '@/lib/supabase/server'

// Enqueue question generation job
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can generate questions' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const {
      topicId,
      count = 5,
      difficulty = 'mixed',
      style,
      fromMaterialId,
      useBatchApi = false,
    } = body
    
    if (!topicId) {
      return NextResponse.json({ error: 'Topic ID required' }, { status: 400 })
    }
    
    // Verify topic belongs to workspace
    const supabase = await createServerClient()
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id, workspace_id')
      .eq('id', topicId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }
    
    // Choose job type based on batch preference
    const job = useBatchApi
      ? await enqueueBatchJob({
          workspaceId: context.workspaceId,
          userId: user.id,
          type: 'GENERATE_QUESTIONS_BATCH',
          payload: {
            requests: [{
              topicId,
              workspaceId: context.workspaceId,
              count: Math.min(count, 50), // Limit per request
              difficulty,
            }],
          },
        })
      : await enqueueJob({
          workspaceId: context.workspaceId,
          userId: user.id,
          type: 'GENERATE_QUESTIONS',
          payload: {
            topicId,
            workspaceId: context.workspaceId,
            count: Math.min(count, 20), // Limit for real-time
            difficulty,
            style,
            fromMaterialId,
          },
          priority: useBatchApi ? 0 : 1, // Higher priority for real-time
        })
    
    if (!job) {
      return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      jobId: job.id,
      type: job.type,
      status: job.status,
    })
  } catch (error) {
    console.error('Generate questions error:', error)
    return NextResponse.json(
      { error: 'Failed to start generation' },
      { status: 500 }
    )
  }
}

// Get generation job status
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  
  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
  }
  
  const job = await getJob(jobId)
  
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  
  return NextResponse.json({
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.result_json,
    error: job.error_text,
    createdAt: job.created_at,
  })
}
