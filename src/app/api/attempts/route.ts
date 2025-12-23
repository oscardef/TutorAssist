import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Record a practice attempt
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const {
      questionId,
      assignmentId,
      answerLatex,
      isCorrect,
      timeSpentSeconds,
      hintsUsed = 0,
    } = body
    
    if (!questionId || isCorrect === undefined) {
      return NextResponse.json(
        { error: 'Question ID and correctness are required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerClient()
    
    // Verify question exists in workspace
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, workspace_id')
      .eq('id', questionId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
    
    // Record attempt
    const { data: attempt, error } = await supabase
      .from('attempts')
      .insert({
        workspace_id: context.workspaceId,
        question_id: questionId,
        assignment_id: assignmentId || null,
        student_id: user.id,
        answer_latex: answerLatex,
        is_correct: isCorrect,
        time_spent_seconds: timeSpentSeconds || null,
        hints_used: hintsUsed,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Update spaced repetition
    await updateSpacedRepetition(supabase, user.id, questionId, isCorrect)
    
    // Update question stats
    await supabase.rpc('update_question_stats', {
      question_id_param: questionId,
      is_correct_param: isCorrect,
    })
    
    return NextResponse.json({ attempt })
  } catch (error) {
    console.error('Record attempt error:', error)
    return NextResponse.json(
      { error: 'Failed to record attempt' },
      { status: 500 }
    )
  }
}

// Get student's attempts
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
  const questionId = searchParams.get('questionId')
  const assignmentId = searchParams.get('assignmentId')
  const limit = parseInt(searchParams.get('limit') || '50')
  
  const supabase = await createServerClient()
  
  let query = supabase
    .from('attempts')
    .select('*, questions(prompt_text, topics(name))')
    .eq('workspace_id', context.workspaceId)
    .order('submitted_at', { ascending: false })
    .limit(limit)
  
  // For students, only show their own attempts
  if (context.role === 'student') {
    query = query.eq('student_user_id', user.id)
  }
  
  if (questionId) {
    query = query.eq('question_id', questionId)
  }
  
  if (assignmentId) {
    query = query.eq('assignment_id', assignmentId)
  }
  
  const { data: attempts, error } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ attempts })
}

// Update spaced repetition schedule based on performance
async function updateSpacedRepetition(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  studentId: string,
  questionId: string,
  isCorrect: boolean
) {
  // Get current SR data
  const { data: srData } = await supabase
    .from('spaced_repetition')
    .select('*')
    .eq('student_id', studentId)
    .eq('question_id', questionId)
    .single()
  
  // SM-2 algorithm simplified
  const now = new Date()
  let easeFactor = srData?.ease_factor || 2.5
  let interval = srData?.interval_days || 1
  let repetitions = srData?.repetitions || 0
  
  if (isCorrect) {
    repetitions += 1
    
    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    
    easeFactor = Math.max(1.3, easeFactor + 0.1)
  } else {
    repetitions = 0
    interval = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
  }
  
  const nextReviewDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000)
  
  // Upsert SR data
  await supabase
    .from('spaced_repetition')
    .upsert({
      student_id: studentId,
      question_id: questionId,
      ease_factor: easeFactor,
      interval_days: interval,
      repetitions,
      next_review_date: nextReviewDate.toISOString(),
      last_review_date: now.toISOString(),
    }, {
      onConflict: 'student_id,question_id',
    })
}
