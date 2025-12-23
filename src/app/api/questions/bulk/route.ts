import { NextRequest, NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const context = await requireTutor()
    const supabase = await createServerClient()
    const body = await request.json()
    
    const { action, questionIds } = body
    
    if (!action || !questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ error: 'Action and question IDs required' }, { status: 400 })
    }
    
    // Verify all questions belong to the workspace
    const { data: questions, error: verifyError } = await supabase
      .from('questions')
      .select('id')
      .eq('workspace_id', context.workspaceId)
      .in('id', questionIds)
    
    if (verifyError || !questions || questions.length !== questionIds.length) {
      return NextResponse.json({ error: 'Some questions not found or not accessible' }, { status: 403 })
    }
    
    let result
    
    switch (action) {
      case 'archive':
        const { error: archiveError } = await supabase
          .from('questions')
          .update({ status: 'archived' })
          .eq('workspace_id', context.workspaceId)
          .in('id', questionIds)
        
        if (archiveError) throw archiveError
        result = { archived: questionIds.length }
        break
        
      case 'delete':
        const { error: deleteError } = await supabase
          .from('questions')
          .delete()
          .eq('workspace_id', context.workspaceId)
          .in('id', questionIds)
        
        if (deleteError) throw deleteError
        result = { deleted: questionIds.length }
        break
        
      case 'activate':
        const { error: activateError } = await supabase
          .from('questions')
          .update({ status: 'active' })
          .eq('workspace_id', context.workspaceId)
          .in('id', questionIds)
        
        if (activateError) throw activateError
        result = { activated: questionIds.length }
        break
        
      case 'assign':
        // For assign, we would need an assignment ID
        // This is a placeholder - implement based on your assignment flow
        return NextResponse.json({ 
          error: 'Assignment action requires assignment_id parameter',
          requiresInput: true 
        }, { status: 400 })
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, ...result })
    
  } catch (error) {
    console.error('Bulk action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
}
