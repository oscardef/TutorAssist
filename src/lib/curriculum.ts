/**
 * Server helpers for the platform curriculum trees (see db/curricula and
 * migration 0007).
 */
type Client = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export interface SyllabusContext {
  nodeId: string
  /** One line for prompts, e.g. "IB DP Math AA (First assessment 2021) SL2.6 The quadratic function, SL and HL" */
  line: string
}

export async function syllabusContext(supabase: Client, nodeId: string | null | undefined): Promise<SyllabusContext | null> {
  if (!nodeId) return null
  const { data: node } = await supabase
    .from('curriculum_nodes')
    .select('id, code, title, level, curricula(framework, short_name, version)')
    .eq('id', nodeId)
    .maybeSingle()
  if (!node) return null
  const c = Array.isArray(node.curricula) ? node.curricula[0] : node.curricula
  const level = node.level === 'AHL' ? 'HL only' : node.level === 'EXT' ? 'extended mathematics only' : node.level === 'SL' && c?.framework === 'IB DP' ? 'SL and HL' : ''
  return {
    nodeId: node.id,
    line: `${c ? `${c.framework} ${c.short_name} (${c.version}) ` : ''}${node.code} ${node.title}${level ? `, ${level}` : ''}`,
  }
}

export function syllabusPrompt(ctx: SyllabusContext | null): string {
  if (!ctx) return ''
  return `\nSyllabus point: ${ctx.line}. Keep every question inside this syllabus point's scope and level, and do not rely on content from later syllabus points. Use IB command terms where they fit.\n`
}
