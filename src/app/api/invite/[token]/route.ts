import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createAdminClient()

    // Get the invite token (without joins since FK relationships may not exist)
    const { data: invite, error } = await supabase
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !invite) {
      console.error('[Invite API] Error fetching invite:', error)
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Fetch workspace name separately
    let workspaceName = 'Unknown Workspace'
    if (invite.workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', invite.workspace_id)
        .single()
      if (workspace?.name) {
        workspaceName = workspace.name
      }
    }

    // Fetch student profile info separately
    let studentName: string | undefined
    let studentEmail: string | undefined
    let isAlreadyClaimed = false
    if (invite.student_profile_id) {
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('name, email, user_id')
        .eq('id', invite.student_profile_id)
        .single()
      if (profile?.name) {
        studentName = profile.name
      }
      if (profile?.email) {
        studentEmail = profile.email
      }
      // Check if already claimed by another user
      if (profile?.user_id) {
        isAlreadyClaimed = true
      }
    }

    // Determine the expected email for this invite
    const expectedEmail = studentEmail || invite.email

    // Get tutor name from auth.users using admin client
    let tutorName = 'Your Tutor'
    if (invite.created_by) {
      const { data: userData } = await supabase.auth.admin.getUserById(invite.created_by)
      if (userData?.user?.user_metadata?.full_name) {
        tutorName = userData.user.user_metadata.full_name
      }
    }

    const now = new Date()
    const expiresAt = new Date(invite.expires_at)
    const isExpired = expiresAt < now
    const isUsed = !!invite.used_at

    return NextResponse.json({
      workspaceName,
      tutorName,
      studentName,
      expectedEmail, // The email that should be used to claim this invite
      expiresAt: invite.expires_at,
      isExpired,
      isUsed,
      isAlreadyClaimed, // If another user has already claimed this student profile
    })
  } catch (error) {
    console.error('Error fetching invite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
