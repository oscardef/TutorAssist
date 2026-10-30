'use client'

import { useState } from 'react'
import { Figure } from '@/components/figure'
import { emptyFigure, parseFigure, type FigureSpec, type FigureElement } from '@/lib/figures'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'

/**
 * Small authoring UI for figures: ranges, a list of elements, live preview.
 * Expressions use JavaScript syntax in x (x^2 - 3*x + 1, sin(x), sqrt(x)).
 */
export function FigureEditor({ value, onChange }: { value: FigureSpec | null; onChange: (spec: FigureSpec | null) => void }) {
  const [draft, setDraft] = useState<string>('')
  const spec = value
  const X = Icons.x
  const Plus = Icons.plus

  const update = (patch: Partial<FigureSpec>) => onChange({ ...(spec || emptyFigure()), ...patch })
  const setElements = (elements: FigureElement[]) => update({ elements })

  if (!spec) {
    return (
      <button type="button" onClick={() => onChange(emptyFigure())} className="btn btn-secondary btn-sm">
        <Plus className="h-4 w-4" /> Add a graph or diagram
      </button>
    )
  }

  const addFunction = () => {
    const expr = draft.trim()
    if (!expr) return
    setElements([...spec.elements, { kind: 'function', expr }])
    setDraft('')
  }
  const addPoint = () => setElements([...spec.elements, { kind: 'point', x: 0, y: 0, label: String.fromCharCode(65 + spec.elements.filter(e => e.kind === 'point').length) }])
  const addSegment = () => setElements([...spec.elements, { kind: 'segment', from: [0, 0], to: [3, 2] }])
  const addCircle = () => setElements([...spec.elements, { kind: 'circle', center: [0, 0], radius: 2 }])
  const addPolygon = () => setElements([...spec.elements, { kind: 'polygon', points: [[0, 0], [4, 0], [4, 3]] }])
  const remove = (i: number) => setElements(spec.elements.filter((_, idx) => idx !== i))
  const patchEl = (i: number, p: Partial<FigureElement>) => setElements(spec.elements.map((e, idx) => (idx === i ? ({ ...e, ...p } as FigureElement) : e)))
  const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="label">Function of x <InfoTip text="JavaScript-style: x^2 - 3*x + 1, sin(x), sqrt(x), abs(x), exp(x), log(x)" className="text-gray-500" /></span>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFunction() } }} placeholder="x^2 - 2*x - 3" className="input font-mono text-sm" />
          </label>
          <button type="button" onClick={addFunction} className="btn btn-primary btn-sm"><Plus className="h-4 w-4" /> Plot</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={addPoint} className="chip">+ point</button>
          <button type="button" onClick={addSegment} className="chip">+ segment</button>
          <button type="button" onClick={addCircle} className="chip">+ circle</button>
          <button type="button" onClick={addPolygon} className="chip">+ triangle</button>
        </div>

        {spec.elements.length > 0 && (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {spec.elements.map((el, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="chip chip-brand">{el.kind}</span>
                {el.kind === 'function' && <input value={el.expr} onChange={e => patchEl(i, { expr: e.target.value })} className="input !min-h-9 flex-1 font-mono text-sm" aria-label="Expression" />}
                {el.kind === 'point' && (<>
                  <input type="number" step="0.5" value={el.x} onChange={e => patchEl(i, { x: num(e.target.value) })} className="input !min-h-9 w-20 tnum" aria-label="x" />
                  <input type="number" step="0.5" value={el.y} onChange={e => patchEl(i, { y: num(e.target.value) })} className="input !min-h-9 w-20 tnum" aria-label="y" />
                </>)}
                {(el.kind === 'segment' || el.kind === 'line' || el.kind === 'vector') && (<>
                  {(['from', 'to'] as const).map(k => (
                    <span key={k} className="inline-flex items-center gap-1">
                      <input type="number" step="0.5" value={el[k][0]} onChange={e => patchEl(i, { [k]: [num(e.target.value), el[k][1]] } as Partial<FigureElement>)} className="input !min-h-9 w-16 tnum" aria-label={`${k} x`} />
                      <input type="number" step="0.5" value={el[k][1]} onChange={e => patchEl(i, { [k]: [el[k][0], num(e.target.value)] } as Partial<FigureElement>)} className="input !min-h-9 w-16 tnum" aria-label={`${k} y`} />
                    </span>
                  ))}
                </>)}
                {el.kind === 'circle' && (<>
                  <input type="number" step="0.5" value={el.center[0]} onChange={e => patchEl(i, { center: [num(e.target.value), el.center[1]] })} className="input !min-h-9 w-16 tnum" aria-label="centre x" />
                  <input type="number" step="0.5" value={el.center[1]} onChange={e => patchEl(i, { center: [el.center[0], num(e.target.value)] })} className="input !min-h-9 w-16 tnum" aria-label="centre y" />
                  <input type="number" step="0.5" min="0" value={el.radius} onChange={e => patchEl(i, { radius: Math.max(0, num(e.target.value)) })} className="input !min-h-9 w-16 tnum" aria-label="radius" />
                </>)}
                {el.kind === 'polygon' && <span className="text-gray-500 tnum">{el.points.map(p => `(${p[0]}, ${p[1]})`).join(' ')}</span>}
                {el.kind === 'text' && <input value={el.text} onChange={e => patchEl(i, { text: e.target.value })} className="input !min-h-9 flex-1" aria-label="Text" />}
                {'label' in el && (
                  <input value={el.label || ''} onChange={e => patchEl(i, { label: e.target.value } as Partial<FigureElement>)} placeholder="label" className="input !min-h-9 w-20" aria-label="Label" />
                )}
                <button type="button" onClick={() => remove(i)} className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-paper hover:text-ink" aria-label="Remove element"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3 text-sm">
          {(['xRange', 'yRange'] as const).map(k => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="font-semibold text-gray-600">{k === 'xRange' ? 'x' : 'y'}</span>
              <input type="number" step="1" value={spec[k][0]} onChange={e => update({ [k]: [num(e.target.value), spec[k][1]] })} className="input !min-h-9 w-16 tnum" aria-label={`${k} min`} />
              <span className="text-gray-400">to</span>
              <input type="number" step="1" value={spec[k][1]} onChange={e => update({ [k]: [spec[k][0], num(e.target.value)] })} className="input !min-h-9 w-16 tnum" aria-label={`${k} max`} />
            </span>
          ))}
          <label className="inline-flex items-center gap-2 text-gray-600"><input type="checkbox" checked={spec.grid !== false} onChange={e => update({ grid: e.target.checked })} className="h-4 w-4 accent-brand-600" /> grid</label>
          <label className="inline-flex items-center gap-2 text-gray-600"><input type="checkbox" checked={spec.keepAspect !== false} onChange={e => update({ keepAspect: e.target.checked })} className="h-4 w-4 accent-brand-600" /> equal scale</label>
          <button type="button" onClick={() => onChange(null)} className="btn btn-ghost btn-sm ml-auto !text-[#9b2c2c]">Remove figure</button>
        </div>
      </div>
      <div>
        <span className="label">Preview</span>
        {parseFigure(spec) ? <Figure spec={spec} height={300} /> : <p className="hint">Invalid figure</p>}
      </div>
    </div>
  )
}
