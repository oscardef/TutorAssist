/**
 * Plans for students who practise without a tutor (decision 2026-10-31).
 * Students invited by a tutor or school are never limited by these: their
 * access comes from the workspace. Prices are in CHF and are shown on the
 * plan page and the landing page; Stripe holds the real prices (see
 * lib/billing.ts), so keep the two in step.
 */

export type PlanId = 'free' | 'plus'
/** What a student's access comes from: their tutor's workspace, or their own plan. */
export type AccessKind = 'tutor' | PlanId

export interface Entitlement {
  plan: PlanId
  status: string
  source: 'stripe' | 'grant'
  current_period_end: string | null
  cancel_at_period_end: boolean
  billing_interval: 'month' | 'year' | null
  stripe_customer_id: string | null
}

export const FREE_DAILY_QUESTIONS = 20

export const PLUS_PRICES = { month: 9, year: 69 } as const

export interface Features {
  /** Practice questions a day; null is unlimited. Assignments never count. */
  dailyQuestions: number | null
  workedSolutions: boolean
  spacedReview: boolean
  weakAreas: boolean
  chooseQuestions: boolean
  sponsorMessages: boolean
}

const FULL: Features = { dailyQuestions: null, workedSolutions: true, spacedReview: true, weakAreas: true, chooseQuestions: true, sponsorMessages: false }

export const FEATURES: Record<AccessKind, Features> = {
  tutor: FULL,
  plus: FULL,
  free: { dailyQuestions: FREE_DAILY_QUESTIONS, workedSolutions: false, spacedReview: false, weakAreas: false, chooseQuestions: false, sponsorMessages: true },
}

/** Shown on the plan and landing pages, in this order. */
export const PLAN_COPY: Record<PlanId, { name: string; summary: string; includes: string[] }> = {
  free: {
    name: 'Free',
    summary: 'Practise your course a little every day.',
    includes: [
      `${FREE_DAILY_QUESTIONS} practice questions a day`,
      'Every topic in your course',
      'Hints and instant marking',
      'Progress, streaks and daily goal',
      'A small sponsor message, never during a question',
    ],
  },
  plus: {
    name: 'Plus',
    summary: 'Everything, as much as you like.',
    includes: [
      'Unlimited practice',
      'Step-by-step worked solutions',
      'Spaced review of what you got wrong',
      'Practice that targets your weak topics',
      'Pick your own questions',
      'No sponsor messages',
    ],
  },
}

const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

/** The plan an entitlement row gives right now. A lapsed or missing row is Free. */
export function planFromEntitlement(e: Pick<Entitlement, 'plan' | 'status' | 'current_period_end'> | null, now = new Date()): PlanId {
  if (!e || e.plan !== 'plus') return 'free'
  if (!LIVE_STATUSES.has(e.status)) return 'free'
  if (e.current_period_end && new Date(e.current_period_end).getTime() < now.getTime()) return 'free'
  return 'plus'
}

/** Free students see hints and the answer; worked solutions and markschemes come with Plus. */
export function withoutSolutions<T extends Record<string, unknown>>(questions: T[] | null): T[] | null {
  return questions?.map(q => ({
    ...q,
    has_worked_solution: Array.isArray(q.solution_steps_json) && q.solution_steps_json.length > 0,
    solution_steps_json: null,
    parts_json: Array.isArray(q.parts_json) ? (q.parts_json as Record<string, unknown>[]).map(({ markscheme: _m, ...part }) => { void _m; return part }) : q.parts_json,
  })) ?? null
}
