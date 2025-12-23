'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Student {
  id: string
  display_name: string
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
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [formData, setFormData] = useState({
    studentId: '',
    scheduledAt: '',
    durationMinutes: 60,
    notes: '',
    location: '',
  })
  
  useEffect(() => {
    fetchSessions()
    fetchStudents()
  }, [])
  
  async function fetchSessions() {
    try {
      const response = await fetch('/api/sessions?upcoming=true')
      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setLoading(false)
    }
  }
  
  async function fetchStudents() {
    try {
      const response = await fetch('/api/students')
      const data = await response.json()
      setStudents(data.students || [])
    } catch (error) {
      console.error('Failed to fetch students:', error)
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
        fetchSessions()
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
          <p className="text-gray-600 mt-1">Schedule and manage tutoring sessions.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Schedule Session
        </button>
      </div>
      
      {/* Calendar Connection Notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <h3 className="font-medium text-blue-800">Google Calendar Integration</h3>
            <p className="text-sm text-blue-700">
              Connect your Google Calendar to auto-create events with Meet links.
              <Link href="/tutor/settings" className="ml-2 underline">
                Connect in Settings
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Sessions List */}
      {sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.map((session) => {
            const date = new Date(session.scheduled_at)
            const endTime = new Date(date.getTime() + session.duration_minutes * 60 * 1000)
            
            return (
              <div
                key={session.id}
                className="bg-white rounded-lg shadow-sm border p-6"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {session.student?.display_name || 'Student'}
                    </h3>
                    <div className="text-sm text-gray-600 mt-1">
                      {date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="text-sm text-gray-500">
                      {date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {endTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' '}
                      ({session.duration_minutes} min)
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {session.meet_link && (
                      <a
                        href={session.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                      >
                        Join Meet
                      </a>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      session.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-700'
                        : session.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                </div>
                
                {session.notes && (
                  <p className="text-sm text-gray-600 mt-3 pt-3 border-t">
                    {session.notes}
                  </p>
                )}
                
                {session.location && (
                  <p className="text-xs text-gray-500 mt-2">
                    📍 {session.location}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Sessions</h3>
          <p className="text-gray-600 mb-4">
            Schedule your first tutoring session.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Schedule Session
          </button>
        </div>
      )}
      
      {/* Create Session Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Schedule Session
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
                  <option value="">Select student...</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.user_id}>
                      {student.display_name}
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
