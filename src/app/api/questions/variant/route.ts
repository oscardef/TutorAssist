import { NextRequest, NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { enqueueJob } from '@/lib/jobs/queue'
import { processJobs } from '@/lib/jobs'

export async function POST(request: NextRequest) {
  try {
    const context = await requireTutor()
    const supabase = await createServerClient()
    const body = await request.json()
    
    const { questionId, variationType = 'similar' } = body
    
    if (!questionId) {
      return NextResponse.json({ error: 'Question ID required' }, { status: 400 })
    }
    
    // Get the original question
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (fetchError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
    
    // Create a job to generate the variant
    const job = await enqueueJob({
      workspaceId: context.workspaceId,
      userId: context.userId,
      type: 'REGEN_VARIANT',
      payload: {
        questionId: question.id,
        topicId: question.topic_id,
        originalPrompt: question.prompt_text,
        originalAnswer: question.correct_answer_json,
        difficulty: question.difficulty,
        variationType
      }
    })
    
    // Process immediately
    processJobs(1).catch(console.error)
    
    return NextResponse.json({ 
      success: true, 
      jobId: job?.id,
      message: `Generating ${variationType} variant...`
    })
    
  } catch (error) {
    console.error('Variant generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate variant' },
      { status: 500 }
    )
  }
}
