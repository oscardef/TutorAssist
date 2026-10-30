export interface CurriculumSeed {
  code: string
  framework: string
  name: string
  shortName: string
  version: string
  levels: string[]
  sourceNote: string
  orderIndex: number
  /** 'verified' once checked line by line against the official guide */
  status?: 'draft' | 'verified'
  /**
   * One line per node. "# 1 | Title" is a topic heading; "SL1.2 | Title" or
   * "AHL1.10 | Title" is a syllabus point under the last heading.
   */
  outline: string
}

export interface NodeSeed {
  code: string
  title: string
  level: string | null
  depth: number
  orderIndex: number
  parentCode: string | null
}

export function parseOutline(outline: string): NodeSeed[] {
  const nodes: NodeSeed[] = []
  let heading: string | null = null
  let order = 0
  for (const raw of outline.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const isHeading = line.startsWith('#')
    const [codePart, ...rest] = line.replace(/^#\s*/, '').split('|')
    const code = codePart.trim()
    const title = rest.join('|').trim()
    if (!code || !title) throw new Error(`Bad outline line: ${line}`)
    order += 10
    if (isHeading) {
      heading = code
      nodes.push({ code, title, level: null, depth: 0, orderIndex: order, parentCode: null })
    } else {
      const level = code.startsWith('AHL') ? 'AHL' : code.startsWith('SL') ? 'SL' : null
      nodes.push({ code, title, level, depth: 1, orderIndex: order, parentCode: heading })
    }
  }
  return nodes
}
