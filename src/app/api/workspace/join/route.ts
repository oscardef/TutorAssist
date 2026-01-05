import { createServerClient } from '@/lib/supabase/server'
import { redeemInviteToken } from '@/lib/workspace'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.email) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 })
    }

    const { token } = await request.json()

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 })
    }

    const result = await redeemInviteToken(token.trim(), user.id, user.email)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true,
      alreadyMember: result.alreadyMember || false 
    })
  } catch (error) {
    console.error('Error joining workspace:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
