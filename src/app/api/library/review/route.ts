import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { approveToLibrary, rejectFromLibrary, isPlatformOwnerEmail } from '@/lib/library'

async function requireOwner() {
  const context = await requireTutor()
  if (!context.isPlatformOwner && !isPlatformOwnerEmail(context.email)) return null
  return context
}

/** Queue of questions proposed for the library (platform owners only). */
export async function GET() {
  const context = await requireOwner()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('questions')
    .select('id, prompt_text, prompt_latex, answer_type, correct_answer_json, difficulty, hints_json, solution_steps_json, submitted_at, workspace_id, workspaces(name), topics(name)')
    .eq('library', 'workspace')
    .eq('review_status', 'submitted')
    .order('submitted_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data })
}

export async function POST(request: Request) {
  const context = await requireOwner()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { questionId, decision, notes } = await request.json()
  if (!questionId || !['approve', 'reject'].includes(decision)) return NextResponse.json({ error: 'questionId and decision are required' }, { status: 400 })
  try {
    if (decision === 'approve') {
      const id = await approveToLibrary(questionId, context.userId, context.workspaceId, notes || null)
      return NextResponse.json({ ok: true, libraryQuestionId: id })
    }
    await rejectFromLibrary(questionId, context.userId, notes || null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Review failed' }, { status: 400 })
  }
}
