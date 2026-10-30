import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Platform curriculum trees. ?coverage=1 adds, per syllabus point, how many
 * approved library questions exist and how many this workspace has.
 */
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)

  const [{ data: curricula, error }, { data: nodes, error: nodesError }] = await Promise.all([
    supabase.from('curricula').select('id, code, framework, name, short_name, version, levels, status, source_note').neq('status', 'retired').order('order_index'),
    supabase.from('curriculum_nodes').select('id, curriculum_id, parent_id, code, title, level, depth').order('order_index'),
  ])
  if (error || nodesError) return NextResponse.json({ error: (error || nodesError)!.message }, { status: 500 })

  let coverage: Record<string, { library: number; workspace: number }> | undefined
  if (searchParams.get('coverage')) {
    coverage = {}
    const context = await getUserContext()
    const [{ data: lib }, { data: own }] = await Promise.all([
      supabase.from('questions').select('curriculum_node_id').eq('library', 'global').eq('review_status', 'approved').not('curriculum_node_id', 'is', null).limit(20000),
      context
        ? supabase.from('questions').select('curriculum_node_id').eq('workspace_id', context.workspaceId).eq('library', 'workspace').not('curriculum_node_id', 'is', null).limit(20000)
        : Promise.resolve({ data: [] as { curriculum_node_id: string }[] }),
    ])
    for (const q of lib || []) (coverage[q.curriculum_node_id] ??= { library: 0, workspace: 0 }).library++
    for (const q of own || []) (coverage[q.curriculum_node_id] ??= { library: 0, workspace: 0 }).workspace++
  }

  return NextResponse.json({
    curricula: (curricula || []).map(c => ({ ...c, nodes: (nodes || []).filter(n => n.curriculum_id === c.id) })),
    coverage,
  })
}
