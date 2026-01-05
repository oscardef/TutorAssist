import { google, calendar_v3 } from 'googleapis'
import { getAuthenticatedClient } from './oauth'
import { createServerClient } from '@/lib/supabase/server'

interface CreateEventParams {
  userId: string
  summary: string
  description?: string
  startTime: Date
  endTime: Date
  attendeeEmails?: string[]
  location?: string
}

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: Date
  end: Date
  attendees: string[]
  meetLink?: string
  htmlLink: string
}

// Create a tutoring session event
export async function createCalendarEvent(params: CreateEventParams): Promise<CalendarEvent | null> {
  const { userId, summary, description, startTime, endTime, attendeeEmails, location } = params
  
  const auth = await getAuthenticatedClient(userId)
  if (!auth) {
    throw new Error('Google Calendar not connected')
  }
  
  const calendar = google.calendar({ version: 'v3', auth })
  
  const event: calendar_v3.Schema$Event = {
    summary,
    description,
    location,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: attendeeEmails?.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `tutoring-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 30 }, // 30 min before
      ],
    },
  }
  
  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  })
  
  if (!response.data.id) {
    return null
  }
  
  return {
    id: response.data.id,
    summary: response.data.summary || summary,
    description: response.data.description || undefined,
    start: new Date(response.data.start?.dateTime || startTime),
    end: new Date(response.data.end?.dateTime || endTime),
    attendees: response.data.attendees?.map(a => a.email || '').filter(Boolean) || [],
    meetLink: response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || undefined,
    htmlLink: response.data.htmlLink || '',
  }
}

// Get upcoming tutoring sessions
export async function getUpcomingEvents(userId: string, maxResults: number = 10, searchQuery?: string): Promise<CalendarEvent[]> {
  const auth = await getAuthenticatedClient(userId)
  if (!auth) {
    return []
  }
  
  const calendar = google.calendar({ version: 'v3', auth })
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
    q: searchQuery || 'tutoring OR "Math Tutoring"', // Filter for tutoring-related events
  })
  
  return (response.data.items || []).map(event => ({
    id: event.id || '',
    summary: event.summary || 'Untitled',
    description: event.description || undefined,
    start: new Date(event.start?.dateTime || event.start?.date || ''),
    end: new Date(event.end?.dateTime || event.end?.date || ''),
    attendees: event.attendees?.map(a => a.email || '').filter(Boolean) || [],
    meetLink: event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || undefined,
    htmlLink: event.htmlLink || '',
  }))
}

// Update an existing event
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  updates: Partial<CreateEventParams>
): Promise<CalendarEvent | null> {
  const auth = await getAuthenticatedClient(userId)
  if (!auth) {
    throw new Error('Google Calendar not connected')
  }
  
  const calendar = google.calendar({ version: 'v3', auth })
  
  const event: calendar_v3.Schema$Event = {}
  
  if (updates.summary) event.summary = updates.summary
  if (updates.description) event.description = updates.description
  if (updates.location) event.location = updates.location
  if (updates.startTime) {
    event.start = {
      dateTime: updates.startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }
  if (updates.endTime) {
    event.end = {
      dateTime: updates.endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }
  if (updates.attendeeEmails) {
    event.attendees = updates.attendeeEmails.map(email => ({ email }))
  }
  
  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: event,
    sendUpdates: 'all',
  })
  
  if (!response.data.id) {
    return null
  }
  
  return {
    id: response.data.id,
    summary: response.data.summary || '',
    description: response.data.description || undefined,
    start: new Date(response.data.start?.dateTime || ''),
    end: new Date(response.data.end?.dateTime || ''),
    attendees: response.data.attendees?.map(a => a.email || '').filter(Boolean) || [],
    meetLink: response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || undefined,
    htmlLink: response.data.htmlLink || '',
  }
}

// Delete an event
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const auth = await getAuthenticatedClient(userId)
  if (!auth) {
    throw new Error('Google Calendar not connected')
  }
  
  const calendar = google.calendar({ version: 'v3', auth })
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
  })
  
  return true
}

// Sync session with database
export async function syncSessionToCalendar(sessionId: string): Promise<void> {
  const supabase = await createServerClient()
  
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      *,
      student:student_profiles(name, users(email))
    `)
    .eq('id', sessionId)
    .single()
  
  if (error || !session) {
    throw new Error('Session not found')
  }
  
  const tutorUserId = session.tutor_id
  if (!tutorUserId) {
    throw new Error('Tutor not found')
  }
  
  const studentProfile = session.student as { 
    name: string
    users: { email: string } | null 
  } | null
  
  const studentEmail = studentProfile?.users?.email
  
  const event = await createCalendarEvent({
    userId: tutorUserId,
    summary: `Tutoring: ${studentProfile?.name || 'Student'}`,
    description: session.notes || `Tutoring session\n\nSession ID: ${session.id}`,
    startTime: new Date(session.scheduled_at),
    endTime: new Date(new Date(session.scheduled_at).getTime() + (session.duration_minutes || 60) * 60 * 1000),
    attendeeEmails: studentEmail ? [studentEmail] : undefined,
    location: session.location || undefined,
  })
  
  if (event) {
    await supabase
      .from('sessions')
      .update({
        google_event_id: event.id,
        meet_link: event.meetLink,
      })
      .eq('id', sessionId)
  }
}
