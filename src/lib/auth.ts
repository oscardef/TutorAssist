import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserContext, UserRole } from '@/lib/types'

export async function getUser() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

export async function requireUser() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return user
}

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }
  
  // Get workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()
  
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
    .single()
  
  return {
    userId: user.id,
    email: user.email || '',
    workspaceId: membership.workspace_id || '',
    role: membership.role as UserRole,
    isPlatformOwner: !!platformOwner,
  }
}

export async function requireUserContext(): Promise<UserContext> {
  const context = await getUserContext()
  
  if (!context) {
    redirect('/onboarding')
  }
  
  return context
}

export async function requireTutor(): Promise<UserContext> {
  const context = await requireUserContext()
  
  if (context.role !== 'tutor' && !context.isPlatformOwner) {
    redirect('/student/dashboard')
  }
  
  return context
}

export async function requireStudent(): Promise<UserContext> {
  const context = await requireUserContext()
  
  if (context.role !== 'student' && context.role !== 'tutor' && !context.isPlatformOwner) {
    redirect('/login')
  }
  
  return context
}

export async function signOut() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
