import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Create a workspace's topics from a platform syllabus: one parent topic per
 * syllabus topic and one topic per syllabus point, each linked to its point.
 * `fullCourse` false leaves out HL-only (DP) and extended-only (MYP) points.
 * Points that already have a topic in the workspace are skipped.
 */
export async function POST(request: Request) {
  const context = await requireTutor()
  const { curriculumId, fullCourse = true } = await request.json().catch(() => ({})) as { curriculumId?: string; fullCourse?: boolean }
  if (!curriculumId) return NextResponse.json({ error: 'curriculumId is required' }, { status: 400 })
  const supabase = await createServerClient()

  const { data: nodes } = await supabase.from('curriculum_nodes').select('id, parent_id, code, title, level, depth, order_index').eq('curriculum_id', curriculumId).order('order_index')
  if (!nodes?.length) return NextResponse.json({ error: 'Unknown course' }, { status: 404 })
  const { data: existing } = await supabase.from('topics').select('id, curriculum_node_id').eq('workspace_id', context.workspaceId).not('curriculum_node_id', 'is', null)
  const have = new Map((existing ?? []).map(t => [t.curriculum_node_id as string, t.id as string]))

  let created = 0
  const parentTopic = new Map<string, string>()
  for (const h of nodes.filter(n => n.depth === 0)) {
    const points = nodes.filter(n => n.parent_id === h.id && (fullCourse || (n.level !== 'AHL' && n.level !== 'EXT')))
    if (points.length === 0) continue
    let parentId = have.get(h.id)
    if (!parentId) {
      const { data, error } = await supabase.from('topics').insert({ workspace_id: context.workspaceId, name: h.title, curriculum_node_id: h.id, curriculum_code: h.code, order_index: h.order_index }).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      parentId = data.id as string
      created++
    }
    parentTopic.set(h.id, parentId)
    const rows = points.filter(p => !have.has(p.id)).map(p => ({
      workspace_id: context.workspaceId, name: p.title, parent_id: parentId, curriculum_node_id: p.id, curriculum_code: p.code, order_index: p.order_index,
    }))
    if (rows.length) {
      const { error } = await supabase.from('topics').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      created += rows.length
    }
  }
  return NextResponse.json({ ok: true, created })
}
