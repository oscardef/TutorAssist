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
  const supabase = await createServerClient()
  
  // Single question fetch by ID (for edit page)
  const id = searchParams.get('id')
  if (id) {
    const { data: question, error } = await supabase
      .from('questions')
      .select(`
        *,
        topics(id, name, program_id, grade_level_id),
        primary_program:study_programs!questions_primary_program_id_fkey(id, code, name, color),
        primary_grade_level:grade_levels!questions_primary_grade_level_id_fkey(id, code, name, year_number)
      `)
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ question })
  }
  
  const topicId = searchParams.get('topicId')
  const difficulty = searchParams.get('difficulty')
  const gradeLevel = searchParams.get('gradeLevel')
  const programId = searchParams.get('programId')
  const gradeLevelId = searchParams.get('gradeLevelId')
  const mode = searchParams.get('mode') // 'review' or 'weak'
  const aiGenerated = searchParams.get('aiGenerated')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  
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
  
  // Special mode: get questions from topics where student is weakest
  if (mode === 'weak' && context.role === 'student') {
    // Get student's topic performance
    const { data: attempts } = await supabase
      .from('attempts')
      .select('is_correct, questions(topic_id)')
      .eq('student_user_id', user.id)
      .eq('workspace_id', context.workspaceId)
    
    // Calculate accuracy per topic
    const topicStats = new Map<string, { total: number; correct: number; accuracy: number }>()
    for (const attempt of attempts || []) {
      const questions = attempt.questions as unknown as { topic_id: string } | { topic_id: string }[] | null
      const topicId = Array.isArray(questions) ? questions[0]?.topic_id : questions?.topic_id
      if (!topicId) continue
      
      const existing = topicStats.get(topicId) || { total: 0, correct: 0, accuracy: 0 }
      existing.total += 1
      if (attempt.is_correct) existing.correct += 1
      existing.accuracy = existing.total > 0 ? existing.correct / existing.total : 0
      topicStats.set(topicId, existing)
    }
    
    // Convert to array and sort by accuracy (lowest first)
    const sortedTopics = Array.from(topicStats.entries())
      .filter(([, stats]) => stats.total >= 2) // At least 2 attempts
      .sort((a, b) => a[1].accuracy - b[1].accuracy) // Lowest accuracy first
    
    // Get the weakest topics - take up to 5 topics that are below average or the weakest ones
    let weakTopicIds: string[] = []
    
    if (sortedTopics.length > 0) {
      // Calculate average accuracy
      const avgAccuracy = sortedTopics.reduce((sum, [, s]) => sum + s.accuracy, 0) / sortedTopics.length
      
      // Take topics that are below average, or if all are good, take the bottom half
      const belowAverage = sortedTopics.filter(([, s]) => s.accuracy < avgAccuracy)
      
      if (belowAverage.length > 0) {
        // Take below-average topics (up to 5)
        weakTopicIds = belowAverage.slice(0, 5).map(([id]) => id)
      } else {
        // All topics are at/above average - take the bottom 2-3 for continued improvement
        weakTopicIds = sortedTopics.slice(0, Math.min(3, sortedTopics.length)).map(([id]) => id)
      }
    }
    
    if (weakTopicIds.length === 0) {
      return NextResponse.json({ questions: [], total: 0, message: 'Not enough practice data yet' })
    }
    
    // Filter by student's program if set
    let questionsQuery = supabase
      .from('questions')
      .select('*, topics(id, name)')
      .in('topic_id', weakTopicIds)
      .eq('workspace_id', context.workspaceId)
      .eq('status', 'active')
    
    if (programId) {
      questionsQuery = questionsQuery.eq('primary_program_id', programId)
    }
    
    const { data: questions, error } = await questionsQuery.limit(limit)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ questions, total: questions?.length || 0 })
  }
  
  let query = supabase
    .from('questions')
    .select(`
      *,
      topics(id, name, program_id, grade_level_id),
      primary_program:study_programs!questions_primary_program_id_fkey(id, code, name, color),
      primary_grade_level:grade_levels!questions_primary_grade_level_id_fkey(id, code, name, year_number)
    `, { count: 'exact' })
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
  
  // Filter by primary program
  if (programId) {
    query = query.eq('primary_program_id', programId)
  }
  
  // Filter by primary grade level
  if (gradeLevelId) {
    query = query.eq('primary_grade_level_id', gradeLevelId)
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
      // New program/grade level support
      primaryProgramId,
      primaryGradeLevelId,
      programIds = [],      // For many-to-many
      gradeLevelIds = [],   // For many-to-many
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
        primary_program_id: primaryProgramId || null,
        primary_grade_level_id: primaryGradeLevelId || null,
        hints_json: hints,
        solution_steps_json: solutionSteps,
        tags_json: tags,
        quality_score: 1.0,
        created_by: user.id,
      })
      .select(`
        *,
        topics(id, name),
        primary_program:study_programs!questions_primary_program_id_fkey(id, code, name, color),
        primary_grade_level:grade_levels!questions_primary_grade_level_id_fkey(id, code, name)
      `)
      .single()
    
    if (error) {
      console.error('Create question error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Insert many-to-many program relationships
    if (programIds.length > 0) {
      const programInserts = programIds.map((progId: string) => ({
        question_id: question.id,
        program_id: progId,
      }))
      await supabase.from('question_programs').insert(programInserts)
    }
    
    // Insert many-to-many grade level relationships
    if (gradeLevelIds.length > 0) {
      const gradeInserts = gradeLevelIds.map((gradeId: string) => ({
        question_id: question.id,
        grade_level_id: gradeId,
      }))
      await supabase.from('question_grade_levels').insert(gradeInserts)
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
    if (body.primary_program_id !== undefined) updateFields.primary_program_id = body.primary_program_id
    if (body.primary_grade_level_id !== undefined) updateFields.primary_grade_level_id = body.primary_grade_level_id
    if (body.hints !== undefined) updateFields.hints_json = body.hints
    if (body.solution_steps !== undefined) updateFields.solution_steps_json = body.solution_steps
    if (body.tags !== undefined) updateFields.tags_json = body.tags
    if (body.status !== undefined) updateFields.status = body.status
    
    updateFields.updated_at = new Date().toISOString()
    
    const { data: question, error } = await supabase
      .from('questions')
      .update(updateFields)
      .eq('id', id)
      .select(`
        *,
        topics(id, name),
        primary_program:study_programs!questions_primary_program_id_fkey(id, code, name, color),
        primary_grade_level:grade_levels!questions_primary_grade_level_id_fkey(id, code, name)
      `)
      .single()
    
    if (error) {
      console.error('Update question error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Update many-to-many program relationships if provided
    if (body.programIds !== undefined) {
      // Delete existing
      await supabase.from('question_programs').delete().eq('question_id', id)
      // Insert new
      if (body.programIds.length > 0) {
        const programInserts = body.programIds.map((progId: string) => ({
          question_id: id,
          program_id: progId,
        }))
        await supabase.from('question_programs').insert(programInserts)
      }
    }
    
    // Update many-to-many grade level relationships if provided
    if (body.gradeLevelIds !== undefined) {
      // Delete existing
      await supabase.from('question_grade_levels').delete().eq('question_id', id)
      // Insert new
      if (body.gradeLevelIds.length > 0) {
        const gradeInserts = body.gradeLevelIds.map((gradeId: string) => ({
          question_id: id,
          grade_level_id: gradeId,
        }))
        await supabase.from('question_grade_levels').insert(gradeInserts)
      }
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
