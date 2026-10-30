import { auth } from '@/lib/identity/server'
import { toNextJsHandler } from 'better-auth/next-js'

// Better Auth endpoints (/api/auth/sign-in/email, /api/auth/get-session, ...).
// More specific static routes under /api/auth (google calendar OAuth, signout, status) take precedence.
const handlers = toNextJsHandler(auth)
export const GET = handlers.GET
export const POST = handlers.POST
