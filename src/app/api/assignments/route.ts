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
    
    // Check if this is a parent assignment and fetch child assignment items
    const isParent = assignment.settings_json?.isParent === true
    let childAssignments: typeof assignment[] = []
    let allItems = assignment.assignment_items || []
    
    if (isParent) {
      // Fetch child assignments with their items
      const { data: children, error: childError } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          settings_json,
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
        .eq('parent_assignment_id', id)
        .eq('workspace_id', context.workspaceId)
        .order('created_at', { ascending: true })
      
      if (!childError && children) {
        childAssignments = children
        // Aggregate all items from child assignments with part info
        let globalIndex = 0
        for (const child of children) {
          const partNumber = child.settings_json?.partNumber || 1
          const childItems = (child.assignment_items || []).map((item: Record<string, unknown>) => ({
            ...item,
            partNumber,
            partTitle: child.title,
            order_index: globalIndex++,
          }))
          allItems = [...allItems, ...childItems]
        }
      }
    }
    
    return NextResponse.json({ 
      assignment: {
        ...assignment,
        assignment_items: allItems,
      },
      childAssignments,
      isParent,
    })
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
    
    // If student profile is specified, verify it belongs to workspace and get user_id
    let assignedStudentUserId: string | null = null
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
      
      // Set the user_id for the assignment so students can see it
      assignedStudentUserId = profile.user_id
    }
    
    // Create assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .insert({
        workspace_id: context.workspaceId,
        created_by: user.id,
        student_profile_id: studentProfileId || null,
        assigned_student_user_id: assignedStudentUserId,
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
  if (!context) {
    return NextResponse.json({ error: 'No workspace context' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { id, title, description, dueAt, status, settings, notifyStudent } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // Students can only update status to 'completed' or 'active' (for redo)
    if (context.role === 'student') {
      if (status && !['completed', 'active'].includes(status)) {
        return NextResponse.json({ error: 'Students can only complete assignments' }, { status: 403 })
      }
      
      // Verify the assignment belongs to this student
      const { data: existingAssignment } = await supabase
        .from('assignments')
        .select('assigned_student_user_id')
        .eq('id', id)
        .eq('workspace_id', context.workspaceId)
        .single()
      
      if (!existingAssignment || existingAssignment.assigned_student_user_id !== user.id) {
        return NextResponse.json({ error: 'Assignment not found or not assigned to you' }, { status: 404 })
      }
      
      // Only allow status update for students
      const { data: assignment, error } = await supabase
        .from('assignments')
        .update({ 
          status, 
          updated_at: new Date().toISOString(),
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {})
        })
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ assignment })
    }
    
    // Tutors can update everything
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
      .select(`
        *,
        student_profiles(id, name, user_id)
      `)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Send notification email if requested and assignment is being activated
    if (notifyStudent && status === 'active' && assignment.student_profile_id) {
      try {
        // Get student email from auth.users via student_profile
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('user_id, name')
          .eq('id', assignment.student_profile_id)
          .single()
        
        if (studentProfile?.user_id) {
          // Get the user's email from auth
          const { data: { users } } = await supabase.auth.admin.listUsers()
          const studentUser = users?.find(u => u.id === studentProfile.user_id)
          const studentEmail = studentUser?.email
          
          if (studentEmail) {
            // Get workspace name
            const { data: workspace } = await supabase
              .from('workspaces')
              .select('name')
              .eq('id', context.workspaceId)
              .single()
            
            // Send email notification
            const nodemailer = await import('nodemailer')
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
              },
            })
            
            const dueText = assignment.due_at 
              ? `Due: ${new Date(assignment.due_at).toLocaleDateString('en-GB')}`
              : ''
            
            await transporter.sendMail({
              from: `"${workspace?.name || 'TutorAssist'}" <${process.env.SMTP_EMAIL}>`,
              to: studentEmail,
              subject: `New Assignment: ${assignment.title}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">New Assignment Available</h2>
                  <p>Hi ${studentProfile.name || 'there'},</p>
                  <p>You have a new assignment waiting for you:</p>
                  <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <h3 style="margin: 0 0 8px 0;">${assignment.title}</h3>
                    ${assignment.description ? `<p style="color: #6b7280; margin: 0;">${assignment.description}</p>` : ''}
                    ${dueText ? `<p style="color: #dc2626; margin: 8px 0 0 0; font-weight: 500;">${dueText}</p>` : ''}
                  </div>
                  <p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/student/assignments/${assignment.id}" 
                       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                      View Assignment
                    </a>
                  </p>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                    - ${workspace?.name || 'Your Tutor'}
                  </p>
                </div>
              `,
            })
          }
        }
      } catch (emailError) {
        console.error('Failed to send assignment notification email:', emailError)
        // Don't fail the request if email fails
      }
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
