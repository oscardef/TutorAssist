import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getTokensFromCode, getGoogleUserInfo, saveOAuthConnection } from '@/lib/google'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const user = await requireUser()
  
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  
  // Check for errors from Google
  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(
      new URL('/tutor/settings?error=google_auth_failed', request.url)
    )
  }
  
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/tutor/settings?error=missing_params', request.url)
    )
  }
  
  // Verify state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('oauth_state')?.value
  
  if (state !== storedState) {
    return NextResponse.redirect(
      new URL('/tutor/settings?error=invalid_state', request.url)
    )
  }
  
  // Clear the state cookie
  cookieStore.delete('oauth_state')
  
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
      new URL('/tutor/settings?success=google_connected', request.url)
    )
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(
      new URL('/tutor/settings?error=token_exchange_failed', request.url)
    )
  }
}
