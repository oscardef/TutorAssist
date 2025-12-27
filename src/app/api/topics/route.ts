import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get topics for workspace
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
  const gradeLevelId = searchParams.get('gradeLevelId')
  
  const supabase = await createServerClient()
  
  let query = supabase
    .from('topics')
    .select(`
      *,
      questions:questions(count),
      program:study_programs (
        id,
        code,
        name,
        color
      ),
      grade_level:grade_levels (
        id,
        code,
        name,
        year_number
      )
    `)
    .eq('workspace_id', context.workspaceId)
  
  // Apply filters
  if (programId) {
    query = query.eq('program_id', programId)
  }
  if (gradeLevelId) {
    query = query.eq('grade_level_id', gradeLevelId)
  }
  
  query = query
    .order('program_id', { nullsFirst: false })
    .order('grade_level_id', { nullsFirst: false })
    .order('parent_id', { nullsFirst: true }) // Parents first (null parent_id = unit)
    .order('order_index')
    .order('name')
  
  const { data: topics, error } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ topics })
}

// Create a new topic
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can create topics' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { name, description, parentId, programId, gradeLevelId, isCore, curriculumCode } = body
    
    if (!name) {
      return NextResponse.json({ error: 'Topic name required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // Get max order index
    const { data: maxOrder } = await supabase
      .from('topics')
      .select('order_index')
      .eq('workspace_id', context.workspaceId)
      .order('order_index', { ascending: false })
      .limit(1)
      .single()
    
    const orderIndex = (maxOrder?.order_index || 0) + 1
    
    // If parentId provided, verify it exists
    if (parentId) {
      const { data: parent } = await supabase
        .from('topics')
        .select('id')
        .eq('id', parentId)
        .eq('workspace_id', context.workspaceId)
        .single()
      
      if (!parent) {
        return NextResponse.json({ error: 'Parent topic not found' }, { status: 404 })
      }
    }
    
    const { data: topic, error } = await supabase
      .from('topics')
      .insert({
        workspace_id: context.workspaceId,
        name,
        description: description || null,
        parent_id: parentId || null,
        program_id: programId || null,
        grade_level_id: gradeLevelId || null,
        is_core: isCore || false,
        curriculum_code: curriculumCode || null,
        order_index: orderIndex,
      })
      .select(`
        *,
        program:study_programs (
          id,
          code,
          name,
          color
        ),
        grade_level:grade_levels (
          id,
          code,
          name,
          year_number
        )
      `)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ topic })
  } catch (error) {
    console.error('Create topic error:', error)
    return NextResponse.json(
      { error: 'Failed to create topic' },
      { status: 500 }
    )
  }
}

// Update a topic
export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can update topics' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const topicId = searchParams.get('id')
  
  if (!topicId) {
    return NextResponse.json({ error: 'Topic ID required' }, { status: 400 })
  }
  
  try {
    const body = await request.json()
    const { name, description, parentId, programId, gradeLevelId, isCore, curriculumCode } = body
    
    const supabase = await createServerClient()
    
    // Build update object
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (parentId !== undefined) updates.parent_id = parentId || null
    if (programId !== undefined) updates.program_id = programId || null
    if (gradeLevelId !== undefined) updates.grade_level_id = gradeLevelId || null
    if (isCore !== undefined) updates.is_core = isCore
    if (curriculumCode !== undefined) updates.curriculum_code = curriculumCode || null
    
    const { data: topic, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', topicId)
      .eq('workspace_id', context.workspaceId)
      .select(`
        *,
        program:study_programs (
          id,
          code,
          name,
          color
        ),
        grade_level:grade_levels (
          id,
          code,
          name,
          year_number
        )
      `)
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ topic })
  } catch (error) {
    console.error('Update topic error:', error)
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 })
  }
}

// Delete a topic
export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can delete topics' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const topicId = searchParams.get('id')
  
  if (!topicId) {
    return NextResponse.json({ error: 'Topic ID required' }, { status: 400 })
  }
  
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', topicId)
    .eq('workspace_id', context.workspaceId)
  
  if (error) {
    console.error('Delete topic error:', error)
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}