import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { getUsersByIds } from '@/lib/users'

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

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

  if (roleFilter) {
    query = query.eq('role', roleFilter)
  }

  const { data: members, error } = await query.order('joined_at')

  if (error) {
    console.error('Error fetching workspace members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }

  const memberList = members || []
  const directory = await getUsersByIds(memberList.map(m => m.user_id))

  const formattedMembers = await Promise.all(
    memberList.map(async (member) => {
      // For students - prefer the student profile (name as entered by the tutor)
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

      const memberUser = directory.get(member.user_id)
      if (memberUser) {
        return {
          id: member.user_id,
          email: memberUser.email,
          name: memberUser.name || memberUser.email.split('@')[0] || 'Tutor',
          role: member.role,
        }
      }

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
