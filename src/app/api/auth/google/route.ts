import { NextRequest, NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { getAuthUrl } from '@/lib/google'
import { v4 as uuidv4 } from 'uuid'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const user = await requireUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Generate state for CSRF protection
  const state = uuidv4()
  
  // Get return URL from query param, or determine default based on role
  const context = await getUserContext()
  const searchParams = request.nextUrl.searchParams
  const returnTo = searchParams.get('returnTo') || 
    (context?.role === 'student' ? '/student/settings' : '/tutor/settings')
  
  // Store state and returnTo in cookies for verification
  const cookieStore = await cookies()
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })
  cookieStore.set('oauth_return_to', returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })
  
  const authUrl = getAuthUrl(state)
  
  return NextResponse.redirect(authUrl)
}
