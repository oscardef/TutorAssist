'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'

interface Material {
  id: string
  title: string
  description: string | null
  original_filename: string
  type: 'pdf' | 'image' | 'text'
  mime_type: string | null
  size_bytes: number | null
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    fetchMaterials()
  }, [])
  
  async function fetchMaterials() {
    try {
      const response = await fetch('/api/materials')
      const data = await response.json()
      setMaterials(data.materials || [])
    } catch (err) {
      setError('Failed to load materials')
    } finally {
      setLoading(false)
    }
  }
  
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name)
      formData.append('extractContent', 'true')
      
      const response = await fetch('/api/materials', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      
      // Refresh materials list
      await fetchMaterials()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }
  
  function formatFileSize(bytes: number | null): string {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  
  function getFileIcon(type: string) {
    switch (type) {
      case 'pdf':
        return (
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        )
      case 'image':
        return (
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        )
      default:
        return (
          <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        )
    }
  }
  
  function getStatusBadge(status: string) {
    const statusStyles = {
      pending: 'bg-gray-100 text-gray-700',
      processing: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    }
    
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status as keyof typeof statusStyles] || statusStyles.pending}`}>
        {status === 'processing' && (
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-500"></span>
        )}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materials</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload and manage source materials for question generation
          </p>
        </div>
        <label className={`cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {uploading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Uploading...
            </span>
          ) : (
            'Upload Material'
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      
      {materials.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {getFileIcon(material.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {material.original_filename || material.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    {getStatusBadge(material.extraction_status)}
                    <span className="text-xs text-gray-500">
                      {formatFileSize(material.size_bytes)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Uploaded {format(new Date(material.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              
              {material.extraction_status === 'completed' && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <Link
                    href={`/tutor/generate?materialId=${material.id}`}
                    className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Generate questions →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No materials yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload PDFs or images to extract content for question generation.
          </p>
          <div className="mt-6">
            <label className="cursor-pointer inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
              <svg className="-ml-0.5 mr-1.5 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Upload First Material
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}
      
      {/* Tips Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-3">📚 Supported File Types</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700">PDF Documents</h4>
            <p className="text-xs text-gray-500 mt-1">
              Textbooks, worksheets, exam papers
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700">Images</h4>
            <p className="text-xs text-gray-500 mt-1">
              Photos of problems, diagrams (PNG, JPG)
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700">Text Files</h4>
            <p className="text-xs text-gray-500 mt-1">
              Plain text content, notes
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
