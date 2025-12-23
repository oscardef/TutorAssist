import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get flags for workspace
export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  const supabase = await createServerClient()
  
  const { data: flags, error } = await supabase
    .from('question_flags')
    .select(`
      *,
      questions(id, prompt_text, correct_answer_json),
      student:student_user_id(email)
    `)
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ flags })
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
    const { id, status, reviewNotes } = body
    
    if (!id || !status) {
      return NextResponse.json({ error: 'Flag ID and status required' }, { status: 400 })
    }
    
    const validStatuses = ['pending', 'reviewed', 'fixed', 'dismissed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
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
