import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserById } from '@/lib/users'
import { deleteWorkspaceFiles, copyFile } from '@/lib/storage'

/**
 * Self-service data export and account deletion (privacy policy). Both run
 * with the service role after the route has confirmed who is asking, and only
 * ever for that person.
 */

export async function exportAccount(userId: string) {
  const admin = await createAdminClient()
  const user = await getUserById(userId)
  const pick = async <T>(q: PromiseLike<{ data: T | null }>) => (await q).data ?? ([] as unknown as T)
  const [memberships, profiles, attempts, review, assignments, sessions, notesForMe, notesByMe, flags, questions, booking] = await Promise.all([
    pick(admin.from('workspace_members').select('role, created_at, workspaces(name)').eq('user_id', userId)),
    pick(admin.from('student_profiles').select('name, email, created_at, workspace_id').eq('user_id', userId)),
    pick(admin.from('attempts').select('submitted_at, answer_raw, is_correct, partial_credit, time_spent_seconds, hints_viewed, questions(prompt_text)').eq('student_user_id', userId).order('submitted_at')),
    pick(admin.from('spaced_repetition').select('*').eq('student_user_id', userId)),
    pick(admin.from('assignments').select('title, description, status, due_at, created_at').eq('assigned_student_user_id', userId)),
    pick(admin.from('sessions').select('scheduled_at, duration_minutes, status, actual_start, actual_end, tutor_id, student_id, session_notes').or(`student_id.eq.${userId},tutor_id.eq.${userId}`)),
    pick(admin.from('tutor_feedback').select('comment, error_tags, created_at').eq('student_user_id', userId).eq('is_private', false)),
    pick(admin.from('tutor_feedback').select('comment, error_tags, is_private, created_at').eq('tutor_user_id', userId)),
    pick(admin.from('question_flags').select('flag_type, comment, created_at').eq('student_user_id', userId)),
    pick(admin.from('questions').select('prompt_text, prompt_latex, answer_type, correct_answer_json, created_at').eq('created_by', userId).eq('library', 'workspace')),
    pick(admin.from('booking_settings').select('enabled, timezone, slot_minutes, windows').eq('tutor_user_id', userId)),
  ])
  // Tutors' private notes in sessions stay with the tutor's own export
  const sessionsOut = (sessions as { tutor_id: string; session_notes: string | null }[]).map(s => ({ ...s, session_notes: s.tutor_id === userId ? s.session_notes : undefined, tutor_id: undefined }))
  return {
    exported_at: new Date().toISOString(),
    about: 'Your personal data held by Mathium (mathium.app). Uploaded files and whiteboard images are not included; ask privacy@mathium.app for copies.',
    account: user ? { id: user.id, name: user.name, email: user.email, email_verified: user.emailVerified, created_at: user.createdAt } : null,
    memberships, student_profiles: profiles, practice_attempts: attempts, review_schedule: review, assignments,
    sessions: sessionsOut, tutor_notes_for_you: notesForMe, notes_you_wrote: notesByMe, flags_you_raised: flags,
    questions_you_wrote: questions, booking_settings: booking,
  }
}

export type DeleteResult = { ok: true; deletedWorkspaces: string[] } | { ok: false; blocked: { workspace_id: string; members: number }[] }

export async function deleteAccount(userId: string, deleteSoleWorkspaces: boolean): Promise<DeleteResult> {
  const rows = await db.execute(sql`select public.delete_user_account(${userId}::uuid, ${deleteSoleWorkspaces}) as result`)
  type Archived = { archive: string | null; images: { id: string; key: string }[] }
  const result = (rows as unknown as { result: { ok: boolean; blocked?: { workspace_id: string; members: number }[]; deleted_workspaces?: string[]; archived?: Archived[] } }[])[0]?.result
  if (!result?.ok) return { ok: false, blocked: result?.blocked ?? [] }
  const deletedWorkspaces = result.deleted_workspaces ?? []
  // Questions moved to the platform archive keep their images: copy each into
  // the archive's folder before the old workspace's files go
  const admin = await createAdminClient()
  for (const a of result.archived ?? []) {
    if (!a.archive) continue
    for (const img of a.images ?? []) {
      try {
        const key = await copyFile(img.key, a.archive, 'questions')
        await admin.from('questions').update({ prompt_image_r2_key: key }).eq('id', img.id)
      } catch (err) {
        console.error('[account] could not keep image of archived question', img.id, err)
      }
    }
  }
  for (const ws of deletedWorkspaces) {
    try { await deleteWorkspaceFiles(ws) } catch (err) { console.error('[account] could not remove files of workspace', ws, err) }
  }
  return { ok: true, deletedWorkspaces }
}
