import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Get topics for workspace
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
  
  const { data: topics, error } = await supabase
    .from('topics')
    .select(`
      *,
      questions:questions(count)
    `)
    .eq('workspace_id', context.workspaceId)
    .order('display_order')
    .order('name')
  
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
    const { name, description, parentId, color, icon } = body
    
    if (!name) {
      return NextResponse.json({ error: 'Topic name required' }, { status: 400 })
    }
    
    const supabase = await createServerClient()
    
    // Get max display order
    const { data: maxOrder } = await supabase
      .from('topics')
      .select('display_order')
      .eq('workspace_id', context.workspaceId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single()
    
    const displayOrder = (maxOrder?.display_order || 0) + 1
    
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
        parent_topic_id: parentId || null,
        display_order: displayOrder,
        color: color || null,
        icon: icon || null,
      })
      .select()
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
