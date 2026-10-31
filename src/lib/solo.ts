import { v4 as uuidv4 } from 'uuid'
import { createAdminClient } from '@/lib/supabase/server'
import { copyFile } from '@/lib/storage'

/**
 * Students without a tutor. Each one gets their own workspace (kind 'solo')
 * holding copies of the approved shared library, so practice, marking,
 * spaced review and progress work exactly as they do for tutored students.
 * syncSoloLibrary keeps the copies in step with the library: new approved
 * questions arrive, edited ones update, withdrawn ones are archived.
 */

/** Courses a solo student can pick, as seeded into every workspace (migration 018). */
export const COURSES: { program: string; programName: string; grades: { code: string; name: string }[] }[] = [
  { program: 'IB', programName: 'IB', grades: [
    { code: 'M6', name: 'MYP year 1 (grade 6)' }, { code: 'M7', name: 'MYP year 2 (grade 7)' }, { code: 'M8', name: 'MYP year 3 (grade 8)' },
    { code: 'M9', name: 'MYP year 4 (grade 9)' }, { code: 'M10', name: 'MYP year 5 (grade 10)' },
    { code: 'AASL', name: 'DP Analysis and approaches SL' }, { code: 'AAHL', name: 'DP Analysis and approaches HL' },
    { code: 'AISL', name: 'DP Applications and interpretation SL' }, { code: 'AIHL', name: 'DP Applications and interpretation HL' },
  ] },
  { program: 'GCSE', programName: 'GCSE', grades: [{ code: 'Y9', name: 'Year 9' }, { code: 'Y10', name: 'Year 10' }, { code: 'Y11', name: 'Year 11' }] },
  { program: 'ALEVEL', programName: 'A-level', grades: [{ code: 'AS', name: 'AS (year 12)' }, { code: 'A2', name: 'A2 (year 13)' }] },
  { program: 'AP', programName: 'AP', grades: [{ code: 'AP-PRE', name: 'Pre-AP' }, { code: 'AP1', name: 'AP year 1' }, { code: 'AP2', name: 'AP year 2' }] },
  { program: 'GENERAL', programName: 'General maths', grades: [
    { code: 'G6', name: 'Grade 6' }, { code: 'G7', name: 'Grade 7' }, { code: 'G8', name: 'Grade 8' }, { code: 'G9', name: 'Grade 9' },
    { code: 'G10', name: 'Grade 10' }, { code: 'G11', name: 'Grade 11' }, { code: 'G12', name: 'Grade 12' },
  ] },
]

export function findCourse(program: string, grade: string) {
  const p = COURSES.find(c => c.program === program)
  const g = p?.grades.find(x => x.code === grade)
  return p && g ? { program: p, grade: g } : null
}

const courseKey = (program: string | null | undefined, grade: string | null | undefined) => `${program || ''}/${grade || ''}`

/** Approved library questions per course, keyed "PROGRAM/GRADE". */
export async function libraryCounts(): Promise<Record<string, number>> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('questions')
    .select('curriculum_json')
    .eq('library', 'global')
    .eq('review_status', 'approved')
    .eq('status', 'active')
    .limit(20000)
  const counts: Record<string, number> = {}
  for (const q of data ?? []) {
    const meta = (q.curriculum_json as Record<string, string | null> | null) || {}
    const key = courseKey(meta.libraryProgram, meta.libraryGrade)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

/** Whether any course has approved questions yet, so students can start on their own. */
export async function soloOpen(): Promise<boolean> {
  const admin = await createAdminClient()
  const { data } = await admin.from('questions').select('id').eq('library', 'global').eq('review_status', 'approved').eq('status', 'active').limit(1)
  return (data?.length ?? 0) > 0
}

export async function createSoloWorkspace(params: {
  userId: string
  name: string
  email: string
  program: string
  grade: string
  parentEmail: string | null
}): Promise<{ workspaceId: string }> {
  const admin = await createAdminClient()
  const { data: workspace, error } = await admin
    .from('workspaces')
    .insert({
      name: `${params.name.split(' ')[0] || 'My'}'s practice`.slice(0, 80),
      slug: `solo-${uuidv4().slice(0, 12)}`,
      kind: 'solo',
      settings_json: { allowStudentPractice: true, enableSpacedRepetition: true, questionGenerationEnabled: false },
    })
    .select('id')
    .single()
  if (error || !workspace) throw new Error(error?.message || 'Could not create your practice space')
  const workspaceId = workspace.id as string
  try {
    const { error: memberError } = await admin
      .from('workspace_members')
      .insert({ workspace_id: workspaceId, user_id: params.userId, role: 'student', joined_at: new Date().toISOString() })
    if (memberError) throw new Error(memberError.message)
    // Programmes and years are seeded by a trigger on workspace insert
    const { data: program } = await admin.from('study_programs').select('id').eq('workspace_id', workspaceId).eq('code', params.program).maybeSingle()
    const { data: grade } = program
      ? await admin.from('grade_levels').select('id').eq('workspace_id', workspaceId).eq('program_id', program.id).eq('code', params.grade).maybeSingle()
      : { data: null }
    const { error: profileError } = await admin.from('student_profiles').insert({
      workspace_id: workspaceId,
      user_id: params.userId,
      name: params.name,
      email: params.email,
      study_program_id: program?.id ?? null,
      grade_level_id: grade?.id ?? null,
      parent_email: params.parentEmail,
    })
    if (profileError) throw new Error(profileError.message)
  } catch (err) {
    await admin.from('workspaces').delete().eq('id', workspaceId)
    throw err
  }
  await syncSoloLibrary(workspaceId, { force: true })
  return { workspaceId }
}

const CONTENT_FIELDS = [
  'prompt_text', 'prompt_latex', 'answer_type', 'correct_answer_json', 'tolerance', 'solution_steps_json', 'hints_json',
  'difficulty', 'calculator_allowed', 'estimated_minutes', 'tags_json', 'curriculum_json', 'figure_json', 'parts_json',
  'curriculum_node_id', 'license', 'attribution',
] as const

const SYNC_EVERY_MS = 10 * 60_000

type LibraryRow = Record<string, unknown> & { id: string; updated_at: string; prompt_image_r2_key: string | null; curriculum_json: Record<string, string | null> | null }

/**
 * Bring a solo workspace's copies in step with the approved library. Cheap
 * when nothing changed; runs at most every ten minutes unless forced.
 */
export async function syncSoloLibrary(workspaceId: string, opts: { force?: boolean } = {}) {
  const admin = await createAdminClient()
  const { data: ws } = await admin.from('workspaces').select('kind, settings_json').eq('id', workspaceId).maybeSingle()
  if (!ws || ws.kind !== 'solo') return { added: 0, updated: 0, archived: 0 }
  const settings = (ws.settings_json as Record<string, unknown>) || {}
  const last = typeof settings.librarySyncedAt === 'string' ? Date.parse(settings.librarySyncedAt) : 0
  if (!opts.force && Date.now() - last < SYNC_EVERY_MS) return { added: 0, updated: 0, archived: 0 }
  // Claim the run first so parallel page loads don't all sync at once
  await admin.from('workspaces').update({ settings_json: { ...settings, librarySyncedAt: new Date().toISOString() } }).eq('id', workspaceId)

  const [{ data: library }, { data: copies }, { data: programs }, { data: grades }, { data: topics }] = await Promise.all([
    admin.from('questions').select('*').eq('library', 'global').eq('review_status', 'approved').eq('status', 'active').limit(20000),
    admin.from('questions').select('id, source_question_id, updated_at, status').eq('workspace_id', workspaceId).not('source_question_id', 'is', null).limit(20000),
    admin.from('study_programs').select('id, code').eq('workspace_id', workspaceId),
    admin.from('grade_levels').select('id, code, program_id').eq('workspace_id', workspaceId),
    admin.from('topics').select('id, name, program_id, grade_level_id').eq('workspace_id', workspaceId),
  ])
  const programId = new Map((programs ?? []).map(p => [p.code as string, p.id as string]))
  const gradeId = new Map((grades ?? []).map(g => [`${g.program_id}/${g.code}`, g.id as string]))
  const topicId = new Map((topics ?? []).map(t => [`${t.name}|${t.program_id ?? ''}|${t.grade_level_id ?? ''}`, t.id as string]))
  const bySource = new Map((copies ?? []).map(c => [c.source_question_id as string, c]))
  const live = new Set<string>()
  let added = 0, updated = 0, archived = 0

  async function topicFor(name: string | null, pId: string | null, gId: string | null, code: string | null) {
    if (!name) return null
    const key = `${name}|${pId ?? ''}|${gId ?? ''}`
    const found = topicId.get(key)
    if (found) return found
    const { data } = await admin.from('topics').insert({ workspace_id: workspaceId, name, program_id: pId, grade_level_id: gId, curriculum_code: code }).select('id').single()
    if (data?.id) topicId.set(key, data.id as string)
    return (data?.id as string | undefined) ?? null
  }

  for (const row of (library ?? []) as LibraryRow[]) {
    live.add(row.id)
    const meta = row.curriculum_json || {}
    const pId = meta.libraryProgram ? programId.get(meta.libraryProgram) ?? null : null
    const gId = pId && meta.libraryGrade ? gradeId.get(`${pId}/${meta.libraryGrade}`) ?? null : null
    const content: Record<string, unknown> = {}
    for (const f of CONTENT_FIELDS) content[f] = row[f] ?? null
    const existing = bySource.get(row.id)
    if (!existing) {
      let image: string | null = null
      if (row.prompt_image_r2_key) {
        try { image = await copyFile(row.prompt_image_r2_key, workspaceId, 'questions') } catch { image = null }
      }
      const { error } = await admin.from('questions').insert({
        ...content,
        workspace_id: workspaceId,
        topic_id: await topicFor(meta.libraryTopic ?? null, pId, gId, meta.curriculumCode ?? null),
        primary_program_id: pId,
        primary_grade_level_id: gId,
        prompt_image_r2_key: image,
        origin: 'imported',
        status: 'active',
        library: 'workspace',
        review_status: 'none',
        source_question_id: row.id,
        times_attempted: 0,
        times_correct: 0,
      })
      if (error) console.error('[solo] could not copy library question', row.id, error.message)
      else added++
    } else if (existing.status !== 'active' || Date.parse(row.updated_at) > Date.parse(existing.updated_at as string)) {
      const { error } = await admin.from('questions').update({ ...content, status: 'active' }).eq('id', existing.id)
      if (!error) updated++
    }
  }
  const withdrawn = (copies ?? []).filter(c => c.status === 'active' && !live.has(c.source_question_id as string)).map(c => c.id as string)
  if (withdrawn.length) {
    const { error } = await admin.from('questions').update({ status: 'archived' }).in('id', withdrawn)
    if (!error) archived = withdrawn.length
  }
  return { added, updated, archived }
}

/** Solo workspaces of a person, so deleting the account removes them too. */
export async function soloWorkspacesOf(userId: string): Promise<string[]> {
  const admin = await createAdminClient()
  const { data } = await admin.from('workspace_members').select('workspace_id, workspaces!inner(kind)').eq('user_id', userId).eq('workspaces.kind', 'solo')
  return (data ?? []).map(r => r.workspace_id as string)
}
