import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get assignments for workspace
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
  const studentId = searchParams.get('studentId')
  const status = searchParams.get('status')
  const id = searchParams.get('id')
  
  const supabase = await createServerClient()
  
  // If specific ID is requested, get full details
  if (id) {
    const { data: assignment, error } = await supabase
      .from('assignments')
      .select(`
        *,
        student_profiles(id, name, user_id),
        assignment_items(
          id,
          question_id,
          order_index,
          points,
          question:questions(
            id,
            prompt_text,
            prompt_latex,
            difficulty,
            answer_type,
            correct_answer_json,
            hints_json,
            solution_steps_json,
            topics(id, name)
          )
        )
      `)
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ assignment })
  }
  
  let query = supabase
    .from('assignments')
    .select(`
      *,
      student_profiles(id, name),
      assignment_items(
        id,
        question_id,
        order_index,
        points
      )
    `)
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })
  
  if (studentId) {
    query = query.eq('student_profile_id', studentId)
  }
  
  if (status && ['draft', 'active', 'completed', 'archived'].includes(status)) {
    query = query.eq('status', status)
  }
  
  const { data: assignments, error } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ assignments })
}

// Create a new assignment
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can create assignments' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const {
      title,
      description,
      studentProfileId,
      questionIds = [],
      dueAt,
      settings = {},
    } = body
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // If student profile is specified, verify it belongs to workspace
    if (studentProfileId) {
      const { data: profile, error: profileError } = await supabase
        .from('student_profiles')
        .select('id, user_id')
        .eq('id', studentProfileId)
        .eq('workspace_id', context.workspaceId)
        .single()
      
      if (profileError || !profile) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }
    }
    
    // Create assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .insert({
        workspace_id: context.workspaceId,
        created_by: user.id,
        student_profile_id: studentProfileId || null,
        title,
        description: description || null,
        due_at: dueAt || null,
        settings_json: settings,
        status: 'draft',
      })
      .select()
      .single()
    
    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 })
    }
    
    // Add questions to assignment
    if (questionIds.length > 0) {
      const items = questionIds.map((questionId: string, index: number) => ({
        assignment_id: assignment.id,
        question_id: questionId,
        order_index: index,
        points: 1,
      }))
      
      const { error: itemsError } = await supabase
        .from('assignment_items')
        .insert(items)
      
      if (itemsError) {
        console.error('Error adding questions to assignment:', itemsError)
      }
    }
    
    return NextResponse.json({ assignment })
  } catch (error) {
    console.error('Create assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    )
  }
}

// Update an assignment
export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can update assignments' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { id, title, description, dueAt, status, settings } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (dueAt !== undefined) updateData.due_at = dueAt
    if (status !== undefined) updateData.status = status
    if (settings !== undefined) updateData.settings_json = settings
    updateData.updated_at = new Date().toISOString()
    
    const { data: assignment, error } = await supabase
      .from('assignments')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ assignment })
  } catch (error) {
    console.error('Update assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    )
  }
}

// Delete an assignment
export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can delete assignments' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 })
  }
  
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', id)
    .eq('workspace_id', context.workspaceId)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}
