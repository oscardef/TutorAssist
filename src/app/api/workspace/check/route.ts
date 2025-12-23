import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ hasWorkspace: false }, { status: 200 })
    }

    // Check if user has a workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role, workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      console.error('Error checking membership:', membershipError)
      return NextResponse.json({ hasWorkspace: false }, { status: 200 })
    }

    if (membership) {
      return NextResponse.json({
        hasWorkspace: true,
        role: membership.role,
        workspaceId: membership.workspace_id,
      })
    }

    return NextResponse.json({ hasWorkspace: false })
  } catch (error) {
    console.error('Error checking workspace:', error)
    return NextResponse.json({ hasWorkspace: false }, { status: 200 })
  }
}
