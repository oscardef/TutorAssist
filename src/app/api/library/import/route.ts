import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { importFromLibrary } from '@/lib/library'

/** Copy an approved library question into the caller's workspace bank. */
export async function POST(request: Request) {
  const context = await requireTutor()
  const { questionId } = await request.json()
  if (!questionId) return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
  try {
    const result = await importFromLibrary(questionId, context.workspaceId, context.userId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 400 })
  }
}
