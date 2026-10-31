import { suggestNodes, tokens } from '@/lib/syllabus-match'
import { parseOutline } from '../../db/curricula/types'
import { IB_DP_MATH } from '../../db/curricula/ib-dp-math'
import { CURRICULA } from '../../db/curricula'

const aa = parseOutline(IB_DP_MATH[0].outline).map(n => ({ id: n.code, code: n.code, title: n.title, depth: n.depth }))

describe('syllabus outlines', () => {
  it('cover every IB maths course with unique codes', () => {
    expect(CURRICULA.map(c => c.code).sort()).toEqual(['IBDP-AA-2021', 'IBDP-AA-2029', 'IBDP-AI-2021', 'IBDP-AI-2029', 'IBMYP-MATH-2014', 'IBPYP-MATH-2009'])
    expect(new Set(CURRICULA.map(c => c.code)).size).toBe(CURRICULA.length)
  })

  it('count the points of each course as in the source documents', () => {
    const points = (code: string, level?: string) => parseOutline(CURRICULA.find(c => c.code === code)!.outline).filter(n => n.depth === 1 && (!level || n.level === level)).length
    expect(points('IBDP-AA-2021')).toBe(83)
    expect(points('IBDP-AA-2021', 'AHL')).toBe(32)
    expect(points('IBDP-AI-2021')).toBe(78)
    expect(points('IBDP-AI-2021', 'AHL')).toBe(39)
    expect(points('IBDP-AA-2029', 'AHL')).toBe(4)
    expect(points('IBDP-AI-2029', 'AHL')).toBe(5)
    expect(points('IBMYP-MATH-2014', 'EXT')).toBe(16)
    expect(points('IBPYP-MATH-2009')).toBe(20)
  })

  it('parse with unique codes and parents', () => {
    for (const c of CURRICULA) {
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
