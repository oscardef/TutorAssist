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
  const gradeLevel = searchParams.get('gradeLevel')
  const mode = searchParams.get('mode') // 'review' or 'weak'
  const aiGenerated = searchParams.get('aiGenerated')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  
  const supabase = await createServerClient()
  
  // Special mode: get questions due for spaced repetition review
  if (mode === 'review' && context.role === 'student') {
    const { data: srItems, error: srError } = await supabase
      .from('spaced_repetition')
      .select('question_id')
      .eq('student_user_id', user.id)
      .lte('next_due', new Date().toISOString())
      .order('next_due')
      .limit(limit)
    
    if (srError || !srItems || srItems.length === 0) {
      return NextResponse.json({ questions: [], total: 0 })
    }
    
    const questionIds = srItems.map(s => s.question_id)
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*, topics(id, name)')
      .in('id', questionIds)
      .eq('workspace_id', context.workspaceId)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ questions, total: questions?.length || 0 })
  }
  
  // Special mode: get questions from topics where student is weak
  if (mode === 'weak' && context.role === 'student') {
    // Get student's topic performance
    const { data: attempts } = await supabase
      .from('attempts')
      .select('is_correct, questions(topic_id)')
      .eq('student_user_id', user.id)
      .eq('workspace_id', context.workspaceId)
    
    // Find topics with <60% accuracy and at least 3 attempts
    const topicStats = new Map<string, { total: number; correct: number }>()
    for (const attempt of attempts || []) {
      const questions = attempt.questions as unknown as { topic_id: string } | { topic_id: string }[] | null
      const topicId = Array.isArray(questions) ? questions[0]?.topic_id : questions?.topic_id
      if (!topicId) continue
      
      const existing = topicStats.get(topicId) || { total: 0, correct: 0 }
      existing.total += 1
      if (attempt.is_correct) existing.correct += 1
      topicStats.set(topicId, existing)
    }
    
    const weakTopicIds = Array.from(topicStats.entries())
      .filter(([, stats]) => stats.total >= 3 && (stats.correct / stats.total) < 0.6)
      .map(([id]) => id)
    
    if (weakTopicIds.length === 0) {
      return NextResponse.json({ questions: [], total: 0 })
    }
    
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*, topics(id, name)')
      .in('topic_id', weakTopicIds)
      .eq('workspace_id', context.workspaceId)
      .eq('status', 'active')
      .limit(limit)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ questions, total: questions?.length || 0 })
  }
  
  let query = supabase
    .from('questions')
    .select('*, topics(id, name)', { count: 'exact' })
    .eq('workspace_id', context.workspaceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (topicId) {
    query = query.eq('topic_id', topicId)
  }
  
  if (difficulty && ['1', '2', '3', '4', '5'].includes(difficulty)) {
    query = query.eq('difficulty', parseInt(difficulty))
  }
  
  if (gradeLevel) {
    query = query.eq('grade_level', parseInt(gradeLevel))
  }
  
  if (aiGenerated === 'true') {
    query = query.eq('origin', 'ai_generated')
  } else if (aiGenerated === 'false') {
    query = query.neq('origin', 'ai_generated')
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
      promptText,
      promptLatex,
      answerType = 'exact',
      correctAnswerJson,
      tolerance,
      difficulty = 3,
      gradeLevel,
      hints = [],
      solutionSteps = [],
      tags = [],
      // Legacy support for old API format
      questionLatex,
      answerLatex,
    } = body
    
    // Support both old and new field names
    const questionText = promptText || questionLatex
    const questionLatexFinal = promptLatex || questionLatex
    
    if (!topicId || !questionText) {
      return NextResponse.json(
        { error: 'Topic and question text are required' },
        { status: 400 }
      )
    }
    
    // Build correct_answer_json if not provided
    let answerJson = correctAnswerJson
    if (!answerJson && answerLatex) {
      answerJson = { value: answerLatex }
    }
    
    if (!answerJson) {
      return NextResponse.json(
        { error: 'Answer is required' },
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
    
    // Convert difficulty string to number if needed
    let difficultyNum = difficulty
    if (typeof difficulty === 'string') {
      const difficultyMap: Record<string, number> = {
        'easy': 1,
        'medium-easy': 2,
        'medium': 3,
        'medium-hard': 4,
        'hard': 5,
      }
      difficultyNum = difficultyMap[difficulty] || 3
    }
    
    // Create question
    const { data: question, error } = await supabase
      .from('questions')
      .insert({
        workspace_id: context.workspaceId,
        topic_id: topicId,
        origin: 'manual',
        status: 'active',
        prompt_text: questionText,
        prompt_latex: questionLatexFinal || null,
        answer_type: answerType,
        correct_answer_json: answerJson,
        tolerance: tolerance || null,
        difficulty: difficultyNum,
        grade_level: gradeLevel || null,
        hints_json: hints,
        solution_steps_json: solutionSteps,
        tags_json: tags,
        quality_score: 1.0,
        created_by: user.id,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Create question error:', error)
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

// Update an existing question
export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can edit questions' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return NextResponse.json({ error: 'Question ID is required' }, { status: 400 })
  }
  
  try {
    const body = await request.json()
    const supabase = await createServerClient()
    
    // Verify question belongs to workspace
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
    
    // Build update object from allowed fields
    const updateFields: Record<string, unknown> = {}
    
    if (body.topic_id !== undefined) updateFields.topic_id = body.topic_id
    if (body.prompt_text !== undefined) updateFields.prompt_text = body.prompt_text
    if (body.prompt_latex !== undefined) updateFields.prompt_latex = body.prompt_latex
    if (body.answer_type !== undefined) updateFields.answer_type = body.answer_type
    if (body.correct_answer_json !== undefined) updateFields.correct_answer_json = body.correct_answer_json
    if (body.difficulty !== undefined) updateFields.difficulty = body.difficulty
    if (body.grade_level !== undefined) updateFields.grade_level = body.grade_level
    if (body.hints !== undefined) updateFields.hints_json = body.hints
    if (body.solution_steps !== undefined) updateFields.solution_steps_json = body.solution_steps
    if (body.tags !== undefined) updateFields.tags_json = body.tags
    if (body.status !== undefined) updateFields.status = body.status
    
    updateFields.updated_at = new Date().toISOString()
    
    const { data: question, error } = await supabase
      .from('questions')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Update question error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ question })
  } catch (error) {
    console.error('Update question error:', error)
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    )
  }
}

// Delete a question
export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can delete questions' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return NextResponse.json({ error: 'Question ID is required' }, { status: 400 })
  }
  
  try {
    const supabase = await createServerClient()
    
    // Verify question belongs to workspace
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
    
    if (error) {
      console.error('Delete question error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete question error:', error)
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    )
  }
}
