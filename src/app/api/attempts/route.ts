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
    
    // Record attempt with context for analytics
    const attemptContext = {
      device: request.headers.get('user-agent') || 'unknown',
      sessionType: assignmentId ? 'assignment' : 'practice',
      timestamp: new Date().toISOString(),
    }
    
    const { data: attempt, error } = await supabase
      .from('attempts')
      .insert({
        workspace_id: context.workspaceId,
        question_id: questionId,
        assignment_id: assignmentId || null,
        student_user_id: user.id,
        answer_raw: answerLatex,
        is_correct: isCorrect,
        time_spent_seconds: timeSpentSeconds || null,
        hints_viewed: hintsUsed,
        submitted_at: new Date().toISOString(),
        context_json: attemptContext,
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Update spaced repetition
    await updateSpacedRepetition(supabase, user.id, questionId, isCorrect, context.workspaceId)
    
    // Update question stats via database function
    try {
      await supabase.rpc('update_question_stats', {
        question_id_param: questionId,
        is_correct_param: isCorrect,
      })
    } catch (statsError) {
      // Non-critical error - log but don't fail the request
      console.warn('Failed to update question stats:', statsError)
    }
    
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
  const stats = searchParams.get('stats')
  const limit = parseInt(searchParams.get('limit') || '50')
  
  const supabase = await createServerClient()
  
  // Return topic statistics for the student
  if (stats === 'byTopic') {
    const { data: attempts, error } = await supabase
      .from('attempts')
      .select('is_correct, questions(topic_id, topics(id, name))')
      .eq('workspace_id', context.workspaceId)
      .eq('student_user_id', user.id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Aggregate by topic
    const topicMap = new Map<string, { topicId: string; topicName: string; total: number; correct: number }>()
    
    for (const attempt of attempts || []) {
      const questions = attempt.questions as unknown as { topic_id: string; topics: { id: string; name: string } | { id: string; name: string }[] | null } | null
      if (!questions?.topics) continue
      
      const topics = Array.isArray(questions.topics) ? questions.topics[0] : questions.topics
      if (!topics) continue
      
      const topicId = topics.id
      const topicName = topics.name
      
      const existing = topicMap.get(topicId) || { topicId, topicName, total: 0, correct: 0 }
      existing.total += 1
      if (attempt.is_correct) existing.correct += 1
      topicMap.set(topicId, existing)
    }
    
    const topicStats = Array.from(topicMap.values()).map(s => ({
      ...s,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
    })).sort((a, b) => b.total - a.total)
    
    return NextResponse.json({ topicStats })
  }
  
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
  isCorrect: boolean,
  workspaceId?: string
) {
  try {
    // Get current SR data using correct column names
    const { data: srData } = await supabase
      .from('spaced_repetition')
      .select('*')
      .eq('student_user_id', studentId)
      .eq('question_id', questionId)
      .single()
    
    // SM-2 algorithm simplified
    const now = new Date()
    let ease = srData?.ease || 2.5
    let interval = srData?.interval_days || 1
    let streak = srData?.streak || 0
    let totalReviews = srData?.total_reviews || 0
    let totalCorrect = srData?.total_correct || 0
    
    totalReviews += 1
    
    if (isCorrect) {
      streak += 1
      totalCorrect += 1
      
      if (streak === 1) {
        interval = 1
      } else if (streak === 2) {
        interval = 6
      } else {
        interval = Math.round(interval * ease)
      }
      
      ease = Math.max(1.3, ease + 0.1)
    } else {
      streak = 0
      interval = 1
      ease = Math.max(1.3, ease - 0.2)
    }
    
    const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000)
    
    // Get workspace_id from existing record or from question
    let wsId = srData?.workspace_id || workspaceId
    if (!wsId) {
      const { data: question } = await supabase
        .from('questions')
        .select('workspace_id')
        .eq('id', questionId)
        .single()
      wsId = question?.workspace_id
    }
    
    if (!wsId) {
      console.warn('Could not determine workspace_id for spaced_repetition')
      return
    }
    
    // Upsert SR data using correct column names
    const { error } = await supabase
      .from('spaced_repetition')
      .upsert({
        workspace_id: wsId,
        student_user_id: studentId,
        question_id: questionId,
        ease: ease,
        interval_days: interval,
        streak: streak,
        next_due: nextDue.toISOString(),
        last_seen: now.toISOString(),
        last_outcome: isCorrect ? 'correct' : 'incorrect',
        total_reviews: totalReviews,
        total_correct: totalCorrect,
      }, {
        onConflict: 'workspace_id,student_user_id,question_id',
      })
    
    if (error) {
      console.warn('Failed to update spaced repetition:', error)
    }
  } catch (error) {
    // Non-critical, log but don't fail
    console.warn('Error in updateSpacedRepetition:', error)
  }
}
