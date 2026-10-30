import { PostgrestClient } from '@supabase/postgrest-js'
import { SignJWT } from 'jose'
import { headers } from 'next/headers'
import { auth } from '@/lib/identity/server'

/**
 * Data access goes through PostgREST, which enforces the row-level-security
 * policies with the JWT we mint here from the Better Auth session. The API is
 * the same query builder the codebase already uses (`from`, `select`, `rpc`),
 * so call sites did not change when the backend moved off Supabase.
 */

export type DataClient = PostgrestClient

const postgrestUrl = () => {
  const url = process.env.POSTGREST_URL
  if (!url) throw new Error('POSTGREST_URL is not set')
  return url.replace(/\/$/, '')
}

const jwtSecret = () => {
  const secret = process.env.PGRST_JWT_SECRET
  if (!secret) throw new Error('PGRST_JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

async function mintToken(claims: { role: 'anon' | 'authenticated' | 'service_role'; sub?: string; email?: string }) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(jwtSecret())
}

function clientWithToken(token: string): PostgrestClient {
  return new PostgrestClient(postgrestUrl(), {
    headers: { Authorization: `Bearer ${token}` },
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  })
}

/** Client acting as the signed-in user (RLS applies). Anonymous when there is no session. */
export async function createClient(): Promise<PostgrestClient> {
  const session = await auth.api.getSession({ headers: await headers() })
  const token = session
    ? await mintToken({ role: 'authenticated', sub: session.user.id, email: session.user.email })
    : await mintToken({ role: 'anon' })
  return clientWithToken(token)
}

/** Client with the service role (bypasses RLS). Server-side only. */
export async function createAdminClient(): Promise<PostgrestClient> {
  return clientWithToken(await mintToken({ role: 'service_role' }))
}

/** Client for a specific user id, for background work done on a user's behalf. */
export async function createClientForUser(userId: string, email?: string): Promise<PostgrestClient> {
  return clientWithToken(await mintToken({ role: 'authenticated', sub: userId, email }))
}

export { createClient as createServerClient }
