import { createServerClient } from '@/lib/supabase/server'
import { requireTutor } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET single student with full details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const context = await requireTutor()
    const supabase = await createServerClient()

    const { data: student, error } = await supabase
      .from('student_profiles')
      .select(`
        *,
        study_program:study_programs(id, code, name, color),
        grade_level:grade_levels(id, code, name, year_number)
      `)
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()

    if (error || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Get assigned tutor info if exists
    let assignedTutor = null
    if (student.assigned_tutor_id) {
      const { data: tutorProfile } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .eq('user_id', student.assigned_tutor_id)
        .eq('workspace_id', context.workspaceId)
        .single()
      
      if (tutorProfile) {
        assignedTutor = {
          id: tutorProfile.user_id,
          email: tutorProfile.email || '',
          name: tutorProfile.name || tutorProfile.email?.split('@')[0] || 'Unknown'
        }
      }
    }

    return NextResponse.json({ 
      ...student,
      assigned_tutor: assignedTutor
    })
  } catch (error) {
    console.error('Error fetching student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH update student
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const context = await requireTutor()
    const supabase = await createServerClient()
    const data = await request.json()

    // Verify student belongs to this workspace
    const { data: existing } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    
    if (data.name !== undefined) updates.name = data.name.trim()
    if (data.email !== undefined) updates.email = data.email?.trim() || null
    if (data.parent_email !== undefined) updates.parent_email = data.parent_email?.trim() || null
    if (data.additional_emails !== undefined) {
      updates.additional_emails = Array.isArray(data.additional_emails) 
        ? data.additional_emails.filter((e: string) => e?.trim())
        : []
    }
    if (data.age !== undefined) updates.age = data.age || null
    if (data.school !== undefined) updates.school = data.school?.trim() || null
    if (data.grade_current !== undefined) updates.grade_current = data.grade_current?.trim() || null
    if (data.private_notes !== undefined) updates.private_notes = data.private_notes?.trim() || null
    
    // Program and grade level
    if (data.study_program_id !== undefined) updates.study_program_id = data.study_program_id || null
    if (data.grade_level_id !== undefined) updates.grade_level_id = data.grade_level_id || null
    
    // Assigned tutor
    if (data.assigned_tutor_id !== undefined) updates.assigned_tutor_id = data.assigned_tutor_id || null
    
    // Grade rollover month (1-12)
    if (data.grade_rollover_month !== undefined) {
      const month = parseInt(data.grade_rollover_month)
      if (month >= 1 && month <= 12) {
        updates.grade_rollover_month = month
      }
    }

    const { data: updated, error } = await supabase
      .from('student_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating student:', error)
      return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE student
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const context = await requireTutor()
    const supabase = await createServerClient()

    // Verify student belongs to this workspace
    const { data: existing } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Delete any pending invite tokens for this student
    await supabase
      .from('invite_tokens')
      .delete()
      .eq('student_profile_id', id)
      .eq('workspace_id', context.workspaceId)

    // Delete student (cascade should handle related records)
    const { error } = await supabase
      .from('student_profiles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting student:', error)
      return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
