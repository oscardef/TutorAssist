import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Accept an invite - creates user account and links to student profile
 * 
 * This is the main endpoint for student account creation. It:
 * 1. Validates the invite token
 * 2. Creates the auth user with the provided password
 * 3. Creates workspace membership
 * 4. Links the student profile to the new user
 * 5. Marks the invite as used
 * 
 * The student can then immediately log in with email/password.
 */
export async function POST(request: Request) {
  try {
    const { token, email, password, fullName } = await request.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 })
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    // 1. Get and validate the invite token
    const { data: invite, error: inviteError } = await adminClient
      .from('invite_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (inviteError || !invite) {
      console.error('[Accept Invite] Invite not found:', inviteError)
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired. Please ask your tutor for a new one.' }, { status: 400 })
    }

    // Check if already used
    if (invite.used_at) {
      return NextResponse.json({ error: 'This invite has already been used.' }, { status: 400 })
    }

    // 2. Get the student profile to verify email match
    let studentProfile = null
    let expectedEmail = invite.email?.toLowerCase().trim()

    if (invite.student_profile_id) {
      const { data: profile } = await adminClient
        .from('student_profiles')
        .select('*')
        .eq('id', invite.student_profile_id)
        .single()

      if (profile) {
        studentProfile = profile
        // Use student profile email if available, fallback to invite email
        expectedEmail = profile.email?.toLowerCase().trim() || expectedEmail
        
        // Check if already claimed
        if (profile.user_id) {
          return NextResponse.json({ 
            error: 'This account has already been set up. Please log in instead.' 
          }, { status: 400 })
        }
      }
    }

    // Validate email matches expected email
    const providedEmail = email.toLowerCase().trim()
    if (expectedEmail && providedEmail !== expectedEmail) {
      return NextResponse.json({ 
        error: `This invite is for ${expectedEmail}. Please use that email address.` 
      }, { status: 400 })
    }

    // 3. Check if a user with this email already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === providedEmail
    )

    if (existingUser) {
      // User exists - check if they're already in this workspace
      const { data: existingMember } = await adminClient
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', invite.workspace_id)
        .eq('user_id', existingUser.id)
        .maybeSingle()  // Use maybeSingle to return null instead of throwing error

      if (existingMember) {
        // Already a member - just link profile if needed and mark used
        if (invite.student_profile_id && studentProfile && !studentProfile.user_id) {
          await adminClient
            .from('student_profiles')
            .update({ user_id: existingUser.id })
            .eq('id', invite.student_profile_id)
        }
        
        await adminClient
          .from('invite_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', invite.id)

        return NextResponse.json({ 
          error: 'You already have an account. Please log in instead.',
          existingAccount: true 
        }, { status: 400 })
      }

      // User exists but NOT in this workspace
      // Check if they have ANY workspace memberships (they might be an orphaned user from a deleted student)
      const { data: anyMemberships } = await adminClient
        .from('workspace_members')
        .select('id')
        .eq('user_id', existingUser.id)
        .limit(1)
      
      // anyMemberships is an array - check if it's empty
      const hasAnyMembership = anyMemberships && anyMemberships.length > 0

      if (!hasAnyMembership) {
        // This is an orphaned auth user (no workspace memberships)
        // This happens when a student was deleted but the auth user wasn't cleaned up
        // We need to clean up FK references before deleting the auth user
        console.log('[Accept Invite] Found orphaned auth user, cleaning up:', existingUser.id)
        
        // Clean up any orphaned records that reference this user
        // These have foreign keys to auth.users that would block deletion
        await adminClient.from('attempts').delete().eq('student_user_id', existingUser.id)
        await adminClient.from('spaced_repetition').delete().eq('student_user_id', existingUser.id)
        await adminClient.from('question_flags').delete().eq('student_user_id', existingUser.id)
        await adminClient.from('assignments').update({ assigned_student_user_id: null }).eq('assigned_student_user_id', existingUser.id)
        await adminClient.from('student_profiles').update({ user_id: null }).eq('user_id', existingUser.id)
        
        // Now delete the orphaned auth user
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id)
        if (deleteError) {
          console.error('[Accept Invite] Failed to delete orphaned user:', deleteError)
          return NextResponse.json({ 
            error: 'Failed to set up account. Please contact support.',
          }, { status: 500 })
        }
        console.log('[Accept Invite] Successfully deleted orphaned user, proceeding with fresh account')
        // Continue to create fresh account below
      } else {
        // User has memberships in other workspaces - they need to log in
        return NextResponse.json({ 
          error: 'An account with this email already exists. Please log in with your existing password.',
          existingAccount: true 
        }, { status: 400 })
      }
    }

    // 4. Create the new auth user using admin API
    const displayName = fullName || studentProfile?.name || email.split('@')[0]
    
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: providedEmail,
      password: password,
      email_confirm: true, // Auto-confirm since they have valid invite
      user_metadata: {
        full_name: displayName,
        role: 'student',
      },
    })

    if (createError || !newUser?.user) {
      console.error('[Accept Invite] Failed to create user:', createError)
      return NextResponse.json({ 
        error: createError?.message || 'Failed to create account' 
      }, { status: 500 })
    }

    const userId = newUser.user.id

    // 5. Create workspace membership
    const { error: membershipError } = await adminClient
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        role: 'student',
        invited_at: invite.created_at,
        joined_at: new Date().toISOString(),
      })

    if (membershipError) {
      console.error('[Accept Invite] Failed to create membership:', membershipError)
      // Rollback user creation
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Failed to join workspace' }, { status: 500 })
    }

    // 6. Link student profile to user
    if (invite.student_profile_id) {
      const { error: profileError } = await adminClient
        .from('student_profiles')
        .update({ user_id: userId })
        .eq('id', invite.student_profile_id)

      if (profileError) {
        console.error('[Accept Invite] Failed to link profile:', profileError)
        // Non-fatal - continue anyway
      }
    }

    // 7. Mark invite as used
    await adminClient
      .from('invite_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id)

    // 8. Sign in the user automatically
    const supabase = await createServerClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: providedEmail,
      password: password,
    })

    if (signInError) {
      console.error('[Accept Invite] Auto sign-in failed:', signInError)
      // Non-fatal - they can sign in manually
      return NextResponse.json({ 
        success: true, 
        message: 'Account created! Please log in with your credentials.',
        autoSignIn: false,
      })
    }

    return NextResponse.json({ 
      success: true,
      autoSignIn: true,
      user: {
        id: userId,
        email: providedEmail,
        name: displayName,
      },
    })

  } catch (error) {
    console.error('[Accept Invite] Unexpected error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
