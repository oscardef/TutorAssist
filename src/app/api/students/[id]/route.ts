import { createServerClient } from '@/lib/supabase/server'
import { requireTutor } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET single student
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
      .select('*')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single()

    if (error || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    return NextResponse.json(student)
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
