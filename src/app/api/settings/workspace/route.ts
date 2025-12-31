import { NextRequest, NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireTutor()
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('workspaces')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', context.workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating workspace:', error)
      return NextResponse.json(
        { error: 'Failed to update workspace' },
        { status: 500 }
      )
    }

    return NextResponse.json({ workspace: data })
  } catch (error) {
    console.error('Workspace update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTutor()
    const body = await request.json()
    const { action } = body

    const supabase = await createAdminClient()

    if (action === 'generate_invite') {
      // Generate a new invite token using the invite_tokens table
      const token = crypto.randomUUID()
      
      // Set expiration to 30 days from now
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      
      const { error } = await supabase
        .from('invite_tokens')
        .insert({
          workspace_id: context.workspaceId,
          token,
          expires_at: expiresAt.toISOString(),
          created_by: context.userId,
        })
        .select()
        .single()

      if (error) {
        console.error('Error generating invite:', error)
        return NextResponse.json(
          { error: 'Failed to generate invite link' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        invite_token: token,
        invite_url: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Workspace action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
