import { google } from 'googleapis'
import { createServerClient } from '@/lib/supabase/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

// Scopes for calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

// Create OAuth2 client
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  )
}

// Generate authorization URL
export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client()
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // Force consent to get refresh token
  })
}

// Exchange code for tokens
export async function getTokensFromCode(code: string) {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

// Get authenticated OAuth2 client for a user
export async function getAuthenticatedClient(userId: string) {
  const supabase = await createServerClient()
  
  const { data: connection, error } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single()
  
  if (error || !connection) {
    return null
  }
  
  const oauth2Client = createOAuth2Client()
  
  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.expires_at ? new Date(connection.expires_at).getTime() : undefined,
  })
  
  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    await supabase
      .from('oauth_connections')
      .update({
        access_token: tokens.access_token,
        expires_at: tokens.expiry_date 
          ? new Date(tokens.expiry_date).toISOString() 
          : null,
      })
      .eq('id', connection.id)
  })
  
  return oauth2Client
}

// Save OAuth connection
export async function saveOAuthConnection(
  userId: string,
  tokens: {
    access_token?: string | null
    refresh_token?: string | null
    expiry_date?: number | null
  },
  userInfo: { email: string }
) {
  const supabase = await createServerClient()
  
  // Check if connection already exists
  const { data: existing } = await supabase
    .from('oauth_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single()
  
  const connectionData = {
    user_id: userId,
    provider: 'google' as const,
    provider_user_id: userInfo.email,
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || null,
    expires_at: tokens.expiry_date 
      ? new Date(tokens.expiry_date).toISOString() 
      : null,
  }
  
  if (existing) {
    await supabase
      .from('oauth_connections')
      .update(connectionData)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('oauth_connections')
      .insert(connectionData)
  }
}

// Get user info from Google
export async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  
  if (!response.ok) {
    throw new Error('Failed to get user info')
  }
  
  return response.json() as Promise<{
    id: string
    email: string
    name: string
    picture: string
  }>
}
