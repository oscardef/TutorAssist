import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Re-queue a workspace question for library review. Questions are submitted
 * automatically on creation and on edit; this exists for questions that were
 * imported or rejected and should be looked at again without changes.
 */
export async function POST(request: Request) {
  const context = await requireTutor()
  const { questionId } = await request.json()
  if (!questionId) return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
  const supabase = await createServerClient()
  const { data: q } = await supabase.from('questions').select('id, library, review_status').eq('id', questionId).eq('workspace_id', context.workspaceId).maybeSingle()
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  if (q.library !== 'workspace') return NextResponse.json({ error: 'Already a library question' }, { status: 400 })
  if (q.review_status === 'submitted') return NextResponse.json({ ok: true, review_status: 'submitted' })
  const { error } = await supabase.from('questions').update({ review_status: 'submitted', submitted_at: new Date().toISOString(), review_notes: null }).eq('id', questionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, review_status: 'submitted' })
}
