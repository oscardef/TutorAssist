import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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

  // Build member list - use admin client to get user names from auth metadata
  const adminClient = await createAdminClient()
  
  const formattedMembers = await Promise.all(
    (members || []).map(async (member) => {
      // For students - check student_profiles
      if (member.role === 'student') {
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('name, email')
          .eq('user_id', member.user_id)
          .eq('workspace_id', membership.workspace_id)
          .single()
        
        if (studentProfile) {
          return {
            id: member.user_id,
            email: studentProfile.email || '',
            name: studentProfile.name,
            role: member.role,
          }
        }
      }
      
      // For tutors/owners, use admin API to get their auth user info
      const { data: { user: memberUser } } = await adminClient.auth.admin.getUserById(member.user_id)
      
      if (memberUser) {
        const metadata = memberUser.user_metadata || {}
        return {
          id: member.user_id,
          email: memberUser.email || '',
          name: metadata.full_name || metadata.name || memberUser.email?.split('@')[0] || 'Tutor',
          role: member.role,
        }
      }
      
      // Fallback
      return {
        id: member.user_id,
        email: '',
        name: member.role === 'tutor' ? 'Tutor' : 'Unknown',
        role: member.role,
      }
    })
  )

  return NextResponse.json({ members: formattedMembers })
}
