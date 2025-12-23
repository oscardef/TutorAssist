import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import type { Workspace, WorkspaceMember, InviteToken, StudentProfile, UserRole } from '@/lib/types'

// Create a new workspace for a tutor
export async function createWorkspace(
  userId: string,
  name: string
): Promise<{ workspace: Workspace; membership: WorkspaceMember } | null> {
  try {
    const supabase = await createAdminClient()
    
    console.log('[createWorkspace] Starting workspace creation for user:', userId)
    
    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50)
    
    // Add random suffix to ensure uniqueness
    const slug = `${baseSlug}-${uuidv4().slice(0, 8)}`
    
    console.log('[createWorkspace] Creating workspace with slug:', slug)
    
    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug,
        settings_json: {
          allowStudentPractice: true,
          practiceRateLimit: 20,
          defaultDifficulty: 3,
          enableSpacedRepetition: true,
          questionGenerationEnabled: true,
        },
      })
      .select()
      .single()
    
    if (workspaceError) {
      console.error('[createWorkspace] Workspace creation error:', {
        message: workspaceError.message,
        details: workspaceError.details,
        hint: workspaceError.hint,
        code: workspaceError.code,
      })
      return null
    }
    
    if (!workspace) {
      console.error('[createWorkspace] No workspace returned')
      return null
    }
    
    console.log('[createWorkspace] Workspace created:', workspace.id)
    
    // Create membership
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'tutor',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (membershipError) {
      console.error('[createWorkspace] Membership creation error:', {
        message: membershipError.message,
        details: membershipError.details,
        hint: membershipError.hint,
        code: membershipError.code,
      })
      // Rollback workspace creation
      await supabase.from('workspaces').delete().eq('id', workspace.id)
      return null
    }
    
    if (!membership) {
      console.error('[createWorkspace] No membership returned')
      await supabase.from('workspaces').delete().eq('id', workspace.id)
      return null
    }
    
    console.log('[createWorkspace] Success! Workspace and membership created')
    
    return { workspace, membership }
  } catch (error) {
    console.error('[createWorkspace] Unexpected error:', error)
    return null
  }
}

// Get workspace by ID
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data
}

// Get user's workspace membership
export async function getUserWorkspaceMembership(
  userId: string
): Promise<{ workspace: Workspace; membership: WorkspaceMember } | null> {
  const supabase = await createServerClient()
  
  const { data: membership, error } = await supabase
    .from('workspace_members')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', userId)
    .limit(1)
    .single()
  
  if (error || !membership || !membership.workspace) {
    return null
  }
  
  return {
    membership: {
      id: membership.id,
      workspace_id: membership.workspace_id,
      user_id: membership.user_id,
      role: membership.role,
      invited_at: membership.invited_at,
      joined_at: membership.joined_at,
      created_at: membership.created_at,
    },
    workspace: membership.workspace as Workspace,
  }
}

// Create an invite token for a student
export async function createInviteToken(
  workspaceId: string,
  createdBy: string,
  studentProfileId?: string,
  email?: string,
  expiresInDays: number = 7
): Promise<InviteToken | null> {
  const supabase = await createAdminClient()
  
  const token = uuidv4()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)
  
  console.log('[createInviteToken] Creating token:', {
    workspace_id: workspaceId,
    token: token.substring(0, 8) + '...',
    student_profile_id: studentProfileId,
    email,
    expires_at: expiresAt.toISOString(),
    created_by: createdBy,
  })
  
  const { data, error } = await supabase
    .from('invite_tokens')
    .insert({
      workspace_id: workspaceId,
      token,
      student_profile_id: studentProfileId || null,
      email: email || null,
      expires_at: expiresAt.toISOString(),
      created_by: createdBy,
    })
    .select()
    .single()
  
  if (error || !data) {
    console.error('[createInviteToken] Failed to create invite token:', error)
    return null
  }
  
  console.log('[createInviteToken] Successfully created token:', data.token.substring(0, 8) + '...')
  return data
}

// Validate and get invite token
export async function validateInviteToken(token: string): Promise<InviteToken | null> {
  const supabase = await createAdminClient()
  
  const { data, error } = await supabase
    .from('invite_tokens')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data
}

// Redeem an invite token to join a workspace
export async function redeemInviteToken(
  token: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createAdminClient()
  
  // Validate token
  const inviteToken = await validateInviteToken(token)
  if (!inviteToken) {
    return { success: false, error: 'Invalid or expired invite token' }
  }
  
  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', inviteToken.workspace_id)
    .eq('user_id', userId)
    .single()
  
  if (existingMember) {
    return { success: false, error: 'You are already a member of this workspace' }
  }
  
  // Create membership
  const { error: membershipError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: inviteToken.workspace_id,
      user_id: userId,
      role: 'student',
      invited_at: inviteToken.created_at,
      joined_at: new Date().toISOString(),
    })
  
  if (membershipError) {
    console.error('Failed to create membership:', membershipError)
    return { success: false, error: 'Failed to join workspace' }
  }
  
  // If there's a linked student profile, connect the user
  if (inviteToken.student_profile_id) {
    await supabase
      .from('student_profiles')
      .update({ user_id: userId })
      .eq('id', inviteToken.student_profile_id)
  }
  
  // Mark token as used
  await supabase
    .from('invite_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', inviteToken.id)
  
  return { success: true }
}

// Create a student profile (before they join)
export async function createStudentProfile(
  workspaceId: string,
  data: {
    name: string
    email?: string
    age?: number
    school?: string
    grade_current?: string
    tags?: string[]
  }
): Promise<StudentProfile | null> {
  const supabase = await createServerClient()
  
  const { data: profile, error } = await supabase
    .from('student_profiles')
    .insert({
      workspace_id: workspaceId,
      name: data.name,
      email: data.email || null,
      age: data.age || null,
      school: data.school || null,
      grade_current: data.grade_current || null,
      tags: data.tags || [],
    })
    .select()
    .single()
  
  if (error || !profile) {
    console.error('Failed to create student profile:', error)
    return null
  }
  
  return profile
}

// Get all student profiles in a workspace
export async function getStudentProfiles(workspaceId: string): Promise<StudentProfile[]> {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name')
  
  if (error || !data) {
    return []
  }
  
  return data
}

// Get workspace members
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<(WorkspaceMember & { email?: string })[]> {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
  
  if (error || !data) {
    return []
  }
  
  return data
}

// Update workspace settings
export async function updateWorkspaceSettings(
  workspaceId: string,
  settings: Partial<Workspace['settings_json']>
): Promise<boolean> {
  const supabase = await createServerClient()
  
  // Get current settings
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings_json')
    .eq('id', workspaceId)
    .single()
  
  if (!workspace) {
    return false
  }
  
  // Merge settings
  const newSettings = {
    ...workspace.settings_json,
    ...settings,
  }
  
  const { error } = await supabase
    .from('workspaces')
    .update({ settings_json: newSettings })
    .eq('id', workspaceId)
  
  return !error
}

// Check if user has role in workspace
export async function checkWorkspaceRole(
  userId: string,
  workspaceId: string,
  allowedRoles: UserRole[]
): Promise<boolean> {
  const supabase = await createServerClient()
  
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single()
  
  if (!data) {
    return false
  }
  
  return allowedRoles.includes(data.role as UserRole)
}
