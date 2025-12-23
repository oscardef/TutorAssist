import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { getUpcomingEvents } from '@/lib/google/calendar'

// Get calendar events for the tutor
export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can view calendar' }, { status: 403 })
  }
  
  const supabase = await createServerClient()
  
  // Check if Google Calendar is connected
  const { data: connection } = await supabase
    .from('oauth_connections')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single()
  
  if (!connection) {
    return NextResponse.json({ 
      connected: false,
      events: [] 
    })
  }
  
  try {
    // Fetch upcoming calendar events
    const events = await getUpcomingEvents(user.id, 50)
    
    return NextResponse.json({
      connected: true,
      events: events.map(e => ({
        id: e.id,
        summary: e.summary,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        attendees: e.attendees,
        meetLink: e.meetLink,
        htmlLink: e.htmlLink
      }))
    })
  } catch (error) {
    console.error('Failed to fetch calendar events:', error)
    return NextResponse.json({
      connected: true,
      events: [],
      error: 'Failed to fetch calendar events'
    })
  }
}
