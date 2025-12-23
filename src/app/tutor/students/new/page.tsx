'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewStudentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    parent_email: '',
    additional_emails: [''],
    age: '',
    school: '',
    grade_current: '',
    private_notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          age: formData.age ? parseInt(formData.age) : null,
          additional_emails: formData.additional_emails.filter(e => e.trim()),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create student')
        return
      }

      if (data.inviteLink) {
        setInviteLink(data.inviteLink)
        // Extract token from invite link
        const token = data.inviteLink.split('/invite/')[1]
        if (token) {
          setInviteToken(token)
        }
      } else {
        router.push('/tutor/students')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
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

  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSendEmail = async () => {
    if (!inviteToken || !formData.email) return
    
    setSendingEmail(true)
    setEmailError(null)

    try {
      const response = await fetch('/api/invite/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteToken,
          email: formData.email,
          studentName: formData.name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setEmailError(data.error || 'Failed to send email')
        return
      }

      setEmailSent(true)
    } catch {
      setEmailError('Failed to send email. Please try again.')
    } finally {
      setSendingEmail(false)
    }
  }

  if (inviteLink) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Student Created!</h2>
            <p className="mt-2 text-sm text-gray-500">
              Share the invite link with {formData.name} to let them join.
            </p>
          </div>

          {/* Invite Link Section */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">Invite Link</label>
            <div className="mt-1 flex rounded-lg border border-gray-300 bg-gray-50">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 rounded-l-lg border-0 bg-transparent px-3 py-2 text-sm focus:ring-0"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-r-lg border-l border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 min-w-[70px]"
              >
                {copied ? (
                  <span className="text-green-600">Copied!</span>
                ) : (
                  'Copy'
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              This link expires in 7 days.
            </p>
          </div>

          {/* Email Invite Section */}
          {formData.email && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Send Invite Email</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Send a professional invite email to {formData.email}
                  </p>
                  
                  {emailError && (
                    <p className="mt-2 text-sm text-red-600">{emailError}</p>
                  )}
                  
                  {emailSent ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Email sent successfully!
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={sendingEmail}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {sendingEmail ? (
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
                          Send Invite Email
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!formData.email && (
            <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-yellow-800">
                  No email address was provided. You&apos;ll need to share the invite link manually.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => router.push('/tutor/students')}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back to Students
            </button>
            <button
              onClick={() => {
                setInviteLink(null)
                setInviteToken(null)
                setEmailSent(false)
                setEmailError(null)
                setCopied(false)
                setFormData({
                  name: '',
                  email: '',
                  parent_email: '',
                  additional_emails: [''],
                  age: '',
                  school: '',
                  grade_current: '',
                  private_notes: '',
                })
              }}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Add Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Student</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a student profile and generate an invite link.
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
            Student Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="student@example.com"
          />
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
            placeholder="parent@example.com"
          />
          <p className="mt-1 text-xs text-gray-500">Used for calendar invites and session notifications</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Emails
          </label>
          <p className="text-xs text-gray-500 mb-2">Add other emails to receive session invites (e.g., other parent, nanny)</p>
          {formData.additional_emails.map((email, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="email"
                value={email}
                onChange={(e) => updateAdditionalEmail(index, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="additional@example.com"
              />
              {formData.additional_emails.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEmailField(index)}
                  className="px-3 py-2 text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addEmailField}
            className="text-sm text-blue-600 hover:text-blue-800"
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
              min="5"
              max="99"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="grade" className="block text-sm font-medium text-gray-700">
              Grade
            </label>
            <input
              id="grade"
              type="text"
              value={formData.grade_current}
              onChange={(e) => setFormData({ ...formData, grade_current: e.target.value })}
              placeholder="e.g., 8"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Private Notes
          </label>
          <p className="text-xs text-gray-500">Only visible to you</p>
          <textarea
            id="notes"
            rows={3}
            value={formData.private_notes}
            onChange={(e) => setFormData({ ...formData, private_notes: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create & Get Invite Link'}
          </button>
        </div>
      </form>
    </div>
  )
}
