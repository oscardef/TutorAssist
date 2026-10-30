'use client'

import { useRef, useState } from 'react'
import { Icons } from '@/components/ui/icons'

/** Upload (or remove) the image attached to a question. Stores a storage key. */
export function ImageUpload({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const X = Icons.x
  const Folder = Icons.folder

  async function upload(file: File) {
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/questions/image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onChange(data.key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${value}`} alt="Question image" className="max-h-64 rounded-2xl border border-line bg-white" />
          <button type="button" onClick={() => onChange(null)} className="absolute -right-2 -top-2 rounded-full border border-line bg-white p-1.5 text-gray-500 shadow hover:text-ink" aria-label="Remove image"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-4 text-sm text-gray-600 hover:border-brand-300 hover:bg-brand-50 ${busy ? 'opacity-60' : ''}`}>
          <Folder className="h-5 w-5 text-gray-400" />
          <span>{busy ? 'Uploading…' : 'Add an image (PNG, JPG, SVG, up to 50 MB)'}</span>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="sr-only" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        </label>
      )}
      {error && <p className="text-sm text-[#9b2c2c]">{error}</p>}
    </div>
  )
}
