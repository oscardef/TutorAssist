'use client'

import { useEffect, useRef, useId } from 'react'
import type { FigureSpec, FigureElement } from '@/lib/figures'
import { FIGURE_COLORS } from '@/lib/figures'
import '@/styles/jsxgraph.css'

/**
 * Renders a FigureSpec with JSXGraph (LGPL/MIT dual licence). Loaded only in
 * the browser; the board is rebuilt whenever the spec changes.
 */
export function Figure({ spec, className = '', height = 280, interactive = false }: { spec: FigureSpec; className?: string; height?: number; interactive?: boolean }) {
  const id = useId().replace(/[:]/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const key = JSON.stringify(spec)

  useEffect(() => {
    let board: { removeObject?: unknown } | null = null
    let cancelled = false
    ;(async () => {
      const mod = await import('jsxgraph')
      const JXG = ((mod as unknown as { default?: unknown }).default ?? mod) as typeof import('jsxgraph')
      if (cancelled || !ref.current) return
      const [x0, x1] = spec.xRange
      const [y0, y1] = spec.yRange
      const b = JXG.JSXGraph.initBoard(ref.current.id, {
        boundingbox: [x0, y1, x1, y0],
        axis: spec.axes !== false,
        grid: spec.grid !== false,
        keepaspectratio: spec.keepAspect !== false,
        showCopyright: false,
        showNavigation: false,
        pan: { enabled: interactive },
        zoom: { wheel: interactive, needShift: false },
        defaultAxes: {
          x: { ticks: { insertTicks: true, minorTicks: 0, label: { fontSize: 11 } } },
          y: { ticks: { insertTicks: true, minorTicks: 0, label: { fontSize: 11 } } },
        },
      })
      board = b
      let colorIdx = 0
      const nextColor = (c?: string) => c || FIGURE_COLORS[colorIdx++ % FIGURE_COLORS.length]
      const style = (c?: string, extra: Record<string, unknown> = {}) => ({ strokeColor: nextColor(c), strokeWidth: 2, fixed: !interactive, highlight: false, ...extra })
      spec.elements.forEach((el: FigureElement) => {
        try {
          switch (el.kind) {
            case 'function': {
              const f = b.jc.snippet(el.expr, true, 'x', true)
              const dom = el.domain || [x0, x1]
              b.create('functiongraph', [f, dom[0], dom[1]], { ...style(el.color), name: el.label || '', withLabel: !!el.label })
              break
            }
            case 'point':
              b.create('point', [el.x, el.y], { name: el.label || '', size: 3, fillColor: nextColor(el.color), strokeColor: '#17202f', fixed: !interactive, highlight: false, label: { fontSize: 12 } })
              break
            case 'segment':
              b.create('segment', [el.from, el.to], { ...style(el.color), name: el.label || '', withLabel: !!el.label })
              break
            case 'line':
              b.create('line', [el.from, el.to], { ...style(el.color, { dash: el.dashed ? 2 : 0 }) })
              break
            case 'circle':
              b.create('circle', [el.center, el.radius], { ...style(el.color), fillColor: nextColor(el.color), fillOpacity: 0.06, name: el.label || '', withLabel: !!el.label })
              break
            case 'polygon':
              b.create('polygon', el.points, { borders: { strokeColor: nextColor(el.color), strokeWidth: 2, highlight: false }, fillColor: nextColor(el.color), fillOpacity: 0.08, vertices: { visible: false }, highlight: false, fixed: !interactive, name: el.label || '', withLabel: !!el.label })
              break
            case 'vector':
              b.create('arrow', [el.from, el.to], { ...style(el.color), name: el.label || '', withLabel: !!el.label })
              break
            case 'text':
              b.create('text', [el.x, el.y, el.text], { fontSize: 13, fixed: true, highlight: false, color: '#17202f' })
              break
          }
        } catch (err) {
          console.warn('[figure] skipped element', el, err)
        }
      })
    })()
    return () => {
      cancelled = true
      try {
        if (board) {
          const JXG = (window as unknown as { JXG?: { JSXGraph: { freeBoard: (b: unknown) => void } } }).JXG
          JXG?.JSXGraph.freeBoard(board)
        }
      } catch { /* ignore */ }
    }
  }, [key, interactive]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      id={`fig-${id}`}
      ref={ref}
      className={`jxgbox w-full overflow-hidden rounded-2xl border border-line bg-white ${className}`}
      style={{ height }}
      role="img"
      aria-label="Figure"
    />
  )
}
