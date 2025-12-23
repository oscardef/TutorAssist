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

    // Update private notes if provided (separate from profile creation to keep admin notes secure)
    if (data.private_notes) {
      const supabase = await createServerClient()
      await supabase
        .from('student_profiles')
        .update({ private_notes: data.private_notes })
        .eq('id', profile.id)
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
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
    }

    return NextResponse.json({ students })
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
