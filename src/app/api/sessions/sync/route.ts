import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Sync a calendar event to a session in the database
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can sync sessions' }, { status: 403 })
  }
  
  try {
    const { googleEventId, studentId, startTime, endTime, meetLink } = await request.json()
    
    if (!googleEventId || !studentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // Get student profile
    const { data: studentProfile } = await supabase
      .from('student_profiles')
      .select('id, user_id')
      .eq('id', studentId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (!studentProfile) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }
    
    // Check if session already exists for this event
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('google_event_id', googleEventId)
      .single()
    
    if (existing) {
      // Update existing session
      const { data: session, error } = await supabase
        .from('sessions')
        .update({
          student_profile_id: studentProfile.id,
          student_user_id: studentProfile.user_id,
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ session, updated: true })
    }
    
    // Create new session linked to calendar event
    const startDate = startTime ? new Date(startTime) : new Date()
    const endDate = endTime ? new Date(endTime) : new Date(Date.now() + 60 * 60 * 1000)
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
    
    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        workspace_id: context.workspaceId,
        tutor_id: user.id,
        student_profile_id: studentProfile.id,
        student_id: studentProfile.user_id,
        scheduled_at: startDate.toISOString(),
        duration_minutes: durationMinutes,
        google_event_id: googleEventId,
        meet_link: meetLink,
        status: 'scheduled',
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ session, created: true })
  } catch (error) {
    console.error('Sync session error:', error)
    return NextResponse.json({ error: 'Failed to sync session' }, { status: 500 })
  }
}
