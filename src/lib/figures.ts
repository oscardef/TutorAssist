/**
 * Figure specification attached to a question. Deliberately small and
 * declarative so it can be authored by hand, produced by the AI generator,
 * rendered interactively in the browser (JSXGraph) and, later, rasterised to
 * SVG for PDF worksheets.
 */
export type FigureElement =
  | { kind: 'function'; expr: string; color?: string; label?: string; domain?: [number, number] }
  | { kind: 'point'; x: number; y: number; label?: string; color?: string }
  | { kind: 'segment'; from: [number, number]; to: [number, number]; color?: string; label?: string }
  | { kind: 'line'; from: [number, number]; to: [number, number]; color?: string; dashed?: boolean }
  | { kind: 'circle'; center: [number, number]; radius: number; color?: string; label?: string }
  | { kind: 'polygon'; points: [number, number][]; color?: string; label?: string }
  | { kind: 'text'; x: number; y: number; text: string }
  | { kind: 'vector'; from: [number, number]; to: [number, number]; color?: string; label?: string }

export interface FigureSpec {
  type: 'graph'
  /** Visible x range, e.g. [-5, 5] */
  xRange: [number, number]
  /** Visible y range, e.g. [-5, 5] */
  yRange: [number, number]
  grid?: boolean
  axes?: boolean
  /** Equal scaling on both axes (geometry); default true */
  keepAspect?: boolean
  elements: FigureElement[]
}

export const FIGURE_COLORS = ['#0f7a77', '#e38d1f', '#d64545', '#2e8b57', '#4b5563']

export function emptyFigure(): FigureSpec {
  return { type: 'graph', xRange: [-5, 5], yRange: [-5, 5], grid: true, axes: true, keepAspect: true, elements: [] }
}

/** Light validation so bad specs from the AI or a tutor never break the renderer. */
export function parseFigure(input: unknown): FigureSpec | null {
  if (!input || typeof input !== 'object') return null
  const f = input as Partial<FigureSpec>
  if (f.type !== 'graph' || !Array.isArray(f.elements)) return null
  const range = (r: unknown, fallback: [number, number]): [number, number] =>
    Array.isArray(r) && r.length === 2 && r.every(n => typeof n === 'number' && Number.isFinite(n)) && r[0] < r[1] ? [r[0], r[1]] : fallback
  const elements = f.elements.filter((e): e is FigureElement => !!e && typeof e === 'object' && typeof (e as FigureElement).kind === 'string').slice(0, 40)
  return {
    type: 'graph',
    xRange: range(f.xRange, [-5, 5]),
    yRange: range(f.yRange, [-5, 5]),
    grid: f.grid !== false,
    axes: f.axes !== false,
    keepAspect: f.keepAspect !== false,
    elements,
  }
}

/** The schema fragment handed to the AI generator. Keep in sync with FigureSpec. */
export const FIGURE_SCHEMA_FOR_PROMPT = `
### Optional "figure" (only when a diagram or graph genuinely helps):
{
  "type": "graph",
  "xRange": [-5, 5], "yRange": [-5, 5],
  "grid": true, "axes": true, "keepAspect": true,
  "elements": [
    {"kind": "function", "expr": "x^2 - 2*x - 3", "label": "f"},      // JavaScript-style expression in x: use ^ for powers, sin(x), sqrt(x), abs(x), exp(x), log(x)
    {"kind": "point", "x": 1, "y": -4, "label": "A"},
    {"kind": "segment", "from": [0, 0], "to": [3, 4], "label": "AB"},
    {"kind": "line", "from": [-5, 1], "to": [5, 1], "dashed": true},
    {"kind": "circle", "center": [0, 0], "radius": 2},
    {"kind": "polygon", "points": [[0,0],[4,0],[4,3]]},
    {"kind": "vector", "from": [0,0], "to": [2,3], "label": "v"},
    {"kind": "text", "x": 2, "y": 4, "text": "y = f(x)"}
  ]
}
Omit "figure" entirely when the question does not need one.`
