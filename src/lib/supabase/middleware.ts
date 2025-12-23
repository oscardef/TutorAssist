import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Don't redirect API routes - let them handle auth themselves
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup', '/auth/callback', '/invite']
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname === route || 
    request.nextUrl.pathname.startsWith('/invite/')
  )

  if (!user && !isPublicRoute) {
    // No user and trying to access protected route
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in but hasn't completed onboarding
  if (user && !isPublicRoute && request.nextUrl.pathname !== '/onboarding') {
    // Check if user has workspace membership
    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    console.log('[Middleware] User:', user.id)
    console.log('[Middleware] Path:', request.nextUrl.pathname)
    console.log('[Middleware] Membership check result:', { membership, error })

    // If there's an error (e.g., table doesn't exist), let the request through
    // The API will handle it with better error messages
    if (error) {
      console.error('Middleware membership check error:', error)
      // Don't redirect if there's a database error
      return supabaseResponse
    }

    if (!membership && request.nextUrl.pathname !== '/onboarding') {
      console.log('[Middleware] No membership found, redirecting to /onboarding')
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
