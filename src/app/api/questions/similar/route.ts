import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { findSimilarQuestions } from '@/lib/jobs/handlers/generate-embeddings'
import { enqueueJob } from '@/lib/jobs/queue'

// GET /api/questions/similar?id={questionId}&limit={limit}&threshold={threshold}
// Find questions similar to a given question
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const questionId = searchParams.get('id')
  const limit = parseInt(searchParams.get('limit') || '10')
  const threshold = parseFloat(searchParams.get('threshold') || '0.75')
  
  if (!questionId) {
    return NextResponse.json({ error: 'Question ID required' }, { status: 400 })
  }
  
  // Find similar questions
  const similarIds = await findSimilarQuestions(questionId, context.workspaceId, {
    limit,
    threshold,
  })
  
  if (similarIds.length === 0) {
    return NextResponse.json({ questions: [], total: 0 })
  }
  
  // Fetch full question data for similar questions
  const supabase = await createServerClient()
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id,
      prompt_text,
      prompt_latex,
      difficulty,
      answer_type,
      topics(id, name),
      times_attempted,
      times_correct
    `)
    .in('id', similarIds.map(s => s.questionId))
    .eq('workspace_id', context.workspaceId)
    .eq('status', 'active')
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Merge similarity scores with question data
  const questionsWithScores = questions?.map(q => ({
    ...q,
    similarity: similarIds.find(s => s.questionId === q.id)?.similarity || 0,
  })).sort((a, b) => b.similarity - a.similarity)
  
  return NextResponse.json({
    questions: questionsWithScores,
    total: questionsWithScores?.length || 0,
  })
}

// POST /api/questions/similar
// Generate embeddings for questions (optionally all in workspace)
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can manage embeddings' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { questionId, questionIds, generateAll } = body as {
      questionId?: string
      questionIds?: string[]
      generateAll?: boolean
    }
    
    // If generating all, count questions without embeddings
    if (generateAll) {
      const supabase = await createServerClient()
      
      // Get questions without embeddings
      const { data: allQuestions } = await supabase
        .from('questions')
        .select('id')
        .eq('workspace_id', context.workspaceId)
        .eq('status', 'active')
      
      const { data: existingEmbeddings } = await supabase
        .from('question_embeddings')
        .select('question_id')
        .eq('workspace_id', context.workspaceId)
      
      const existingIds = new Set(existingEmbeddings?.map(e => e.question_id) || [])
      const questionsNeedingEmbeddings = allQuestions?.filter(q => !existingIds.has(q.id)) || []
      
      if (questionsNeedingEmbeddings.length === 0) {
        return NextResponse.json({ 
          message: 'All questions already have embeddings',
          jobsCreated: 0,
        })
      }
      
      // Create jobs in batches
      const batchSize = 50
      const jobIds: string[] = []
      
      for (let i = 0; i < questionsNeedingEmbeddings.length; i += batchSize) {
        const batch = questionsNeedingEmbeddings.slice(i, i + batchSize)
        const job = await enqueueJob({
          workspaceId: context.workspaceId,
          userId: user.id,
          type: 'GENERATE_EMBEDDINGS',
          payload: { questionIds: batch.map(q => q.id) },
        })
        if (job) jobIds.push(job.id)
      }
      
      return NextResponse.json({
        message: `Queued ${questionsNeedingEmbeddings.length} questions for embedding generation`,
        jobsCreated: jobIds.length,
        jobIds,
      })
    }
    
    // Single question or specific list
    const idsToProcess = questionIds || (questionId ? [questionId] : [])
    
    if (idsToProcess.length === 0) {
      return NextResponse.json({ error: 'No question IDs provided' }, { status: 400 })
    }
    
    // Create job for these questions
    const job = await enqueueJob({
      workspaceId: context.workspaceId,
      userId: user.id,
      type: 'GENERATE_EMBEDDINGS',
      payload: { questionIds: idsToProcess },
    })
    
    if (!job) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }
    
    return NextResponse.json({
      message: `Queued ${idsToProcess.length} questions for embedding generation`,
      jobId: job.id,
    })
    
  } catch (err) {
    console.error('Error processing embedding request:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
