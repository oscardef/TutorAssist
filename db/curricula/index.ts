import { IB_DP_MATH } from './ib-dp-math'
import { IB_MYP_PYP } from './ib-myp-pyp'
import type { CurriculumSeed } from './types'

export const CURRICULA: CurriculumSeed[] = [...IB_DP_MATH, ...IB_MYP_PYP]
export { parseOutline } from './types'
