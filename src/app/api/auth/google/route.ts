import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getAuthUrl } from '@/lib/google'
import { v4 as uuidv4 } from 'uuid'
import { cookies } from 'next/headers'

export async function GET() {
  const user = await requireUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Generate state for CSRF protection
  const state = uuidv4()
  
  // Store state in cookie for verification
  const cookieStore = await cookies()
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })
  
  const authUrl = getAuthUrl(state)
  
  return NextResponse.redirect(authUrl)
}
