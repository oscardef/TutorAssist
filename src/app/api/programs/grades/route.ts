import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Create a new grade level for a program
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check user is a tutor in their workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, workspace_id')
    .eq('user_id', user.id)
    .single()

  if (membership?.role !== 'tutor' && membership?.role !== 'platform_owner') {
    return NextResponse.json({ error: 'Only tutors can create grade levels' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { programId, code, name, yearNumber } = body

    if (!programId || !code?.trim() || !name?.trim()) {
      return NextResponse.json(
        { error: 'Program ID, code, and name are required' },
        { status: 400 }
      )
    }

    // Verify the program exists and belongs to the workspace
    const { data: program } = await supabase
      .from('study_programs')
      .select('id, workspace_id')
      .eq('id', programId)
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Get the max order_index for this program
    const { data: existingGrades } = await supabase
      .from('grade_levels')
      .select('order_index')
      .eq('study_program_id', programId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingGrades?.[0]?.order_index != null 
      ? existingGrades[0].order_index + 1 
      : 0

    // Create the grade level
    const { data: gradeLevel, error: createError } = await supabase
      .from('grade_levels')
      .insert({
        study_program_id: programId,
        code: code.trim(),
        name: name.trim(),
        year_number: yearNumber || null,
        order_index: nextOrderIndex,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating grade level:', createError)
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: 'A grade level with this code already exists in this program' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Failed to create grade level' }, { status: 500 })
    }

    return NextResponse.json({ gradeLevel })
  } catch (error) {
    console.error('Error in grades POST:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

// GET - Get all grade levels, optionally filtered by program
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!membership?.workspace_id) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('programId')

  let query = supabase
    .from('grade_levels')
    .select(`
      id,
      code,
      name,
      year_number,
      order_index,
      study_program_id,
      study_programs!inner (
        id,
        workspace_id
      )
    `)
    .eq('study_programs.workspace_id', membership.workspace_id)

  if (programId) {
    query = query.eq('study_program_id', programId)
  }

  const { data: gradeLevels, error } = await query.order('order_index')

  if (error) {
    console.error('Error fetching grade levels:', error)
    return NextResponse.json({ error: 'Failed to fetch grade levels' }, { status: 500 })
  }

  return NextResponse.json({ gradeLevels })
}
