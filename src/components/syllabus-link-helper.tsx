'use client'

import { useMemo, useState } from 'react'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { useCurricula } from '@/components/syllabus-picker'
import { suggestNodes } from '@/lib/syllabus-match'

interface TopicLite { id: string; name: string; description: string | null; curriculum_node_id?: string | null }

/**
 * Bulk helper on the Topics page: for each topic without a syllabus point,
 * propose the best matches and link with one click.
 */
export function SyllabusLinkHelper({ topics, onLinked }: { topics: TopicLite[]; onLinked: () => void }) {
  const curricula = useCurricula()
  const [open, setOpen] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const course = curricula.find(c => c.id === courseId) ?? curricula[0]
  const unlinked = topics.filter(t => !t.curriculum_node_id && !skipped.has(t.id))
  const suggestions = useMemo(() => {
    if (!course) return new Map<string, ReturnType<typeof suggestNodes>>()
    return new Map(unlinked.map(t => [t.id, suggestNodes(t.name, t.description, course.nodes)]))
  }, [course, unlinked])

  if (!course || unlinked.length === 0) return null

  async function link(topicId: string, nodeId: string) {
    setBusy(topicId)
    await fetch(`/api/topics?id=${topicId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ curriculumNodeId: nodeId }) })
    setBusy(null)
    onLinked()
  }

  const Topics = Icons.topics
  return (
    <section className="card">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-5 text-left">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-spark-100 text-spark-700"><Topics className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">Link topics to the syllabus</span>
          <span className="block text-sm text-gray-500">{unlinked.length} topic{unlinked.length === 1 ? '' : 's'} not linked yet. Linked topics get syllabus-aware generation and show up in coverage.</span>
        </span>
        <Icons.chevronLeft className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="border-t border-line">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            {curricula.map(c => <button key={c.id} type="button" onClick={() => { setCourseId(c.id); setChoice({}) }} className={`chip ${c.id === course.id ? 'chip-brand' : ''}`}>{c.framework} {c.short_name}</button>)}
            <InfoTip text="Suggestions come from matching words in the topic's name and description. Pick another point or skip topics that don't fit this course." className="text-gray-400" />
          </div>
          <ul className="divide-y divide-line">
            {unlinked.map(t => {
              const sug = suggestions.get(t.id) ?? []
              // Preselect only confident matches; weaker ones stay listed under Suggested
              const selected = choice[t.id] ?? (sug[0] && sug[0].score >= 2 ? sug[0].node.id : '')
              return (
                <li key={t.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[12rem_1fr_auto] sm:items-center">
                  <span className="truncate text-sm font-bold text-ink" title={t.description || undefined}>{t.name}</span>
                  <select value={selected} onChange={e => setChoice(c => ({ ...c, [t.id]: e.target.value }))} className="input !min-h-9 !py-1 text-sm" aria-label={`Syllabus point for ${t.name}`}>
                    <option value="">Choose a syllabus point…</option>
                    {sug.length > 0 && (
                      <optgroup label="Suggested">
                        {sug.map(s => <option key={s.node.id} value={s.node.id}>{s.node.code} {s.node.title}</option>)}
                      </optgroup>
                    )}
                    {course.nodes.filter(n => n.depth === 0).map(h => (
                      <optgroup key={h.id} label={`${h.code} ${h.title}`}>
                        {course.nodes.filter(n => n.parent_id === h.id).map(n => <option key={n.id} value={n.id}>{n.code} {n.title}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <span className="flex gap-1">
                    <button type="button" disabled={!selected || busy === t.id} onClick={() => link(t.id, selected)} className="btn btn-primary btn-sm">{busy === t.id ? 'Linking…' : 'Link'}</button>
                    <button type="button" onClick={() => setSkipped(s => new Set(s).add(t.id))} className="btn btn-ghost btn-sm">Skip</button>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

/** One-click suggestions under the syllabus picker in the topic form. */
export function SyllabusSuggestions({ name, description, value, onPick }: { name: string; description: string; value: string | null; onPick: (id: string) => void }) {
  const curricula = useCurricula()
  const picks = useMemo(() => {
    if (!name.trim()) return []
    return curricula
      .flatMap(c => suggestNodes(name, description, c.nodes, 2).map(s => ({ ...s, course: c.short_name })))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [curricula, name, description])
  if (value || picks.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-gray-500">Suggested:</span>
      {picks.map(p => (
        <button key={p.node.id} type="button" onClick={() => onPick(p.node.id)} className="chip chip-brand hover:opacity-80" title={p.node.title}>{p.course} {p.node.code} {p.node.title.length > 28 ? p.node.title.slice(0, 28) + '…' : p.node.title}</button>
      ))}
    </div>
  )
}
