import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get the current student's profile
export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  const supabase = await createServerClient()
  
  // Get student profile with program and grade level
  const { data: profile, error } = await supabase
    .from('student_profiles')
    .select(`
      id,
      user_id,
      name,
      email,
      private_notes,
      study_program_id,
      grade_level_id,
      study_program:study_programs(id, code, name, color),
      grade_level:grade_levels(id, code, name, year_number)
    `)
    .eq('workspace_id', context.workspaceId)
    .eq('user_id', user.id)
    .single()
  
  if (error) {
    // May not have a profile yet
    if (error.code === 'PGRST116') {
      return NextResponse.json({ profile: null })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ profile })
}

// Update the current student's profile
export async function PUT(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { studyProgramId, gradeLevelId, name } = body
    
    const supabase = await createServerClient()
    
    const updateData: Record<string, unknown> = {}
    if (studyProgramId !== undefined) updateData.study_program_id = studyProgramId
    if (gradeLevelId !== undefined) updateData.grade_level_id = gradeLevelId
    if (name !== undefined) updateData.name = name
    
    const { data: profile, error } = await supabase
      .from('student_profiles')
      .update(updateData)
      .eq('workspace_id', context.workspaceId)
      .eq('user_id', user.id)
      .select(`
        id,
        user_id,
        name,
        email,
        study_program_id,
        grade_level_id,
        study_program:study_programs(id, code, name, color),
        grade_level:grade_levels(id, code, name, year_number)
      `)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
