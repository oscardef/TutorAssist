import { createServerClient } from '@/lib/supabase/server'
import { createWorkspace } from '@/lib/workspace'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Auth error:', userError)
      return NextResponse.json({ error: 'Authentication error', details: userError.message }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - no user found' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
    }

    // Check if user already has a workspace
    const { data: existingMembership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      console.error('Error checking membership:', membershipError)
      return NextResponse.json({ 
        error: 'Database error - ensure migrations have been run', 
        details: membershipError.message 
      }, { status: 500 })
    }

    if (existingMembership) {
      return NextResponse.json({ error: 'You already have a workspace' }, { status: 400 })
    }

    const result = await createWorkspace(user.id, name.trim())

    if (!result) {
      return NextResponse.json({ error: 'Failed to create workspace - check server logs' }, { status: 500 })
    }

    return NextResponse.json({
      workspace: result.workspace,
      membership: result.membership,
    })
  } catch (error) {
    console.error('Error creating workspace:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
