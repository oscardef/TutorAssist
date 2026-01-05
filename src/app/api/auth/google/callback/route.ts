import { NextRequest, NextResponse } from 'next/server'
import { getUser, getUserContext } from '@/lib/auth'
import { getTokensFromCode, getGoogleUserInfo, saveOAuthConnection } from '@/lib/google'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  
  // Get user - don't use requireUser as it redirects and we need better error handling
  const user = await getUser()
  
  // Get return URL from cookie, or determine default based on role
  const context = await getUserContext()
  const returnTo = cookieStore.get('oauth_return_to')?.value || 
    (context?.role === 'student' ? '/student/settings' : '/tutor/settings')
  
  if (!user) {
    // Session expired during OAuth flow - redirect to login with message
    return NextResponse.redirect(new URL('/login?error=session_expired', request.url))
  }
  
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  
  // Check for errors from Google
  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(
      new URL(`${returnTo}?error=google_auth_failed`, request.url)
    )
  }
  
  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`${returnTo}?error=missing_params`, request.url)
    )
  }
  
  // Verify state
  const storedState = cookieStore.get('oauth_state')?.value
  
  if (state !== storedState) {
    return NextResponse.redirect(
      new URL(`${returnTo}?error=invalid_state`, request.url)
    )
  }
  
  // Clear the cookies
  cookieStore.delete('oauth_state')
  cookieStore.delete('oauth_return_to')
  
  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code)
    
    if (!tokens.access_token) {
      throw new Error('No access token received')
    }
    
    // Get user info
    const userInfo = await getGoogleUserInfo(tokens.access_token)
    
    // Save connection
    await saveOAuthConnection(user.id, tokens, userInfo)
    
    return NextResponse.redirect(
      new URL(`${returnTo}?success=google_connected`, request.url)
    )
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(
      new URL(`${returnTo}?error=token_exchange_failed`, request.url)
    )
  }
}
