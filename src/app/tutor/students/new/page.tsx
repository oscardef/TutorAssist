'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewStudentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create student')
        return
      }

      if (data.inviteLink) {
        setInviteLink(data.inviteLink)
      } else {
        router.push('/tutor/students')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
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
              Share this invite link with {formData.name} to let them join.
            </p>
          </div>

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
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="rounded-r-lg border-l border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              This link expires in 7 days.
            </p>
          </div>

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
                setFormData({
                  name: '',
                  email: '',
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
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
