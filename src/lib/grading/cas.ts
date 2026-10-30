import { ComputeEngine } from '@cortex-js/compute-engine'

/**
 * Server-side symbolic answer checking with the Compute Engine (MIT, the
 * engine MathLive uses). Runs after the fast string comparison in
 * math-utils fails, so "-4+6x" matches "6x-4", "(x+1)^2" matches
 * "x^2+2x+1" and "2\sqrt2" matches "\sqrt8". Kept server-only because the
 * engine is large; the browser shows the server's verdict.
 */

export type AnswerForm = 'any' | 'factorised' | 'expanded' | 'exact'

let engine: ComputeEngine | null = null
function ce() {
  if (!engine) engine = new ComputeEngine()
  return engine
}

type Boxed = ReturnType<ComputeEngine['parse']>
type Json = unknown

/** Plain-text answers ("sin(x)", "sqrt(2)", "pi") into TeX the engine reads. */
function toTex(text: string): string {
  return text
    .replace(/(?<![\\a-zA-Z])sqrt\s*\(([^()]*)\)/g, '\\sqrt{$1}')
    .replace(/(?<![\\a-zA-Z])(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log|exp|pi)(?![a-zA-Z])/g, '\\$1')
    .replace(/\*\*/g, '^')
}

function parse(latex: string): Boxed | null {
  const src = toTex(latex.trim())
  if (!src || src.length > 500) return null
  try {
    const e = ce().parse(src)
    return e.isValid ? e : null
  } catch {
    return null
  }
}

function json(e: Boxed): Json {
  return e.json as unknown
}

function op(j: Json): string | null {
  return Array.isArray(j) && typeof j[0] === 'string' ? j[0] : null
}

const FUNCTION_NAMES = /\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|cosec|ln|log|exp|sqrt|pi|lim|max|min)\b/gi

/**
 * Words are not maths: "stop" would parse as s·t·o·p and equal "pots". Only
 * run the engine when, after removing TeX commands and function names, no
 * run of three or more letters is left.
 */
export function looksLikeMath(text: string): boolean {
  const rest = text.replace(/\\[a-zA-Z]+/g, ' ').replace(FUNCTION_NAMES, ' ')
  return !/[a-zA-Z]{3,}/.test(rest)
}

function hasDecimal(latex: string) {
  return /\d\.\d/.test(latex)
}

/** A product (or power) that still has a sum inside, e.g. (x-1)(x+1) or 3(x+2)^2. */
export function isFactorised(e: Boxed): boolean {
  let j: Json = json(e)
  if (op(j) === 'Negate') j = (j as Json[])[1]
  const head = op(j)
  if (head === 'Power') return op((j as Json[])[1]) === 'Add'
  if (head !== 'Multiply') return false
  return (j as Json[]).slice(1).some(f => op(f) === 'Add' || (op(f) === 'Power' && op((f as Json[])[1]) === 'Add'))
}

/** A sum of monomials: no sum left inside a product or an integer power. */
export function isExpanded(e: Boxed): boolean {
  const walk = (j: Json, insideProduct: boolean): boolean => {
    const head = op(j)
    if (!head) return true
    const args = (j as Json[]).slice(1)
    if (head === 'Add' && insideProduct) return false
    if (head === 'Multiply') return args.every(a => walk(a, true))
    if (head === 'Power') {
      const exp = args[1]
      if (op(args[0]) === 'Add' && typeof exp === 'number' && Number.isInteger(exp) && exp >= 2) return false
      return args.every(a => walk(a, insideProduct))
    }
    return args.every(a => walk(a, insideProduct))
  }
  return walk(json(e), false)
}

function numericValue(e: Boxed): number | null {
  try {
    const v = e.N().re
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

/**
 * Compare two expressions by evaluating them at sample points. Used when the
 * engine can't decide symbolically (trig identities, logs). Points avoid 0
 * and 1 and stay positive so ln/sqrt are defined.
 */
function sampleEqual(a: Boxed, b: Boxed, allowSignFlip = false): boolean | undefined {
  const vars = Array.from(new Set([...(a.unknowns || []), ...(b.unknowns || [])]))
  if (vars.length > 3) return undefined
  const points = [0.37, 0.71, 1.43, 1.89, 2.61, 3.17]
  let compared = 0
  let sign = 0
  for (let i = 0; i < points.length; i++) {
    const subs: Record<string, number> = {}
    vars.forEach((v, k) => { subs[v] = points[(i + k * 2) % points.length] + k * 0.13 })
    const va = numericValue(vars.length ? a.subs(subs) : a)
    const vb = numericValue(vars.length ? b.subs(subs) : b)
    if (va === null || vb === null) continue
    compared++
    const scale = Math.max(1, Math.abs(va), Math.abs(vb))
    if (Math.abs(va - vb) <= 1e-7 * scale) { if (sign === -1) return false; sign = sign || 1; continue }
    if (allowSignFlip && Math.abs(va + vb) <= 1e-7 * scale) { if (sign === 1) return false; sign = -1; continue }
    return false
  }
  return compared >= 3 ? true : undefined
}

function equationsEquivalent(a: Boxed, b: Boxed): boolean | undefined {
  const [la, ra] = (json(a) as Json[]).slice(1)
  const [lb, rb] = (json(b) as Json[]).slice(1)
  const da = ce().box(['Subtract', la as never, ra as never])
  const db = ce().box(['Subtract', lb as never, rb as never])
  // x = 2 and 2 = x, or y = 6x - 4 and y - 6x + 4 = 0 (same zero set, up to sign)
  return sampleEqual(da, db, true)
}

/**
 * Are two answers mathematically the same? Returns undefined when the input
 * can't be parsed or the engine can't decide, so callers can fall back.
 */
export function casEquivalent(user: string, correct: string, form: AnswerForm = 'any'): boolean | undefined {
  if (!looksLikeMath(user) || !looksLikeMath(correct)) return undefined
  const a = parse(user)
  const b = parse(correct)
  if (!a || !b) return undefined

  // A variable the answer doesn't have only passes if it cancels out
  // (sin^2 x + cos^2 x for 1); otherwise the answer is wrong.
  const extra = (a.unknowns || []).filter(v => !(b.unknowns || []).includes(v))
  if (extra.length > 0 && op(json(a)) !== 'Equal') return sampleEqual(a, b) === true
  if (extra.length > 0) return false

  if (form === 'exact' && hasDecimal(user) && !hasDecimal(correct)) return false
  if (form === 'factorised' && !isFactorised(a)) return false
  if (form === 'expanded' && !isExpanded(a)) return false

  const aEq = op(json(a)) === 'Equal'
  const bEq = op(json(b)) === 'Equal'
  if (aEq !== bEq) return false
  if (aEq && bEq) return equationsEquivalent(a, b)

  let symbolic: boolean | undefined
  try {
    symbolic = a.isEqual(b)
  } catch {
    symbolic = undefined
  }
  if (symbolic === true) return true
  return sampleEqual(a, b) ?? symbolic
}

/** True if any of the accepted answers is equivalent. */
export function casMatchesAny(user: string, accepted: string[], form: AnswerForm = 'any'): boolean {
  return accepted.some(c => c && casEquivalent(user, c, form) === true)
}
