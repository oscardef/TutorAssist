import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get all grade levels (optionally filtered by program)
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('programId')
  
  const supabase = await createServerClient()
  
  let query = supabase
    .from('grade_levels')
    .select(`
      *,
      program:study_programs (
        id,
        code,
        name,
        color
      )
    `)
    .eq('workspace_id', context.workspaceId)
    .eq('is_active', true)
    .order('program_id')
    .order('order_index')
  
  if (programId) {
    query = query.eq('program_id', programId)
  }
  
  const { data: gradeLevels, error } = await query
  
  if (error) {
    console.error('Error fetching grade levels:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ gradeLevels: gradeLevels || [] })
}

// Create a new grade level
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can create grade levels' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { programId, code, name, description, yearNumber } = body
    
    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // Get max order index for this program
    let orderQuery = supabase
      .from('grade_levels')
      .select('order_index')
      .eq('workspace_id', context.workspaceId)
      .order('order_index', { ascending: false })
      .limit(1)
    
    if (programId) {
      orderQuery = orderQuery.eq('program_id', programId)
    }
    
    const { data: maxOrder } = await orderQuery.single()
    const orderIndex = (maxOrder?.order_index || 0) + 1
    
    const { data: gradeLevel, error } = await supabase
      .from('grade_levels')
      .insert({
        workspace_id: context.workspaceId,
        program_id: programId || null,
        code: code.toUpperCase(),
        name,
        description: description || null,
        year_number: yearNumber || null,
        order_index: orderIndex,
      })
      .select(`
        *,
        program:study_programs (
          id,
          code,
          name,
          color
        )
      `)
      .single()
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A grade level with this code already exists for this program' }, { status: 409 })
      }
      throw error
    }
    
    return NextResponse.json({ gradeLevel })
  } catch (error) {
    console.error('Error creating grade level:', error)
    return NextResponse.json({ error: 'Failed to create grade level' }, { status: 500 })
  }
}

// Update a grade level
export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can update grade levels' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const gradeLevelId = searchParams.get('id')
  
  if (!gradeLevelId) {
    return NextResponse.json({ error: 'Grade level ID required' }, { status: 400 })
  }
  
  try {
    const body = await request.json()
    const { code, name, description, yearNumber, programId, is_active } = body
    
    const supabase = await createServerClient()
    
    // Build update object
    const updates: Record<string, unknown> = {}
    if (code !== undefined) updates.code = code.toUpperCase()
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (yearNumber !== undefined) updates.year_number = yearNumber
    if (programId !== undefined) updates.program_id = programId
    if (is_active !== undefined) updates.is_active = is_active
    
    const { data: gradeLevel, error } = await supabase
      .from('grade_levels')
      .update(updates)
      .eq('id', gradeLevelId)
      .eq('workspace_id', context.workspaceId)
      .select(`
        *,
        program:study_programs (
          id,
          code,
          name,
          color
        )
      `)
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ gradeLevel })
  } catch (error) {
    console.error('Error updating grade level:', error)
    return NextResponse.json({ error: 'Failed to update grade level' }, { status: 500 })
  }
}

// Delete a grade level
export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can delete grade levels' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const gradeLevelId = searchParams.get('id')
  
  if (!gradeLevelId) {
    return NextResponse.json({ error: 'Grade level ID required' }, { status: 400 })
  }
  
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('grade_levels')
    .delete()
    .eq('id', gradeLevelId)
    .eq('workspace_id', context.workspaceId)
  
  if (error) {
    console.error('Error deleting grade level:', error)
    return NextResponse.json({ error: 'Failed to delete grade level' }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}
