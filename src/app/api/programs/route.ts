import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get all study programs for the workspace
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
  
  // Get programs with their grade levels
  const { data: programs, error } = await supabase
    .from('study_programs')
    .select(`
      *,
      grade_levels (
        id,
        code,
        name,
        description,
        year_number,
        order_index,
        is_active
      )
    `)
    .eq('workspace_id', context.workspaceId)
    .eq('is_active', true)
    .order('order_index')
  
  if (error) {
    console.error('Error fetching programs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Sort grade levels within each program
  const sortedPrograms = programs?.map(program => ({
    ...program,
    grade_levels: program.grade_levels?.sort((a: { order_index: number }, b: { order_index: number }) => 
      a.order_index - b.order_index
    ) || []
  }))
  
  return NextResponse.json({ programs: sortedPrograms || [] })
}

// Create a new study program
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can create programs' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { code, name, description, color } = body
    
    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // Get max order index
    const { data: maxOrder } = await supabase
      .from('study_programs')
      .select('order_index')
      .eq('workspace_id', context.workspaceId)
      .order('order_index', { ascending: false })
      .limit(1)
      .single()
    
    const orderIndex = (maxOrder?.order_index || 0) + 1
    
    const { data: program, error } = await supabase
      .from('study_programs')
      .insert({
        workspace_id: context.workspaceId,
        code: code.toUpperCase(),
        name,
        description: description || null,
        color: color || '#3B82F6',
        order_index: orderIndex,
      })
      .select()
      .single()
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A program with this code already exists' }, { status: 409 })
      }
      throw error
    }
    
    return NextResponse.json({ program })
  } catch (error) {
    console.error('Error creating program:', error)
    return NextResponse.json({ error: 'Failed to create program' }, { status: 500 })
  }
}

// Update a study program
export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can update programs' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('id')
  
  if (!programId) {
    return NextResponse.json({ error: 'Program ID required' }, { status: 400 })
  }
  
  try {
    const body = await request.json()
    const { code, name, description, color, is_active } = body
    
    const supabase = await createServerClient()
    
    // Build update object
    const updates: Record<string, unknown> = {}
    if (code !== undefined) updates.code = code.toUpperCase()
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (color !== undefined) updates.color = color
    if (is_active !== undefined) updates.is_active = is_active
    
    const { data: program, error } = await supabase
      .from('study_programs')
      .update(updates)
      .eq('id', programId)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ program })
  } catch (error) {
    console.error('Error updating program:', error)
    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 })
  }
}

// Delete a study program
export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can delete programs' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('id')
  
  if (!programId) {
    return NextResponse.json({ error: 'Program ID required' }, { status: 400 })
  }
  
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('study_programs')
    .delete()
    .eq('id', programId)
    .eq('workspace_id', context.workspaceId)
  
  if (error) {
    console.error('Error deleting program:', error)
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}
