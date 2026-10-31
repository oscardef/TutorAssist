'use client'

import { useEffect, useMemo, useState } from 'react'
import { InfoTip } from '@/components/ui/info-tip'

export interface CurriculumNode { id: string; curriculum_id: string; parent_id: string | null; code: string; title: string; level: string | null; depth: number }
export interface Curriculum { id: string; code: string; framework: string; name: string; short_name: string; version: string; levels: string[]; status: string; source_note: string | null; nodes: CurriculumNode[] }

let cache: Promise<Curriculum[]> | null = null
export function loadCurricula(): Promise<Curriculum[]> {
  cache ??= fetch('/api/curricula').then(r => r.json()).then(d => (d.curricula || []) as Curriculum[]).catch(() => { cache = null; return [] })
  return cache
}

export function useCurricula() {
  const [curricula, setCurricula] = useState<Curriculum[]>([])
  useEffect(() => { let live = true; loadCurricula().then(c => { if (live) setCurricula(c) }); return () => { live = false } }, [])
  return curricula
}

/** Short tag for a syllabus point's level: HL-only (DP) or extended (MYP). */
export function levelTag(level: string | null | undefined): string | null {
  return level === 'AHL' ? 'HL' : level === 'EXT' ? 'Extended' : null
}

export function nodeLabel(node: CurriculumNode) {
  return `${node.code} ${node.title}`
}

/** Pick the syllabus point a question covers, e.g. Math AA › SL2.6 The quadratic function. */
export function SyllabusPicker({ value, onChange }: { value: string | null; onChange: (nodeId: string | null) => void }) {
  const curricula = useCurricula()
  const owner = useMemo(() => curricula.find(c => c.nodes.some(n => n.id === value)), [curricula, value])
  const [picked, setPicked] = useState<string>('')
  const curriculumId = owner?.id ?? picked
  const current = curricula.find(c => c.id === curriculumId)
  const groups = useMemo(() => {
    if (!current) return []
    const headings = current.nodes.filter(n => n.depth === 0)
    return headings.map(h => ({ heading: h, items: current.nodes.filter(n => n.parent_id === h.id) }))
  }, [current])

  return (
    <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
      <label>
        <span className="hint mb-1 flex items-center gap-1">Course {current?.status === 'draft' && <InfoTip text={current.source_note || 'Draft syllabus outline'} className="text-gray-400" />}</span>
        <select value={curriculumId} onChange={e => { setPicked(e.target.value); onChange(null) }} className="input">
          <option value="">None</option>
          {curricula.map(c => <option key={c.id} value={c.id}>{c.framework} {c.short_name}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="hint mb-1 block">Syllabus point</span>
        <select value={value || ''} onChange={e => onChange(e.target.value || null)} disabled={!current} className="input">
          <option value="">{current ? 'Choose a syllabus point…' : 'Choose a course first'}</option>
          {groups.map(g => (
            <optgroup key={g.heading.id} label={`${g.heading.code} ${g.heading.title}`}>
              {g.items.map(n => <option key={n.id} value={n.id}>{n.code} {n.title}{levelTag(n.level) ? ` (${levelTag(n.level)})` : ''}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  )
}
