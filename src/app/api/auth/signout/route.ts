import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/identity/server'

async function signOutAndRedirect() {
  try {
    await auth.api.signOut({ headers: await headers() })
  } catch {
    // No active session; nothing to clear.
  }
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
}

export async function POST() {
  return signOutAndRedirect()
}

export async function GET() {
  return signOutAndRedirect()
}
