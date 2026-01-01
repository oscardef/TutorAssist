'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface StudyProgram {
  id: string
  code: string
  name: string
  color: string | null
  grade_levels: GradeLevel[]
}

interface GradeLevel {
  id: string
  code: string
  name: string
  year_number: number | null
  order_index: number
}

interface Tutor {
  id: string
  email: string
  name: string
}

export default function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [resendingInvite, setResendingInvite] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Data for dropdowns
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [showNewProgramModal, setShowNewProgramModal] = useState(false)
  const [showNewGradeModal, setShowNewGradeModal] = useState(false)
  const [newProgramName, setNewProgramName] = useState('')
  const [newProgramCode, setNewProgramCode] = useState('')
  const [newGradeName, setNewGradeName] = useState('')
  const [newGradeCode, setNewGradeCode] = useState('')
  const [creatingProgram, setCreatingProgram] = useState(false)
  const [creatingGrade, setCreatingGrade] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    parent_email: '',
    additional_emails: [''],
    age: '',
    school: '',
    grade_current: '',
    private_notes: '',
    user_id: null as string | null,
    study_program_id: '',
    grade_level_id: '',
    assigned_tutor_id: '',
    grade_rollover_month: '9', // September default
  })

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  useEffect(() => {
    if (!resolvedParams) return
    const studentId = resolvedParams.id

    async function fetchData() {
      try {
        // Fetch student data
        const studentRes = await fetch(`/api/students/${studentId}`)
        const studentData = await studentRes.json()

        if (!studentRes.ok) {
          setError(studentData.error || 'Failed to load student')
          return
        }

        // Fetch programs
        const programsRes = await fetch('/api/programs')
        const programsData = await programsRes.json()
        setPrograms(programsData.programs || [])

        // Fetch tutors in workspace
        const tutorsRes = await fetch('/api/workspace/members?role=tutor')
        const tutorsData = await tutorsRes.json()
        setTutors(tutorsData.members || [])

        setFormData({
          name: studentData.name || '',
          email: studentData.email || '',
          parent_email: studentData.parent_email || '',
          additional_emails: studentData.additional_emails?.length > 0 ? studentData.additional_emails : [''],
          age: studentData.age?.toString() || '',
          school: studentData.school || '',
          grade_current: studentData.grade_current || '',
          private_notes: studentData.private_notes || '',
          user_id: studentData.user_id,
          study_program_id: studentData.study_program_id || '',
          grade_level_id: studentData.grade_level_id || '',
          assigned_tutor_id: studentData.assigned_tutor_id || '',
          grade_rollover_month: studentData.grade_rollover_month?.toString() || '9',
        })
      } catch {
        setError('Failed to load student')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [resolvedParams])

  // Get available grade levels for selected program
  const availableGrades = programs.find(p => p.id === formData.study_program_id)?.grade_levels || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvedParams) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: formData.age ? parseInt(formData.age) : null,
          additional_emails: formData.additional_emails.filter(e => e.trim()),
          study_program_id: formData.study_program_id || null,
          grade_level_id: formData.grade_level_id || null,
          assigned_tutor_id: formData.assigned_tutor_id || null,
          grade_rollover_month: formData.grade_rollover_month ? parseInt(formData.grade_rollover_month) : 9,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update student')
        return
      }

      router.push(`/tutor/students/${resolvedParams.id}`)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!resolvedParams) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${resolvedParams.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to delete student')
        return
      }

      router.push('/tutor/students')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const handleResendInvite = async () => {
    if (!resolvedParams || !formData.email) {
      setInviteMessage({ type: 'error', text: 'No email address on file' })
      return
    }

    setResendingInvite(true)
    setInviteMessage(null)

    try {
      const response = await fetch(`/api/students/${resolvedParams.id}/resend-invite`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setInviteMessage({ type: 'error', text: data.error || 'Failed to resend invite' })
        return
      }

      setInviteMessage({ type: 'success', text: 'Invite email sent successfully!' })
      setTimeout(() => setInviteMessage(null), 5000)
    } catch {
      setInviteMessage({ type: 'error', text: 'Failed to resend invite' })
    } finally {
      setResendingInvite(false)
    }
  }

  const handleCreateProgram = async () => {
    if (!newProgramCode.trim() || !newProgramName.trim()) return

    setCreatingProgram(true)
    try {
      const response = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newProgramCode.trim(),
          name: newProgramName.trim(),
        }),
      })

      const data = await response.json()
      if (response.ok && data.program) {
        setPrograms(prev => [...prev, { ...data.program, grade_levels: [] }])
        setFormData(prev => ({ ...prev, study_program_id: data.program.id, grade_level_id: '' }))
        setShowNewProgramModal(false)
        setNewProgramCode('')
        setNewProgramName('')
      }
    } catch {
      setError('Failed to create program')
    } finally {
      setCreatingProgram(false)
    }
  }

  const handleCreateGrade = async () => {
    if (!newGradeCode.trim() || !newGradeName.trim() || !formData.study_program_id) return

    setCreatingGrade(true)
    try {
      const response = await fetch('/api/programs/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: formData.study_program_id,
          code: newGradeCode.trim(),
          name: newGradeName.trim(),
        }),
      })

      const data = await response.json()
      if (response.ok && data.gradeLevel) {
        // Update local programs state
        setPrograms(prev => prev.map(p => 
          p.id === formData.study_program_id 
            ? { ...p, grade_levels: [...p.grade_levels, data.gradeLevel] }
            : p
        ))
        setFormData(prev => ({ ...prev, grade_level_id: data.gradeLevel.id }))
        setShowNewGradeModal(false)
        setNewGradeCode('')
        setNewGradeName('')
      }
    } catch {
      setError('Failed to create grade level')
    } finally {
      setCreatingGrade(false)
    }
  }

  const addEmailField = () => {
    setFormData(prev => ({
      ...prev,
      additional_emails: [...prev.additional_emails, '']
    }))
  }

  const removeEmailField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additional_emails: prev.additional_emails.filter((_, i) => i !== index)
    }))
  }

  const updateAdditionalEmail = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      additional_emails: prev.additional_emails.map((e, i) => i === index ? value : e)
    }))
  }

  if (loading || !resolvedParams) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/tutor/students/${resolvedParams.id}`}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Student
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit Student</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update student information and settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600 flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        {/* Basic Info Card */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700">
                  Age
                </label>
                <input
                  id="age"
                  type="number"
                  min="1"
                  max="150"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="school" className="block text-sm font-medium text-gray-700">
                  School
                </label>
                <input
                  id="school"
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Academic Info Card */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Academic Information</h2>
            <p className="text-xs text-gray-500 mt-0.5">Set the student&apos;s curriculum and grade level</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Study Program
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.study_program_id}
                  onChange={(e) => setFormData({ ...formData, study_program_id: e.target.value, grade_level_id: '' })}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select program...</option>
                  {programs.map(program => (
                    <option key={program.id} value={program.id}>
                      {program.name} ({program.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewProgramModal(true)}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                >
                  + New
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade Level
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.grade_level_id}
                  onChange={(e) => setFormData({ ...formData, grade_level_id: e.target.value })}
                  disabled={!formData.study_program_id}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="">{formData.study_program_id ? 'Select grade level...' : 'Select a program first'}</option>
                  {availableGrades.map(grade => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name} ({grade.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewGradeModal(true)}
                  disabled={!formData.study_program_id}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + New
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Grade Rollover Month
              </label>
                <select
                  value={formData.grade_rollover_month}
                  onChange={(e) => setFormData({ ...formData, grade_rollover_month: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {months.map(month => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              <p className="mt-1 text-xs text-gray-500">
                When grade automatically advances to next level
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Tutor Card */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Assigned Tutor</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select the primary tutor for this student</p>
          </div>
          <div className="p-6">
            <select
              value={formData.assigned_tutor_id}
              onChange={(e) => setFormData({ ...formData, assigned_tutor_id: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">No assigned tutor</option>
              {tutors.map(tutor => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.name} ({tutor.email})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              This tutor will be shown on the student&apos;s dashboard as their assigned tutor.
            </p>
          </div>
        </div>

        {/* Contact Info Card */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Contact Information</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Student Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Used for login and notifications
              </p>
            </div>

            <div>
              <label htmlFor="parent_email" className="block text-sm font-medium text-gray-700">
                Parent/Guardian Email
              </label>
              <input
                id="parent_email"
                type="email"
                value={formData.parent_email}
                onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Additional Contact Emails
              </label>
              <div className="mt-2 space-y-2">
                {formData.additional_emails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateAdditionalEmail(index, e.target.value)}
                      placeholder="additional@email.com"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {formData.additional_emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addEmailField}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                + Add another email
              </button>
            </div>
          </div>
        </div>

        {/* Notes Card */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Private Notes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Only visible to tutors</p>
          </div>
          <div className="p-6">
            <textarea
              id="private_notes"
              rows={4}
              value={formData.private_notes}
              onChange={(e) => setFormData({ ...formData, private_notes: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Notes about learning style, goals, areas needing focus..."
            />
          </div>
        </div>

        {/* Resend Invite Section */}
        {!formData.user_id && formData.email && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <h3 className="text-sm font-semibold text-blue-900">Pending Invite</h3>
                </div>
                <p className="mt-1 text-sm text-blue-700">
                  Student hasn&apos;t joined yet. Resend the invite email?
                </p>
                {inviteMessage && (
                  <p className={`mt-2 text-sm font-medium ${inviteMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {inviteMessage.text}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleResendInvite}
                disabled={resendingInvite}
                className="ml-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {resendingInvite ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                    Resend Invite
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete Student
          </button>
          <div className="flex gap-3">
            <Link
              href={`/tutor/students/${resolvedParams.id}`}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* New Program Modal */}
      {showNewProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Create New Program</h3>
            <p className="mt-1 text-sm text-gray-500">Add a new study program (e.g., IB, GCSE, A-Level)</p>
            
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Code</label>
                <input
                  type="text"
                  value={newProgramCode}
                  onChange={(e) => setNewProgramCode(e.target.value.toUpperCase())}
                  placeholder="e.g., IB, GCSE"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  placeholder="e.g., International Baccalaureate"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowNewProgramModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProgram}
                disabled={creatingProgram || !newProgramCode.trim() || !newProgramName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {creatingProgram ? 'Creating...' : 'Create Program'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Grade Modal */}
      {showNewGradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Create New Grade Level</h3>
            <p className="mt-1 text-sm text-gray-500">Add a grade level to the selected program</p>
            
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Code</label>
                <input
                  type="text"
                  value={newGradeCode}
                  onChange={(e) => setNewGradeCode(e.target.value)}
                  placeholder="e.g., Y10, Grade 9"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newGradeName}
                  onChange={(e) => setNewGradeName(e.target.value)}
                  placeholder="e.g., Year 10, Ninth Grade"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowNewGradeModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGrade}
                disabled={creatingGrade || !newGradeCode.trim() || !newGradeName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {creatingGrade ? 'Creating...' : 'Create Grade Level'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Delete Student</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to delete <strong>{formData.name}</strong>? This will permanently remove all their data including attempts, progress, and assignments.
                </p>
                <p className="mt-2 text-sm text-red-600 font-medium">
                  This action cannot be undone.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Student'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
