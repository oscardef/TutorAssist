import { createServerClient } from '@/lib/supabase/server'
import { requireTutor } from '@/lib/auth'
import { createStudentProfile, createInviteToken } from '@/lib/workspace'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const context = await requireTutor()
    const data = await request.json()

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Create student profile
    const profile = await createStudentProfile(context.workspaceId, {
      name: data.name.trim(),
      email: data.email?.trim() || undefined,
      age: data.age || undefined,
      school: data.school?.trim() || undefined,
      grade_current: data.grade_current?.trim() || undefined,
    })

    if (!profile) {
      return NextResponse.json({ error: 'Failed to create student profile' }, { status: 500 })
    }

    // Update additional fields - separate core vs optional (migration-dependent) fields
    const supabase = await createServerClient()
    const coreUpdates: Record<string, unknown> = {}
    const optionalUpdates: Record<string, unknown> = {}
    
    // Core field
    if (data.private_notes) {
      coreUpdates.private_notes = data.private_notes
    }
    if (data.grade_rollover_month !== undefined) {
      const month = parseInt(data.grade_rollover_month)
      if (month >= 1 && month <= 12) {
        coreUpdates.grade_rollover_month = month
      }
    }
    
    // Optional fields (from migrations - may not exist)
    if (data.parent_email?.trim()) {
      optionalUpdates.parent_email = data.parent_email.trim()
    }
    if (data.additional_emails?.length > 0) {
      optionalUpdates.additional_emails = data.additional_emails.filter((e: string) => e?.trim())
    }
    if (data.study_program_id) {
      optionalUpdates.study_program_id = data.study_program_id
    }
    if (data.grade_level_id) {
      optionalUpdates.grade_level_id = data.grade_level_id
    }
    if (data.assigned_tutor_id) {
      optionalUpdates.assigned_tutor_id = data.assigned_tutor_id
    }
    
    // Update core fields
    if (Object.keys(coreUpdates).length > 0) {
      await supabase
        .from('student_profiles')
        .update(coreUpdates)
        .eq('id', profile.id)
    }
    
    // Try to update optional fields (silently ignore schema errors)
    if (Object.keys(optionalUpdates).length > 0) {
      const { error: optError } = await supabase
        .from('student_profiles')
        .update(optionalUpdates)
        .eq('id', profile.id)
      
      if (optError && !optError.message.includes('schema cache')) {
        console.error('Error updating optional student fields:', optError)
      }
    }

    // Create invite token
    const token = await createInviteToken(
      context.workspaceId,
      context.userId,
      profile.id,
      data.email?.trim()
    )

    if (!token) {
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    // Generate invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/invite/${token.token}`

    return NextResponse.json({
      profile,
      inviteLink,
    })
  } catch (error) {
    console.error('Error creating student:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const context = await requireTutor()
    const supabase = await createServerClient()

    const { data: students, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .order('name')

    if (error) {
      console.error('Error fetching students:', error)
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
    }

    return NextResponse.json({ students: students || [] })
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
