import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Fast cookie-only gate for protected pages. It does not validate the session;
 * every page and API route still verifies it (see lib/auth.ts). Onboarding
 * redirects for users without a workspace are handled by requireUserContext().
 *
 * It also sets a per-request Content-Security-Policy with a nonce, which
 * Next applies to its own scripts. The policy blocks by default (checked
 * against every page on 2026-10-30); CSP_MODE=report-only only reports, as
 * an escape hatch if a new feature trips it.
 */
const publicPrefixes = ['/privacy', '/login', '/signup', '/reset-password', '/forgot-password', '/invite', '/auth', '/api', '/_next', '/favicon.ico']

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    // JSXGraph compiles plotted expressions with Function(), hence unsafe-eval
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
    // KaTeX, MathLive, Excalidraw and JSXGraph set inline styles
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    // MathLive and Excalidraw fetch their fonts from CDNs
    "font-src 'self' data: https://unpkg.com https://esm.sh",
    "connect-src 'self' https://unpkg.com https://esm.sh",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = pathname === '/' || publicPrefixes.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))
  if (!isPublic && !getSessionCookie(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return NextResponse.next()

  const nonce = btoa(crypto.randomUUID())
  const csp = contentSecurityPolicy(nonce)
  const header = process.env.CSP_MODE === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Next reads the nonce from the request's CSP header to tag its scripts
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(header, csp)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
