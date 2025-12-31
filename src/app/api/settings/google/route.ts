import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const user = await requireUser()
    const supabase = await createAdminClient()

    const { error } = await supabase
      .from('oauth_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google')

    if (error) {
      console.error('Error disconnecting Google:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect Google Calendar' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Google disconnect error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
