import { createServerClient, createAdminClient } from '@/lib/supabase/server'
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
        study_program:study_programs!student_profiles_study_program_id_fkey(id, code, name, color),
        grade_level:grade_levels!student_profiles_grade_level_id_fkey(id, code, name, year_number)
      `)
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()

    if (error || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Get assigned tutor info if exists
    // Note: profiles table doesn't exist, use workspace_members instead
    let assignedTutor = null
    if (student.assigned_tutor_id) {
      const { data: tutorMember } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('user_id', student.assigned_tutor_id)
        .eq('workspace_id', context.workspaceId)
        .single()
      
      if (tutorMember) {
        assignedTutor = {
          id: tutorMember.user_id,
          email: '',
          name: 'Tutor' // Names would need to come from auth metadata
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

    // Build update object - only include core fields that exist in base schema
    // Optional migration fields are handled separately with error catching
    const coreUpdates: Record<string, unknown> = {}
    const optionalUpdates: Record<string, unknown> = {}
    
    // Core fields (always in schema)
    if (data.name !== undefined) coreUpdates.name = data.name.trim()
    if (data.email !== undefined) coreUpdates.email = data.email?.trim() || null
    if (data.age !== undefined) coreUpdates.age = data.age || null
    if (data.school !== undefined) coreUpdates.school = data.school?.trim() || null
    if (data.grade_current !== undefined) coreUpdates.grade_current = data.grade_current?.trim() || null
    if (data.private_notes !== undefined) coreUpdates.private_notes = data.private_notes?.trim() || null
    if (data.grade_rollover_month !== undefined) {
      const month = parseInt(data.grade_rollover_month)
      if (month >= 1 && month <= 12) {
        coreUpdates.grade_rollover_month = month
      }
    }
    
    // Optional fields (from migrations - may not exist)
    if (data.parent_email !== undefined) optionalUpdates.parent_email = data.parent_email?.trim() || null
    if (data.additional_emails !== undefined) {
      optionalUpdates.additional_emails = Array.isArray(data.additional_emails) 
        ? data.additional_emails.filter((e: string) => e?.trim())
        : []
    }
    if (data.study_program_id !== undefined) optionalUpdates.study_program_id = data.study_program_id || null
    if (data.grade_level_id !== undefined) optionalUpdates.grade_level_id = data.grade_level_id || null
    if (data.assigned_tutor_id !== undefined) optionalUpdates.assigned_tutor_id = data.assigned_tutor_id || null

    // First update core fields
    let updated = null
    if (Object.keys(coreUpdates).length > 0) {
      const { data: result, error } = await supabase
        .from('student_profiles')
        .update(coreUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating student core fields:', error)
        return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
      }
      updated = result
    }
    
    // Try to update optional fields one group at a time to handle missing columns
    if (Object.keys(optionalUpdates).length > 0) {
      // Try migration-002 fields (parent_email, additional_emails)
      const emailFields: Record<string, unknown> = {}
      if (optionalUpdates.parent_email !== undefined) emailFields.parent_email = optionalUpdates.parent_email
      if (optionalUpdates.additional_emails !== undefined) emailFields.additional_emails = optionalUpdates.additional_emails
      
      if (Object.keys(emailFields).length > 0) {
        const { data: emailResult, error: emailError } = await supabase
          .from('student_profiles')
          .update(emailFields)
          .eq('id', id)
          .select()
          .single()
        
        if (!emailError && emailResult) {
          updated = emailResult
        } else if (emailError) {
          // Silently ignore - columns may not exist (migration 002 not applied)
          console.log('Note: parent_email/additional_emails columns may not exist yet')
        }
      }
      
      // Try migration-009 and 014 fields (program, grade, tutor)
      const programFields: Record<string, unknown> = {}
      if (optionalUpdates.study_program_id !== undefined) programFields.study_program_id = optionalUpdates.study_program_id
      if (optionalUpdates.grade_level_id !== undefined) programFields.grade_level_id = optionalUpdates.grade_level_id
      if (optionalUpdates.assigned_tutor_id !== undefined) programFields.assigned_tutor_id = optionalUpdates.assigned_tutor_id
      
      if (Object.keys(programFields).length > 0) {
        const { data: progResult, error: progError } = await supabase
          .from('student_profiles')
          .update(programFields)
          .eq('id', id)
          .select()
          .single()
        
        if (!progError && progResult) {
          updated = progResult
        } else if (progError) {
          console.error('Error updating program/grade/tutor fields:', progError)
          // These fields should exist - return error if they don't
          return NextResponse.json({ 
            error: 'Failed to update student. Program/grade fields may need migration 009 applied.' 
          }, { status: 500 })
        }
      }
    }
    
    // If no updates were made, fetch current data
    if (!updated) {
      const { data: current } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('id', id)
        .single()
      updated = current
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
    const adminClient = await createAdminClient()

    // Verify student belongs to this workspace and get user_id
    const { data: existing } = await supabase
      .from('student_profiles')
      .select('id, user_id')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const authUserId = existing.user_id

    // Delete any pending invite tokens for this student
    await adminClient
      .from('invite_tokens')
      .delete()
      .eq('student_profile_id', id)

    // If user has an auth account, clean up all related records first
    // These tables have foreign keys to auth.users that block deletion
    if (authUserId) {
      // Delete attempts by this user in this workspace
      await adminClient
        .from('attempts')
        .delete()
        .eq('student_user_id', authUserId)
        .eq('workspace_id', context.workspaceId)

      // Delete spaced repetition records
      await adminClient
        .from('spaced_repetition')
        .delete()
        .eq('student_user_id', authUserId)
        .eq('workspace_id', context.workspaceId)

      // Delete question flags by this user
      await adminClient
        .from('question_flags')
        .delete()
        .eq('student_user_id', authUserId)
        .eq('workspace_id', context.workspaceId)

      // Clear assigned_student_user_id on assignments (set to NULL instead of delete)
      await adminClient
        .from('assignments')
        .update({ assigned_student_user_id: null })
        .eq('assigned_student_user_id', authUserId)
        .eq('workspace_id', context.workspaceId)

      // Delete workspace membership
      await adminClient
        .from('workspace_members')
        .delete()
        .eq('user_id', authUserId)
        .eq('workspace_id', context.workspaceId)
    }

    // Delete student profile
    const { error } = await adminClient
      .from('student_profiles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting student profile:', error)
      return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
    }

    // Delete the auth user if they had one
    // This ensures they can be re-invited with the same email
    if (authUserId) {
      const { error: authError } = await adminClient.auth.admin.deleteUser(authUserId)
      if (authError) {
        console.error('Error deleting auth user:', authError)
        // This shouldn't happen now that we clean up FK references, but log it
        return NextResponse.json({ 
          error: 'Student data deleted but auth account remains. Contact support.' 
        }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
