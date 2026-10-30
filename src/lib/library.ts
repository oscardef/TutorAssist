import { createAdminClient } from '@/lib/supabase/server'

/**
 * Shared question library. Every question belongs to a workspace bank; a
 * tutor can propose one for the library, a platform owner reviews it, and an
 * approved copy becomes a read-only global question any workspace can import.
 */

export const platformOwnerEmails = () =>
  (process.env.PLATFORM_OWNER_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

export function isPlatformOwnerEmail(email: string | null | undefined) {
  return !!email && platformOwnerEmails().includes(email.toLowerCase())
}

const COPY_FIELDS = [
  'origin', 'status', 'prompt_text', 'prompt_latex', 'prompt_image_r2_key', 'answer_type', 'correct_answer_json',
  'tolerance', 'solution_steps_json', 'hints_json', 'difficulty', 'calculator_allowed', 'estimated_minutes',
  'tags_json', 'curriculum_json', 'quality_score', 'generation_metadata', 'primary_program_id', 'primary_grade_level_id',
] as const

type QuestionRow = Record<string, unknown> & { id: string; workspace_id: string; topic_id: string | null }

async function topicMeta(topicId: string | null) {
  if (!topicId) return null
  const admin = await createAdminClient()
  const { data } = await admin
    .from('topics')
    .select('name, curriculum_code, program:study_programs(code, name), grade_level:grade_levels(code, name)')
    .eq('id', topicId)
    .maybeSingle()
  return data as { name: string; curriculum_code: string | null; program: { code: string; name: string } | null; grade_level: { code: string; name: string } | null } | null
}

/** Approve: create the global copy and mark the original. */
export async function approveToLibrary(questionId: string, reviewerId: string, reviewerWorkspaceId: string, notes: string | null) {
  const admin = await createAdminClient()
  const { data: original, error } = await admin.from('questions').select('*').eq('id', questionId).single()
  if (error || !original) throw new Error('Question not found')
  const q = original as QuestionRow
  if (q.review_status !== 'submitted') throw new Error('Question is not awaiting review')
  const topic = await topicMeta(q.topic_id)
  const copy: Record<string, unknown> = {}
  for (const f of COPY_FIELDS) copy[f] = q[f] ?? null
  Object.assign(copy, {
    workspace_id: reviewerWorkspaceId,
    topic_id: null,
    primary_program_id: null,
    primary_grade_level_id: null,
    library: 'global',
    review_status: 'approved',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_notes: notes,
    source_question_id: q.id,
    license: q.license || 'private',
    attribution: q.attribution || null,
    status: 'active',
    curriculum_json: {
      ...((q.curriculum_json as Record<string, unknown>) || {}),
      libraryTopic: topic?.name || null,
      libraryProgram: topic?.program?.code || null,
      libraryGrade: topic?.grade_level?.code || null,
      curriculumCode: topic?.curriculum_code || null,
    },
    times_attempted: 0,
    times_correct: 0,
    avg_time_seconds: null,
    created_by: reviewerId,
  })
  const { data: inserted, error: insertError } = await admin.from('questions').insert(copy).select('id').single()
  if (insertError) throw new Error(insertError.message)
  await admin.from('questions').update({ review_status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_notes: notes }).eq('id', q.id)
  return inserted.id as string
}

export async function rejectFromLibrary(questionId: string, reviewerId: string, notes: string | null) {
  const admin = await createAdminClient()
  const { error } = await admin.from('questions').update({ review_status: 'rejected', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_notes: notes }).eq('id', questionId).eq('review_status', 'submitted')
  if (error) throw new Error(error.message)
}

/** Import an approved global question into a workspace, creating the topic by name if needed. */
export async function importFromLibrary(globalQuestionId: string, workspaceId: string, userId: string) {
  const admin = await createAdminClient()
  const { data: source, error } = await admin.from('questions').select('*').eq('id', globalQuestionId).eq('library', 'global').eq('review_status', 'approved').single()
  if (error || !source) throw new Error('Library question not found')
  const q = source as QuestionRow
  const meta = (q.curriculum_json as Record<string, unknown>) || {}
  const topicName = (meta.libraryTopic as string | null) || null
  let topicId: string | null = null
  if (topicName) {
    const { data: existing } = await admin.from('topics').select('id').eq('workspace_id', workspaceId).eq('name', topicName).maybeSingle()
    if (existing) topicId = existing.id
    else {
      const { data: created } = await admin.from('topics').insert({ workspace_id: workspaceId, name: topicName, curriculum_code: (meta.curriculumCode as string | null) || null }).select('id').single()
      topicId = created?.id ?? null
    }
  }
  const { data: already } = await admin.from('questions').select('id').eq('workspace_id', workspaceId).eq('source_question_id', q.id).maybeSingle()
  if (already) return { id: already.id as string, duplicate: true }
  const copy: Record<string, unknown> = {}
  for (const f of COPY_FIELDS) copy[f] = q[f] ?? null
  Object.assign(copy, {
    workspace_id: workspaceId,
    topic_id: topicId,
    primary_program_id: null,
    primary_grade_level_id: null,
    origin: 'imported',
    status: 'active',
    library: 'workspace',
    review_status: 'none',
    source_question_id: q.id,
    license: q.license,
    attribution: q.attribution,
    times_attempted: 0,
    times_correct: 0,
    avg_time_seconds: null,
    created_by: userId,
  })
  const { data: inserted, error: insertError } = await admin.from('questions').insert(copy).select('id').single()
  if (insertError) throw new Error(insertError.message)
  return { id: inserted.id as string, duplicate: false }
}
