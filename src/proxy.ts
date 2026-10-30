import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Fast cookie-only gate for protected pages. It does not validate the session;
 * every page and API route still verifies it (see lib/auth.ts). Onboarding
 * redirects for users without a workspace are handled by requireUserContext().
 */
const publicPrefixes = ['/login', '/signup', '/reset-password', '/forgot-password', '/invite', '/auth', '/api', '/_next', '/favicon.ico']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/' || publicPrefixes.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))) {
    return NextResponse.next()
  }
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
