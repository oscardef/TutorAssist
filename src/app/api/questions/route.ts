import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get questions (with optional filtering)
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
  const topicId = searchParams.get('topicId')
  const difficulty = searchParams.get('difficulty')
  const aiGenerated = searchParams.get('aiGenerated')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  
  const supabase = await createServerClient()
  
  let query = supabase
    .from('questions')
    .select('*, topics(id, name)', { count: 'exact' })
    .eq('workspace_id', context.workspaceId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (topicId) {
    query = query.eq('topic_id', topicId)
  }
  
  if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
    query = query.eq('difficulty', difficulty)
  }
  
  if (aiGenerated === 'true') {
    query = query.eq('ai_generated', true)
  } else if (aiGenerated === 'false') {
    query = query.eq('ai_generated', false)
  }
  
  const { data: questions, error, count } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({
    questions,
    total: count,
    limit,
    offset,
  })
}

// Create a new question manually
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can create questions' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const {
      topicId,
      questionLatex,
      answerLatex,
      difficulty = 'medium',
      hints = [],
      solutionSteps = [],
      tags = [],
    } = body
    
    if (!topicId || !questionLatex || !answerLatex) {
      return NextResponse.json(
        { error: 'Topic, question, and answer are required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerClient()
    
    // Verify topic belongs to workspace
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id')
      .eq('id', topicId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }
    
    // Create question
    const { data: question, error } = await supabase
      .from('questions')
      .insert({
        workspace_id: context.workspaceId,
        topic_id: topicId,
        ai_generated: false,
        question_latex: questionLatex,
        answer_latex: answerLatex,
        difficulty,
        hints_json: hints,
        solution_steps_json: solutionSteps,
        tags,
        quality_score: 1.0,
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ question })
  } catch (error) {
    console.error('Create question error:', error)
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    )
  }
}
