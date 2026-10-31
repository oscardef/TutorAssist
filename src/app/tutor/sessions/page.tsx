'use client'

import { useState, useEffect } from 'react'
import { CancelSessionButton } from '@/components/cancel-session-button'
import { Icons } from '@/components/ui/icons'
import Link from 'next/link'
import { formatDate, formatDay, formatTime } from '@/lib/dates'

interface Student {
  id: string
  name: string
  email?: string
  parent_email?: string
  additional_emails?: string[]
  user_id: string
}

interface Session {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  location: string | null
  meet_link: string | null
  student: Student | null
  source: 'database' | 'calendar' // Track where session came from
  google_event_id?: string
  attendees?: string[]
}

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  attendees: string[]
  meetLink?: string
  htmlLink: string
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [isCalendarConnected, setIsCalendarConnected] = useState(false)
  const [calendarError, setCalendarError] = useState<'reconnect' | 'unavailable' | null>(null)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [formData, setFormData] = useState({
    studentId: '',
    scheduledAt: '',
    durationMinutes: 60,
    notes: '',
    location: '',
  })
  
  useEffect(() => {
    fetchData()
  }, [])
  
  async function fetchData() {
    try {
      const [sessionsRes, studentsRes, calendarRes] = await Promise.all([
        fetch('/api/sessions?upcoming=true'),
        fetch('/api/students'),
        fetch('/api/sessions/calendar')
      ])
      
      const sessionsData = await sessionsRes.json()
      const studentsData = await studentsRes.json()
      const calendarData = await calendarRes.json()
      
      const dbSessions: Session[] = (sessionsData.sessions || []).map((s: Session) => ({
        ...s,
        source: 'database' as const
      }))
      
      setStudents(studentsData.students || [])
      setIsCalendarConnected(calendarData.connected)
      setCalendarError(calendarData.error ?? null)
      
      if (calendarData.events) {
        setCalendarEvents(calendarData.events)
        
        // Match calendar events with students and merge with DB sessions
        const calendarSessions = matchCalendarEventsWithStudents(
          calendarData.events,
          studentsData.students || [],
          dbSessions
        )
        
        // Combine and dedupe sessions
        const allSessions = deduplicateSessions([...dbSessions, ...calendarSessions])
        setSessions(allSessions)
      } else {
        setSessions(dbSessions)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Match calendar events with students by email
  function matchCalendarEventsWithStudents(
    events: CalendarEvent[],
    studentList: Student[],
    existingSessions: Session[]
  ): Session[] {
    const existingEventIds = new Set(existingSessions.map(s => s.google_event_id).filter(Boolean))
    
    return events
      .filter(event => !existingEventIds.has(event.id)) // Skip already linked events
      .map(event => {
        // Find student by matching any of their emails with event attendees
        const matchedStudent = studentList.find(student => {
          const studentEmails = [
            student.email,
            student.parent_email,
            ...(student.additional_emails || [])
          ].filter(Boolean).map(e => e?.toLowerCase())
          
          return event.attendees.some(attendee => 
            studentEmails.includes(attendee.toLowerCase())
          )
        })
        
        const startDate = new Date(event.start)
        const endDate = new Date(event.end)
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
        
        return {
          id: `calendar-${event.id}`,
          google_event_id: event.id,
          scheduled_at: event.start,
          duration_minutes: durationMinutes,
          status: 'scheduled',
          notes: null,
          location: null,
          meet_link: event.meetLink || null,
          student: matchedStudent || null,
          source: 'calendar' as const,
          attendees: event.attendees
        }
      })
  }
  
  // Remove duplicate sessions (prefer DB sessions over calendar)
  function deduplicateSessions(sessions: Session[]): Session[] {
    const seen = new Map<string, Session>()
    
    for (const session of sessions) {
      // Create a key based on time and student
      const timeKey = new Date(session.scheduled_at).toISOString().slice(0, 16) // minute precision
      const studentKey = session.student?.id || session.attendees?.join(',') || 'unknown'
      const key = `${timeKey}-${studentKey}`
      
      const existing = seen.get(key)
      if (!existing || (existing.source === 'calendar' && session.source === 'database')) {
        seen.set(key, session)
      }
    }
    
    return Array.from(seen.values()).sort((a, b) => 
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )
  }
  
  async function syncCalendarEvent(eventId: string, studentId: string) {
    setSyncingCalendar(true)
    try {
      const response = await fetch('/api/sessions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleEventId: eventId, studentId })
      })
      
      if (response.ok) {
        await fetchData() // Refresh data
      }
    } catch (error) {
      console.error('Failed to sync calendar event:', error)
    } finally {
      setSyncingCalendar(false)
    }
  }
  
  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: formData.studentId,
          scheduledAt: new Date(formData.scheduledAt).toISOString(),
          durationMinutes: formData.durationMinutes,
          notes: formData.notes || null,
          location: formData.location || null,
          syncToCalendar: true,
        }),
      })
      
      if (response.ok) {
        setShowModal(false)
        setFormData({
          studentId: '',
          scheduledAt: '',
          durationMinutes: 60,
          notes: '',
          location: '',
        })
        fetchData()
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">Schedule sessions, open the shared board, and let students book your free times.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tutor/sessions/availability" className="btn btn-secondary btn-sm"><Icons.clock className="h-4 w-4" /> Availability</Link>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Icons.plus className="h-4 w-4" /> Schedule session
          </button>
        </div>
      </div>
      
      {/* Calendar Connection Notice */}
      {!isCalendarConnected && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
                        <div>
              <h3 className="font-medium text-blue-800">Google calendar integration</h3>
              <p className="text-sm text-blue-700">
                Connect your Google Calendar to auto-create events with Meet links.
                <Link href="/tutor/settings" className="ml-2 underline">
                  Connect in settings
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isCalendarConnected && (calendarError ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-r-lg border border-l-4 border-line border-l-spark-400 bg-white p-4" role="status">
          <div>
            <p className="font-bold text-ink">Google calendar isn’t syncing</p>
            <p className="text-sm text-gray-600">
              {calendarError === 'reconnect'
                ? 'Mathium lost access to your calendar. Reconnect it in Settings to see calendar sessions here.'
                : 'Your calendar couldn’t be reached just now. Sessions booked in Mathium still show below.'}
            </p>
          </div>
          {calendarError === 'reconnect'
            ? <Link href="/tutor/settings" className="btn btn-secondary btn-sm">Open settings</Link>
            : <button type="button" onClick={() => fetchData()} className="btn btn-secondary btn-sm">Try again</button>}
        </div>
      ) : (
        <p className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-600" role="status">
          <span className="h-2 w-2 rounded-full bg-[#2e8b57]" aria-hidden="true" />
          Google calendar connected. Events with a student’s email show up here.
          <button type="button" onClick={() => fetchData()} className="font-semibold text-brand-700 hover:underline">Refresh</button>
        </p>
      ))}
      
      {/* Sessions List */}
      {sessions.length > 0 ? (
        <ul className="space-y-3">
          {[...sessions].sort((a, b) => Number(a.status === 'cancelled') - Number(b.status === 'cancelled') || new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map((session) => {
            const date = new Date(session.scheduled_at)
            const endTime = new Date(date.getTime() + session.duration_minutes * 60 * 1000)
            const cancelled = session.status === 'cancelled'
            const fromCalendar = session.source === 'calendar'
            const time = (d: Date) => formatTime(d)

            return (
              <li key={session.id} className={`card flex flex-wrap items-center gap-4 p-4 sm:p-5 ${cancelled ? 'opacity-60' : ''}`}>
                <div className={`flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl ${cancelled ? 'bg-paper text-gray-500' : 'bg-brand-50 text-brand-700'}`} aria-hidden>
                  <span className="text-[11px] font-bold uppercase">{formatDay(date).split(' ')[0]}</span>
                  <span className="text-xl font-extrabold leading-none tnum">{date.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-extrabold text-ink">{session.student?.name || 'Unknown student'}</h3>
                    {cancelled && <span className="chip !py-0">Cancelled</span>}
                    {session.status === 'completed' && <span className="chip chip-good !py-0">Done</span>}
                    {fromCalendar && <span className="chip chip-spark !py-0" title="From your Google calendar">{session.student ? 'Calendar' : 'Calendar, not linked'}</span>}
                  </div>
                  <p className={`text-sm text-gray-500 tnum ${cancelled ? 'line-through' : ''}`}>
                    {formatDate(date)}, {time(date)} – {time(endTime)}
                  </p>
                  {session.attendees && session.attendees.length > 0 && !session.student && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{session.attendees.join(', ')}</p>
                  )}
                  {session.notes && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{session.notes}</p>}
                </div>
                {!cancelled && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!fromCalendar && (
                      <Link href={`/session/${session.id}`} className="btn btn-primary btn-sm" title="Shared whiteboard for this session">
                        <Icons.board className="h-4 w-4" /> Open room
                      </Link>
                    )}
                    {session.meet_link && (
                      <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                        <Icons.video className="h-4 w-4" /> Video call
                      </a>
                    )}
                    {session.source === 'calendar' && !session.student && students.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value && session.google_event_id) {
                            syncCalendarEvent(session.google_event_id, e.target.value)
                          }
                        }}
                        className="input !min-h-9 !py-1 w-auto text-sm"
                        disabled={syncingCalendar}
                      >
                        <option value="">Link to student…</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    {!fromCalendar && session.status !== 'completed' && <CancelSessionButton sessionId={session.id} onDone={fetchData} />}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="card px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Icons.calendar className="h-6 w-6" /></div>
          <p className="mt-4 font-bold text-ink">No upcoming sessions</p>
          <p className="mt-1 text-sm text-gray-500">Schedule one, or open your availability so students can book.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm"><Icons.plus className="h-4 w-4" /> Schedule session</button>
            <Link href="/tutor/sessions/availability" className="btn btn-secondary btn-sm"><Icons.clock className="h-4 w-4" /> Availability</Link>
          </div>
        </div>
      )}
      
      {/* Create Session Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <h2 className="card-title mb-4">
              Schedule session
            </h2>
            
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student
                </label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select student…</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.user_id || student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <select
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Google Meet, Library, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Session agenda, topics to cover..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm flex-1"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
