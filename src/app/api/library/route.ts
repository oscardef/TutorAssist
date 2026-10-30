import { NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

/** Browse approved library questions. Readable by any signed-in member. */
export async function GET(request: Request) {
  await requireUserContext()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
  const offset = parseInt(searchParams.get('offset') || '0')
  const nodeId = searchParams.get('nodeId')
  const curriculumId = searchParams.get('curriculumId')
  const supabase = await createServerClient()
  let query = supabase
    .from('questions')
    .select('id, prompt_text, prompt_latex, answer_type, difficulty, tags_json, curriculum_json, license, attribution, reviewed_at, curriculum_node_id', { count: 'exact' })
    .eq('library', 'global')
    .eq('review_status', 'approved')
    .order('reviewed_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (search) query = query.ilike('prompt_text', `%${search}%`)
  if (nodeId) {
    query = query.eq('curriculum_node_id', nodeId)
  } else if (curriculumId) {
    const { data: nodes } = await supabase.from('curriculum_nodes').select('id').eq('curriculum_id', curriculumId)
    const ids = (nodes || []).map(n => n.id)
    if (ids.length === 0) return NextResponse.json({ questions: [], total: 0 })
    query = query.in('curriculum_node_id', ids)
  }
  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data, total: count ?? 0 })
}
