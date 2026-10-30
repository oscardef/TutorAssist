import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'

/** Upload an image for a question; returns the storage key to save on the question. */
export async function POST(request: Request) {
  const context = await requireTutor()
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 })
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { key, url } = await uploadFile(context.workspaceId, 'questions', buffer, file.name, file.type)
    return NextResponse.json({ key, url })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 })
  }
}
