import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

/** Propose a workspace question for the shared library, or withdraw it. */
export async function POST(request: Request) {
  const context = await requireTutor()
  const { questionId, action = 'submit' } = await request.json()
  if (!questionId) return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
  const supabase = await createServerClient()
  const { data: q } = await supabase.from('questions').select('id, library, review_status').eq('id', questionId).eq('workspace_id', context.workspaceId).maybeSingle()
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  if (q.library !== 'workspace') return NextResponse.json({ error: 'Already a library question' }, { status: 400 })
  if (action === 'withdraw') {
    if (q.review_status !== 'submitted') return NextResponse.json({ error: 'Not awaiting review' }, { status: 400 })
    await supabase.from('questions').update({ review_status: 'none', submitted_at: null }).eq('id', questionId)
    return NextResponse.json({ ok: true, review_status: 'none' })
  }
  if (q.review_status === 'submitted' || q.review_status === 'approved') return NextResponse.json({ ok: true, review_status: q.review_status })
  const { error } = await supabase.from('questions').update({ review_status: 'submitted', submitted_at: new Date().toISOString(), review_notes: null }).eq('id', questionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, review_status: 'submitted' })
}
