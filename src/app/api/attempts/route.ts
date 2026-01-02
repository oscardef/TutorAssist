import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { 
  validateAnswer, 
  compareMathAnswers, 
  compareNumericAnswers, 
  validateFillBlank, 
  validateMatching,
  sanitizeAnswerInput 
} from '@/lib/math-utils'

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
      isCorrect: clientIsCorrect, // Renamed - we'll verify server-side
      timeSpentSeconds,
      hintsUsed = 0,
    } = body
    
    if (!questionId) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerClient()
    
    // Verify question exists in workspace AND fetch answer data for validation
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, workspace_id, answer_type, correct_answer')
      .eq('id', questionId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
    
    // SERVER-SIDE ANSWER VALIDATION
    // This ensures answers are checked consistently and securely
    // SECURITY: Never trust client-submitted isCorrect - always validate server-side
    let isCorrect = false // Default to false - must be proven correct by server validation
    let validationDetails: { 
      matchType?: string
      blanksCorrect?: number
      blanksTotal?: number
      matchesCorrect?: number
      matchesTotal?: number
      serverValidated?: boolean
      validationError?: string
    } = { serverValidated: true }
    
    try {
      const correctAnswerData = question.correct_answer as {
        value?: string | number
        correct?: number
        choices?: { text: string }[]
        alternates?: string[]
        tolerance?: number
        latex?: string
        blanks?: { position?: number; value: string; latex?: string; alternates?: string[] }[]
        pairs?: { left: string; right: string; leftLatex?: string; rightLatex?: string }[]
        correctMatches?: number[]
      } | null
      
      // Sanitize user input
      const sanitizedAnswer = typeof answerLatex === 'string' 
        ? sanitizeAnswerInput(answerLatex) 
        : answerLatex

      if (correctAnswerData && sanitizedAnswer !== undefined) {
        // Handle different answer types
        if (question.answer_type === 'multiple_choice') {
          // Multiple choice: compare selected index
          const selectedIndex = parseInt(sanitizedAnswer)
          isCorrect = !isNaN(selectedIndex) && selectedIndex === correctAnswerData.correct
        } else if (question.answer_type === 'true_false') {
          // True/false: STRICT validation - only accept explicit "true" or "false"
          // Students can use the "I was right" button if they feel their answer was acceptable
          const normalizedAnswer = sanitizedAnswer?.toLowerCase().trim()
          
          // Only accept complete words - no abbreviations like "t" or "f"
          const isTrueAnswer = normalizedAnswer === 'true'
          const isFalseAnswer = normalizedAnswer === 'false'
          
          // If the answer isn't exactly "true" or "false", mark as incorrect
          if (!isTrueAnswer && !isFalseAnswer) {
            isCorrect = false
          } else {
            const correctValue = correctAnswerData.value
            // Check if correct answer represents "true" (handles string, boolean, or number)
            const correctBool = correctValue === 'true' || String(correctValue) === 'true' || correctValue === 1
            isCorrect = isTrueAnswer === correctBool
          }
        } else if (question.answer_type === 'numeric') {
          // Numeric: use strict numeric comparison
          const correctValue = typeof correctAnswerData.value === 'number' 
            ? correctAnswerData.value 
            : parseFloat(String(correctAnswerData.value))
          
          if (!isNaN(correctValue)) {
            isCorrect = compareNumericAnswers(
              sanitizedAnswer,
              correctValue
            )
          }
        } else if (question.answer_type === 'long_answer') {
          // Long answer: requires manual grading - always mark as needs_review
          // Tutors will grade these manually through the grading interface
          isCorrect = false // Cannot auto-grade; tutor must review
          validationDetails.matchType = 'manual_grading_required'
        } else if (question.answer_type === 'fill_blank') {
          // Fill in the blank: validate each blank
          if (correctAnswerData.blanks && Array.isArray(correctAnswerData.blanks)) {
            const result = validateFillBlank(sanitizedAnswer, correctAnswerData.blanks)
            isCorrect = result.isCorrect
            validationDetails.matchType = 'fill_blank'
            validationDetails.blanksCorrect = result.blanksCorrect
            validationDetails.blanksTotal = result.blanksTotal
          } else {
            // Fallback to single value comparison
            const correctStr = String(correctAnswerData.value ?? '')
            isCorrect = compareMathAnswers(sanitizedAnswer, correctStr, correctAnswerData.alternates)
          }
        } else if (question.answer_type === 'matching') {
          // Matching: validate pair matches
          if (correctAnswerData.correctMatches && Array.isArray(correctAnswerData.correctMatches)) {
            // Parse user matches - expected format: array of indices or comma-separated string
            let userMatches: number[]
            if (typeof sanitizedAnswer === 'string') {
              userMatches = sanitizedAnswer.split(',').map(s => parseInt(s.trim()))
            } else if (Array.isArray(sanitizedAnswer)) {
              userMatches = (sanitizedAnswer as unknown as string[]).map(s => parseInt(String(s)))
            } else {
              userMatches = []
            }
            
            const result = validateMatching(userMatches, correctAnswerData.correctMatches, correctAnswerData.pairs)
            isCorrect = result.isCorrect
            validationDetails.matchType = 'matching'
            validationDetails.matchesCorrect = result.matchesCorrect
            validationDetails.matchesTotal = result.matchesTotal
          } else {
            // Fallback: no correctMatches data, cannot validate
            isCorrect = false
            validationDetails.matchType = 'matching_data_missing'
          }
        } else {
          // short_answer, expression, and others: use full math comparison
          const correctStr = String(correctAnswerData.value ?? correctAnswerData.latex ?? '')
          
          if (correctStr) {
            const validation = validateAnswer(
              sanitizedAnswer,
              correctStr,
              question.answer_type,
              correctAnswerData
            )
            isCorrect = validation.isCorrect
            validationDetails.matchType = validation.matchType
          } else {
            // No correct answer data available
            isCorrect = false
            validationDetails.matchType = 'no_answer_data'
          }
        }
      }
    } catch (validationError) {
      // SECURITY: If server validation fails, mark as incorrect and log for review
      // Never fall back to client-submitted isCorrect value
      console.error('Server-side validation failed:', validationError)
      isCorrect = false
      validationDetails.serverValidated = false
      validationDetails.validationError = validationError instanceof Error 
        ? validationError.message 
        : 'Unknown validation error'
    }
    
    // Record attempt with context for analytics
    const attemptContext = {
      device: request.headers.get('user-agent') || 'unknown',
      sessionType: assignmentId ? 'assignment' : 'practice',
      timestamp: new Date().toISOString(),
      validation: validationDetails, // Include server-side validation details
      serverValidated: validationDetails.serverValidated ?? true,
      clientClaimedCorrect: clientIsCorrect, // Log what client claimed for audit purposes
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
