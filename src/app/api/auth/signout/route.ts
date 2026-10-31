import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/identity/server'

async function signOutAndRedirect() {
  const response = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
  try {
    // Pass on Better Auth's Set-Cookie headers so the browser drops the session cookie too
    const result = await auth.api.signOut({ headers: await headers(), returnHeaders: true })
    for (const cookie of result.headers.getSetCookie()) {
      // Emptied cookies should expire now rather than linger as empty session cookies
      const cleared = /^[^=]+=;/.test(cookie) && !/max-age/i.test(cookie)
      response.headers.append('set-cookie', cleared ? `${cookie}; Max-Age=0` : cookie)
    }
  } catch {
    // No active session; nothing to clear.
  }
  return response
}

export async function POST() {
  return signOutAndRedirect()
}

export async function GET() {
  return signOutAndRedirect()
}
