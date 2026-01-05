import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Flag types that students can use
const STUDENT_FLAG_TYPES = [
  'incorrect_answer',
  'unclear', 
  'typo',
  'too_hard',
  'claim_correct',
  'missing_content',
  'multiple_valid',
  'other'
] as const

// Get flags for workspace (tutors get all, students get their own)
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
  const getReasons = searchParams.get('reasons') === 'true'
  
  const supabase = await createServerClient()
  
  // Return available flag reasons if requested
  if (getReasons) {
    const { data: reasons, error } = await supabase
      .from('flag_reasons')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .eq('is_active', true)
      .order('order_index')
    
    if (error) {
      // If table doesn't exist yet, return defaults
      return NextResponse.json({ 
        reasons: [
          { flag_type: 'incorrect_answer', reason_text: 'The correct answer shown is wrong' },
          { flag_type: 'unclear', reason_text: 'The question is confusing or unclear' },
          { flag_type: 'typo', reason_text: 'There is a typo in the question or answer' },
          { flag_type: 'too_hard', reason_text: 'This question is too difficult' },
          { flag_type: 'claim_correct', reason_text: 'I believe my answer is correct' },
          { flag_type: 'other', reason_text: 'Other issue' },
        ]
      })
    }
    
    return NextResponse.json({ reasons })
  }
  
  // Build query based on role - Note: we can't directly join to auth.users
  // So we'll get student info separately
  let query = supabase
    .from('question_flags')
    .select(`
      *,
      questions(id, prompt_text, prompt_latex, correct_answer_json, alternate_answers_json)
    `)
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })
  
  // Students can only see their own flags
  if (context.role === 'student') {
    query = query.eq('student_user_id', user.id)
  }
  
  const { data: flags, error } = await query
  
  if (error) {
    console.error('Error fetching flags:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Get student info from student_profiles for each unique student_user_id
  const studentUserIds = [...new Set((flags || []).map(f => f.student_user_id).filter(Boolean))]
  const studentMap: Record<string, { email: string; name: string }> = {}
  
  if (studentUserIds.length > 0) {
    const { data: students } = await supabase
      .from('student_profiles')
      .select('user_id, email, name')
      .eq('workspace_id', context.workspaceId)
      .in('user_id', studentUserIds)
    
    if (students) {
      for (const s of students) {
        if (s.user_id) {
          studentMap[s.user_id] = { email: s.email || '', name: s.name }
        }
      }
    }
  }
  
  // Attach student info to flags
  const flagsWithStudents = (flags || []).map(flag => ({
    ...flag,
    student: studentMap[flag.student_user_id] || { email: 'Unknown', name: 'Unknown' }
  }))
  
  return NextResponse.json({ flags: flagsWithStudents })
}

// Create a new flag (students can flag questions)
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
    const { questionId, flagType, comment, studentAnswer, attemptId } = body
    
    if (!questionId || !flagType) {
      return NextResponse.json(
        { error: 'Question ID and flag type are required' },
        { status: 400 }
      )
    }
    
    if (!STUDENT_FLAG_TYPES.includes(flagType)) {
      return NextResponse.json(
        { error: 'Invalid flag type' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerClient()
    
    // Verify question exists in workspace
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
    
    // Check if user already flagged this question with same type
    const { data: existingFlag } = await supabase
      .from('question_flags')
      .select('id')
      .eq('question_id', questionId)
      .eq('student_user_id', user.id)
      .eq('flag_type', flagType)
      .eq('status', 'pending')
      .maybeSingle()
    
    if (existingFlag) {
      return NextResponse.json(
        { error: 'You already have a pending flag for this question' },
        { status: 400 }
      )
    }
    
    // Create the flag
    const { data: flag, error } = await supabase
      .from('question_flags')
      .insert({
        workspace_id: context.workspaceId,
        question_id: questionId,
        student_user_id: user.id,
        flag_type: flagType,
        comment: comment || null,
        student_answer: studentAnswer || null,
        attempt_id: attemptId || null,
        status: 'pending',
      })
      .select()
      .single()
    
    if (error) {
      console.error('Create flag error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // If this is a "claim_correct" flag, immediately mark the attempt as correct
    // The tutor will review but student gets credit immediately
    if (flagType === 'claim_correct' && attemptId) {
      await supabase
        .from('attempts')
        .update({
          is_correct: true, // Mark as correct immediately
          override_correct: true,
          override_at: new Date().toISOString(),
          original_is_correct: false, // Store that it was originally wrong
        })
        .eq('id', attemptId)
        .eq('student_user_id', user.id)
    }
    
    return NextResponse.json({ flag })
  } catch (error) {
    console.error('Create flag error:', error)
    return NextResponse.json(
      { error: 'Failed to create flag' },
      { status: 500 }
    )
  }
}

// Update flag status (tutor review)
export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can review flags' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { id, status, reviewNotes, addAsAlternate } = body
    
    if (!id || !status) {
      return NextResponse.json({ error: 'Flag ID and status required' }, { status: 400 })
    }
    
    const validStatuses = ['pending', 'reviewed', 'fixed', 'dismissed', 'accepted']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // Get the flag details
    const { data: existingFlag, error: flagFetchError } = await supabase
      .from('question_flags')
      .select('*, questions(correct_answer_json, alternate_answers_json)')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (flagFetchError || !existingFlag) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }
    
    // If accepting a "claim_correct" flag, optionally add as alternate answer
    if (existingFlag.flag_type === 'claim_correct' && status === 'accepted' && addAsAlternate && existingFlag.student_answer) {
      // Get current answers
      const questions = existingFlag.questions as { correct_answer_json: { value: string; alternates?: string[] }; alternate_answers_json: string[] } | null
      const currentAlternates = questions?.correct_answer_json?.alternates || []
      const studentAnswer = existingFlag.student_answer
      
      // Add to alternates if not already present
      if (!currentAlternates.includes(studentAnswer)) {
        const updatedAnswer = {
          ...questions?.correct_answer_json,
          alternates: [...currentAlternates, studentAnswer]
        }
        
        await supabase
          .from('questions')
          .update({ 
            correct_answer_json: updatedAnswer,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFlag.question_id)
      }
      
      // Also mark the original attempt as correct
      if (existingFlag.attempt_id) {
        await supabase
          .from('attempts')
          .update({ is_correct: true })
          .eq('id', existingFlag.attempt_id)
      }
    }
    
    // Update the flag
    const { data: flag, error } = await supabase
      .from('question_flags')
      .update({
        status,
        review_notes: reviewNotes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ flag })
  } catch (error) {
    console.error('Update flag error:', error)
    return NextResponse.json(
      { error: 'Failed to update flag' },
      { status: 500 }
    )
  }
}
