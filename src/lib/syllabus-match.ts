/**
 * Suggest syllabus points for a workspace topic by word overlap between the
 * topic's name and description and each point's title. Deliberately simple
 * and transparent: it only proposes, the tutor decides.
 */

export interface MatchNode { id: string; code: string; title: string; depth: number }

const STOP = new Set(['and', 'the', 'of', 'a', 'an', 'in', 'on', 'to', 'for', 'with', 'their', 'its', 'by', 'from', 'into', 'using', 'use', 'including', 'introduction', 'introduces', 'covers', 'focuses', 'explores', 'basic', 'advanced', 'concepts', 'concept', 'methods', 'techniques', 'understanding', 'such', 'as', 'both', 'various', 'types', 'real', 'world', 'ib', 'aahl', 'aasl', 'hl', 'sl', 'level', 'topics', 'topic', 'problem', 'problems', 'solving', 'applications', 'application', 'focus', 'different', 'contexts', 'calculation'])

// Map variants onto one stem so "derivatives", "differentiation" and "differentiating" meet
const SYNONYMS: [RegExp, string][] = [
  [/^(differentiat\w*|derivative\w*)$/, 'differentiate'],
  [/^(integrat\w*|integral\w*|antidifferentiat\w*)$/, 'integrate'],
  [/^(trig|trigonometr\w*)$/, 'trigonometry'],
  [/^(stats|statistic\w*)$/, 'statistics'],
  [/^(probabilit\w*)$/, 'probability'],
  [/^(quadratic\w*)$/, 'quadratic'],
  [/^(logs?|logarithm\w*)$/, 'logarithm'],
  [/^(exponent\w*|powers?|indices|index)$/, 'exponent'],
  [/^(surds?|radicals?)$/, 'surd'],
  [/^(sequence\w*|patterns?)$/, 'sequence'],
  [/^(series)$/, 'series'],
  [/^(vectors?)$/, 'vector'],
  [/^(functions?)$/, 'function'],
  [/^(graphs?|graphing|sketch\w*)$/, 'graph'],
  [/^(equations?)$/, 'equation'],
  [/^(inequalit\w*)$/, 'inequality'],
  [/^(solids?|3d|volumes?|surface)$/, 'solid'],
  [/^(bearings?|navigation)$/, 'bearing'],
  [/^(mean|median|mode|average\w*|central|tendency)$/, 'central'],
  [/^(dispersion|spread|range|interquartile|variance|deviation)$/, 'dispersion'],
  [/^(binomial\w*)$/, 'binomial'],
  [/^(normal)$/, 'normal'],
  [/^(optimi[sz]\w*|maxim\w*|minim\w*)$/, 'optimise'],
  [/^(kinematic\w*|velocity|acceleration|displacement)$/, 'kinematics'],
  [/^(linear|straight|lines?|gradients?|slopes?)$/, 'line'],
  [/^(complex)$/, 'complex'],
  [/^(matri\w*)$/, 'matrix'],
  [/^(proofs?|prove|induction)$/, 'proof'],
  [/^(chain|product|quotient)$/, 'rule'],
  [/^(substitution)$/, 'substitution'],
  [/^(parts)$/, 'parts'],
  [/^(implicit\w*)$/, 'implicit'],
  [/^(areas?)$/, 'area'],
  [/^(circles?|arcs?|sectors?|radians?)$/, 'circle'],
  [/^(triangles?|sine|cosine|right-angled|angled)$/, 'triangle'],
  [/^(correlation|regression|bivariate|scatter)$/, 'correlation'],
]

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9-]+/)
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(w => SYNONYMS.find(([re]) => re.test(w))?.[1] ?? w.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1'))
}

export function suggestNodes(name: string, description: string | null | undefined, nodes: MatchNode[], limit = 3) {
  const nameTokens = new Set(tokens(name))
  const descTokens = new Set(tokens(description || ''))
  if (nameTokens.size === 0 && descTokens.size === 0) return []
  return nodes
    .filter(n => n.depth > 0)
    .map(n => {
      const t = new Set(tokens(n.title))
      let score = 0
      for (const w of t) {
        if (nameTokens.has(w)) score += 3
        else if (descTokens.has(w)) score += 1
      }
      // Prefer short, specific titles when scores tie
      return { node: n, score: score / Math.sqrt(t.size || 1) }
    })
    .filter(x => x.score >= 1.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
