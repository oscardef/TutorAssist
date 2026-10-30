import { suggestNodes, tokens } from '@/lib/syllabus-match'
import { parseOutline } from '../../db/curricula/types'
import { IB_DP_MATH } from '../../db/curricula/ib-dp-math'

const aa = parseOutline(IB_DP_MATH[0].outline).map(n => ({ id: n.code, code: n.code, title: n.title, depth: n.depth }))

describe('syllabus outlines', () => {
  it('parse with unique codes and parents', () => {
    for (const c of IB_DP_MATH) {
      const nodes = parseOutline(c.outline)
      expect(new Set(nodes.map(n => n.code)).size).toBe(nodes.length)
      expect(nodes.filter(n => n.depth === 1).every(n => n.parentCode && n.level)).toBe(true)
    }
  })
})

describe('suggestNodes', () => {
  it('normalises word variants', () => {
    expect(tokens('Differentiation and derivatives')).toEqual(['differentiate', 'differentiate'])
  })
  it.each([
    ['Quadratic Functions', 'SL2.6'],
    ['Sequences', 'SL1.2'],
    ['Integration Techniques', 'AHL5.16'],
    ['Bearings', 'SL3.3'],
  ])('suggests %s -> %s first', (name, code) => {
    expect(suggestNodes(name, '', aa)[0]?.node.code).toBe(code)
  })
  it('suggests nothing for an empty name', () => {
    expect(suggestNodes('', '', aa)).toEqual([])
  })
})
