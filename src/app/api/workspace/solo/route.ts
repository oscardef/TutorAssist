import { NextResponse } from 'next/server'
import { getUser, getUserContext } from '@/lib/auth'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import { isSoloWorkspace } from '@/lib/student-plan'
import { COURSES, createSoloWorkspace, findCourse, libraryCounts } from '@/lib/solo'
import { requestParentConsent } from '@/lib/consent'

/** Courses a student can practise on their own, with how many questions each has. */
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const counts = await libraryCounts()
  return NextResponse.json({
    courses: COURSES.map(c => ({ ...c, grades: c.grades.map(g => ({ ...g, questions: counts[`${c.program}/${g.code}`] || 0 })) })),
  })
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Start practising without a tutor: creates the student's own practice space. */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { program?: string; grade?: string; over16?: boolean; parentEmail?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const course = findCourse(String(body.program || ''), String(body.grade || ''))
  if (!course) return NextResponse.json({ error: 'Choose your course and year.' }, { status: 400 })
  if (typeof body.over16 !== 'boolean') return NextResponse.json({ error: 'Tell us whether you are 16 or older.' }, { status: 400 })
  const parentEmail = body.over16 ? null : String(body.parentEmail || '').trim().toLowerCase()
  if (!body.over16) {
    if (!parentEmail || !EMAIL.test(parentEmail)) return NextResponse.json({ error: "Enter your parent or guardian's email address." }, { status: 400 })
    if (parentEmail === user.email.toLowerCase()) return NextResponse.json({ error: "Use your parent or guardian's own email address, not yours." }, { status: 400 })
  }

  const counts = await libraryCounts()
  if (!counts[`${course.program.program}/${course.grade.code}`]) {
    return NextResponse.json({ error: 'There are no questions for that course yet. Choose another, or ask your tutor for an invite.' }, { status: 409 })
  }

  const supabase = await createServerClient()
  const { data: existing, error: memberError } = await supabase.from('workspace_members').select('id').eq('user_id', user.id).limit(1).maybeSingle()
  if (memberError) return NextResponse.json({ error: 'Could not check your account. Try again in a moment.' }, { status: 503 })
  if (existing) return NextResponse.json({ error: 'Your account is already set up.' }, { status: 409 })

  try {
    await createSoloWorkspace({ userId: user.id, name: user.name || user.email.split('@')[0], email: user.email, program: course.program.program, grade: course.grade.code, parentEmail })
  } catch (err) {
    console.error('[solo] could not create practice space', err)
    return NextResponse.json({ error: 'Could not set up your practice space. Try again in a moment.' }, { status: 500 })
  }
  if (parentEmail) {
    try {
      await requestParentConsent({ studentUserId: user.id, childName: user.name || '', childEmail: user.email, parentEmail })
    } catch (err) {
      console.error('[solo] could not send the parent email', err)
    }
  }
  return NextResponse.json({ ok: true, consentPending: !!parentEmail })
}

/** Change course. Only students practising on their own choose their course. */
export async function PATCH(request: Request) {
  const context = await getUserContext()
  if (!context || context.role !== 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await isSoloWorkspace(context.workspaceId))) return NextResponse.json({ error: 'Your tutor sets your course.' }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { program?: string; grade?: string }
  const course = findCourse(String(body.program || ''), String(body.grade || ''))
  if (!course) return NextResponse.json({ error: 'Choose your course and year.' }, { status: 400 })
  const admin = await createAdminClient()
  const { data: program } = await admin.from('study_programs').select('id').eq('workspace_id', context.workspaceId).eq('code', course.program.program).maybeSingle()
  const { data: grade } = program
    ? await admin.from('grade_levels').select('id').eq('workspace_id', context.workspaceId).eq('program_id', program.id).eq('code', course.grade.code).maybeSingle()
    : { data: null }
  if (!program || !grade) return NextResponse.json({ error: 'That course is not available.' }, { status: 400 })
  const { error } = await admin.from('student_profiles').update({ study_program_id: program.id, grade_level_id: grade.id }).eq('workspace_id', context.workspaceId).eq('user_id', context.userId)
  if (error) return NextResponse.json({ error: 'Could not save your course.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
