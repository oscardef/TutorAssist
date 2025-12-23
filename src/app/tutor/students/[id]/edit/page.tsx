'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  })

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  useEffect(() => {
    if (!resolvedParams) return

    async function fetchStudent() {
      if (!resolvedParams) return
      
      try {
        const response = await fetch(`/api/students/${resolvedParams.id}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load student')
          return
        }

        setFormData({
          name: data.name || '',
          email: data.email || '',
          parent_email: data.parent_email || '',
          additional_emails: data.additional_emails?.length > 0 ? data.additional_emails : [''],
          age: data.age?.toString() || '',
          school: data.school || '',
          grade_current: data.grade_current || '',
          private_notes: data.private_notes || '',
          user_id: data.user_id,
        })
      } catch {
        setError('Failed to load student')
      } finally {
        setLoading(false)
      }
    }

    fetchStudent()
  }, [resolvedParams])

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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/tutor/students/${resolvedParams.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Student
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit Student</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update student information
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Student&apos;s email for login and notifications
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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {formData.additional_emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmailField(index)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50"
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
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="grade_current" className="block text-sm font-medium text-gray-700">
              Grade
            </label>
            <input
              id="grade_current"
              type="text"
              value={formData.grade_current}
              onChange={(e) => setFormData({ ...formData, grade_current: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., 9th, 10"
            />
          </div>
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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="private_notes" className="block text-sm font-medium text-gray-700">
            Private Notes
          </label>
          <textarea
            id="private_notes"
            rows={4}
            value={formData.private_notes}
            onChange={(e) => setFormData({ ...formData, private_notes: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Notes only visible to you..."
          />
        </div>

        {/* Resend Invite Section */}
        {!formData.user_id && formData.email && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900">Pending Invite</h3>
                <p className="mt-1 text-sm text-blue-700">
                  Student hasn&apos;t joined yet. Resend the invite email?
                </p>
                {inviteMessage && (
                  <p className={`mt-2 text-sm ${inviteMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {inviteMessage.text}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleResendInvite}
                disabled={resendingInvite}
                className="ml-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
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

        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Delete Student
          </button>
          <div className="flex gap-3">
            <Link
              href={`/tutor/students/${resolvedParams.id}`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Delete Student</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to delete {formData.name}? This will remove all their data including attempts, progress, and assignments. This action cannot be undone.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
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
