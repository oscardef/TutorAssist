import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/identity/server'
import { createServerClient } from '@/lib/supabase/server'
import type { UserContext, UserRole } from '@/lib/types'

export interface CurrentUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
}

/** The signed-in user, or null. */
export async function getUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const { id, email, name, emailVerified } = session.user
  return { id, email, name, emailVerified }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function getUserContext(): Promise<UserContext | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = await createServerClient()

  // Get workspace membership - order by created_at to get the first workspace consistently
  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error('Error fetching workspace membership:', membershipError)
    return null
  }

  if (!membership) {
    return null
  }

  // Check if platform owner
  const { data: platformOwner } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'platform_owner')
    .limit(1)
    .maybeSingle()

  // Platform owners: the dedicated role, or an address listed in PLATFORM_OWNER_EMAILS
  const ownerEmails = (process.env.PLATFORM_OWNER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

  return {
    userId: user.id,
    email: user.email,
    workspaceId: membership.workspace_id || '',
    role: membership.role as UserRole,
    isPlatformOwner: !!platformOwner || ownerEmails.includes(user.email.toLowerCase()),
  }
}

export async function requireUserContext(): Promise<UserContext> {
  const context = await getUserContext()
  if (!context) redirect('/onboarding')
  return context
}

export async function requireTutor(): Promise<UserContext> {
  const context = await requireUserContext()
  if (context.role !== 'tutor' && !context.isPlatformOwner) redirect('/student/dashboard')
  return context
}

export async function requireStudent(): Promise<UserContext> {
  const context = await requireUserContext()
  if (context.role !== 'student' && context.role !== 'tutor' && !context.isPlatformOwner) redirect('/login')
  return context
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() })
  redirect('/login')
}
