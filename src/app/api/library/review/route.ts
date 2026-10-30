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
  const { questionId, questionIds, decision, notes } = await request.json()
  const ids: string[] = Array.isArray(questionIds) ? questionIds : questionId ? [questionId] : []
  if (ids.length === 0 || !['approve', 'reject'].includes(decision)) return NextResponse.json({ error: 'questionId(s) and decision are required' }, { status: 400 })
  const results: { id: string; ok: boolean; libraryQuestionId?: string; error?: string }[] = []
  for (const id of ids) {
    try {
      if (decision === 'approve') {
        const libraryQuestionId = await approveToLibrary(id, context.userId, context.workspaceId, notes || null)
        results.push({ id, ok: true, libraryQuestionId })
      } else {
        await rejectFromLibrary(id, context.userId, notes || null)
        results.push({ id, ok: true })
      }
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : 'Review failed' })
    }
  }
  const failed = results.filter(r => !r.ok)
  if (ids.length === 1 && failed.length === 1) return NextResponse.json({ error: failed[0].error }, { status: 400 })
  return NextResponse.json({ ok: failed.length === 0, results, approved: results.filter(r => r.ok).length, failed: failed.length })
}
