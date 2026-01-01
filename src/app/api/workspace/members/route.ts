import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's workspace from workspace_members
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!membership?.workspace_id) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  // Get optional role filter
  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')

  // Build query for workspace members
  let query = supabase
    .from('workspace_members')
    .select('user_id, role, joined_at')
    .eq('workspace_id', membership.workspace_id)

  // Apply role filter if provided
  if (roleFilter) {
    query = query.eq('role', roleFilter)
  }

  const { data: members, error } = await query.order('joined_at')

  if (error) {
    console.error('Error fetching workspace members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }

  // Get user details from auth.users via admin API or raw query
  // Since we can't directly query auth.users, we'll use the service role
  // For now, get emails from the authenticated user's perspective
  const userIds = members?.map(m => m.user_id) || []
  
  // Build member list - we'll need to get names from student_profiles or email prefix
  const formattedMembers = await Promise.all(
    (members || []).map(async (member) => {
      // Try to get name from student_profiles if they're a student
      let name = 'Unknown'
      let email = ''
      
      if (member.role === 'student') {
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('name, email')
          .eq('user_id', member.user_id)
          .eq('workspace_id', membership.workspace_id)
          .single()
        
        if (studentProfile) {
          name = studentProfile.name
          email = studentProfile.email || ''
        }
      } else {
        // For tutors, try to get from user metadata via auth
        // We'll use the current user if it matches, otherwise use a placeholder
        if (member.user_id === user.id) {
          const metadata = user.user_metadata || {}
          name = metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Tutor'
          email = user.email || ''
        } else {
          // For other tutors, we can try to lookup in workspace settings or use ID
          name = 'Tutor'
          email = ''
        }
      }
      
      return {
        id: member.user_id,
        email,
        name,
        role: member.role,
      }
    })
  )

  return NextResponse.json({ members: formattedMembers })
}
