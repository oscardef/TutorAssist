import { NextResponse } from 'next/server'

// Legacy Supabase email-confirmation callback. Better Auth verification links
// land on /api/auth/verify-email and redirect themselves; this route only
// forwards old links that are still in someone's inbox.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get('next') ?? '/onboarding'
  return NextResponse.redirect(`${origin}${next}`)
}
