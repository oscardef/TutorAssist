import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { createCalendarEvent, syncSessionToCalendar } from '@/lib/google'

// Get sessions
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  const upcoming = searchParams.get('upcoming') === 'true'
  
  const supabase = await createServerClient()
  
  let query = supabase
    .from('sessions')
    .select(`
      *,
      student:student_profiles(id, name, user_id)
    `)
    .eq('workspace_id', context.workspaceId)
  
  if (context.role === 'student') {
    // Students can only see their own sessions
    query = query.eq('student_id', user.id)
  } else if (studentId) {
    query = query.eq('student_id', studentId)
  }
  
  if (upcoming) {
    query = query.gte('scheduled_at', new Date().toISOString())
  }
  
  query = query.order('scheduled_at', { ascending: upcoming })
  
  const { data: sessions, error } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ sessions })
}

// Create session
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can create sessions' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const {
      studentId,
      scheduledAt,
      durationMinutes = 60,
      notes,
      location,
      syncToCalendar = true,
    } = body
    
    if (!studentId || !scheduledAt) {
      return NextResponse.json(
        { error: 'Student ID and scheduled time are required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerClient()
    
    // Get the tutor's membership ID
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', context.workspaceId)
      .eq('user_id', context.userId)
      .single()
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    // Verify student belongs to workspace
    const { data: student, error: studentError } = await supabase
      .from('student_profiles')
      .select('id, name, user_id')
      .eq('user_id', studentId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }
    
    // Create session
    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        workspace_id: context.workspaceId,
        tutor_id: membership.id,
        student_id: studentId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        notes,
        location,
        status: 'scheduled',
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Sync to Google Calendar if requested and connected
    if (syncToCalendar) {
      try {
        await syncSessionToCalendar(session.id)
      } catch (calError) {
        console.error('Calendar sync failed:', calError)
        // Don't fail the request, just note the sync issue
      }
    }
    
    return NextResponse.json({ session })
  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
