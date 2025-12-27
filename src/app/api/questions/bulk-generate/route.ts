import { NextRequest, NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { enqueueJob, enqueueBatchJob } from '@/lib/jobs'
import { processJobs } from '@/lib/jobs'

/**
 * Bulk Generate Questions API
 * 
 * Generates questions across multiple topics in a single request.
 * Supports both real-time generation (for small batches) and 
 * OpenAI Batch API (for large batches at 50% cost).
 * 
 * POST /api/questions/bulk-generate
 * {
 *   requests: [
 *     { topicId: "...", count: 10, difficulty: "mixed" },
 *     { topicId: "...", count: 15, difficulty: "hard" },
 *   ],
 *   useBatchApi: false, // true for batch (cheaper but slower)
 *   style?: "Focus on word problems" // optional style hint
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireTutor()
    const supabase = await createServerClient()
    const body = await request.json()
    
    const { requests, useBatchApi = false, style } = body
    
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({ 
        error: 'Requests array required. Each request needs topicId and count.' 
      }, { status: 400 })
    }
    
    // Validate and collect topic IDs
    const topicIds = requests.map(r => r.topicId).filter(Boolean)
    if (topicIds.length !== requests.length) {
      return NextResponse.json({ 
        error: 'Each request must have a topicId' 
      }, { status: 400 })
    }
    
    // Verify all topics belong to the workspace
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, name')
      .eq('workspace_id', context.workspaceId)
      .in('id', topicIds)
    
    if (topicsError) {
      return NextResponse.json({ error: 'Failed to verify topics' }, { status: 500 })
    }
    
    const topicMap = new Map(topics?.map(t => [t.id, t.name]) || [])
    const missingTopics = topicIds.filter(id => !topicMap.has(id))
    
    if (missingTopics.length > 0) {
      return NextResponse.json({ 
        error: `Topics not found: ${missingTopics.join(', ')}` 
      }, { status: 404 })
    }
    
    // Calculate total questions
    const totalQuestions = requests.reduce((sum, r) => sum + (r.count || 5), 0)
    
    // Limits
    const MAX_REALTIME_TOTAL = 50
    const MAX_BATCH_TOTAL = 500
    const MAX_PER_TOPIC = useBatchApi ? 100 : 25
    
    if (useBatchApi && totalQuestions > MAX_BATCH_TOTAL) {
      return NextResponse.json({ 
        error: `Maximum ${MAX_BATCH_TOTAL} questions per batch request` 
      }, { status: 400 })
    }
    
    if (!useBatchApi && totalQuestions > MAX_REALTIME_TOTAL) {
      return NextResponse.json({ 
        error: `Maximum ${MAX_REALTIME_TOTAL} questions for real-time generation. Use useBatchApi=true for larger batches.` 
      }, { status: 400 })
    }
    
    // Validate individual counts
    for (const req of requests) {
      if (req.count > MAX_PER_TOPIC) {
        return NextResponse.json({ 
          error: `Maximum ${MAX_PER_TOPIC} questions per topic` 
        }, { status: 400 })
      }
    }
    
    const jobs: { jobId: string; topicId: string; topicName: string; count: number }[] = []
    
    if (useBatchApi) {
      // Create a single batch job with all requests
      const job = await enqueueBatchJob({
        workspaceId: context.workspaceId,
        userId: context.userId,
        type: 'GENERATE_QUESTIONS_BATCH',
        payload: {
          requests: requests.map(req => ({
            topicId: req.topicId,
            topicName: topicMap.get(req.topicId),
            workspaceId: context.workspaceId,
            count: Math.min(req.count || 5, MAX_PER_TOPIC),
            difficulty: req.difficulty || 'mixed',
            style,
          })),
        },
      })
      
      if (job) {
        jobs.push({
          jobId: job.id,
          topicId: 'batch',
          topicName: `Batch: ${requests.length} topics`,
          count: totalQuestions,
        })
      }
    } else {
      // Create individual jobs for each topic (real-time processing)
      for (const req of requests) {
        const job = await enqueueJob({
          workspaceId: context.workspaceId,
          userId: context.userId,
          type: 'GENERATE_QUESTIONS',
          payload: {
            topicId: req.topicId,
            workspaceId: context.workspaceId,
            count: Math.min(req.count || 5, MAX_PER_TOPIC),
            difficulty: req.difficulty || 'mixed',
            style,
          },
          priority: 1,
        })
        
        if (job) {
          jobs.push({
            jobId: job.id,
            topicId: req.topicId,
            topicName: topicMap.get(req.topicId) || '',
            count: req.count || 5,
          })
        }
      }
      
      // Process jobs in background
      if (jobs.length > 0) {
        processJobs(jobs.length).catch(err => 
          console.error('Bulk generation processing error:', err)
        )
      }
    }
    
    return NextResponse.json({
      success: true,
      mode: useBatchApi ? 'batch' : 'realtime',
      totalQuestions,
      jobs,
      message: useBatchApi 
        ? `Batch job created. ${totalQuestions} questions will be generated within 24 hours.`
        : `Generating ${totalQuestions} questions across ${jobs.length} topics...`,
    })
    
  } catch (error) {
    console.error('Bulk generate error:', error)
    return NextResponse.json(
      { error: 'Failed to start bulk generation' },
      { status: 500 }
    )
  }
}

// GET endpoint to check status of multiple jobs
export async function GET(request: NextRequest) {
  try {
    const context = await requireTutor()
    const supabase = await createServerClient()
    
    const { searchParams } = new URL(request.url)
    const jobIds = searchParams.get('jobIds')?.split(',').filter(Boolean) || []
    
    if (jobIds.length === 0) {
      // Return recent jobs
      const { data: recentJobs } = await supabase
        .from('jobs')
        .select('id, type, status, result_json, error_text, created_at')
        .eq('workspace_id', context.workspaceId)
        .in('type', ['GENERATE_QUESTIONS', 'GENERATE_QUESTIONS_BATCH', 'BATCH_GENERATE'])
        .order('created_at', { ascending: false })
        .limit(20)
      
      return NextResponse.json({ jobs: recentJobs || [] })
    }
    
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, type, status, result_json, error_text, created_at')
      .eq('workspace_id', context.workspaceId)
      .in('id', jobIds)
    
    const completed = jobs?.filter(j => j.status === 'completed').length || 0
    const failed = jobs?.filter(j => j.status === 'failed').length || 0
    const pending = jobs?.filter(j => ['pending', 'processing', 'batch_pending'].includes(j.status)).length || 0
    
    return NextResponse.json({
      jobs: jobs || [],
      summary: { completed, failed, pending, total: jobs?.length || 0 },
    })
    
  } catch (error) {
    console.error('Get bulk status error:', error)
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    )
  }
}
