import { createAdminClient } from '@/lib/supabase/server'
import { zoned } from '@/lib/tz'
import { FEATURES, planFromEntitlement, type AccessKind, type Entitlement, type Features, type PlanId } from '@/lib/plans'

/**
 * Server-side plan checks for students. Feature gates read this, never
 * Stripe: the billing webhook keeps public.entitlements up to date.
 */

export interface StudentAccess {
  kind: AccessKind
  /** True when the student practises on their own, without a tutor. */
  solo: boolean
  plan: PlanId | null
  features: Features
  entitlement: Entitlement | null
}

export async function isSoloWorkspace(workspaceId: string): Promise<boolean> {
  const admin = await createAdminClient()
  const { data } = await admin.from('workspaces').select('kind').eq('id', workspaceId).maybeSingle()
  return data?.kind === 'solo'
}

export async function getEntitlement(userId: string): Promise<Entitlement | null> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from('entitlements')
    .select('plan, status, source, current_period_end, cancel_at_period_end, billing_interval, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as Entitlement | null) ?? null
}

export async function studentAccess(userId: string, workspaceId: string): Promise<StudentAccess> {
  if (!(await isSoloWorkspace(workspaceId))) {
    return { kind: 'tutor', solo: false, plan: null, features: FEATURES.tutor, entitlement: null }
  }
  const entitlement = await getEntitlement(userId)
  const plan = planFromEntitlement(entitlement)
  return { kind: plan, solo: true, plan, features: FEATURES[plan], entitlement }
}

/**
 * Different practice questions answered today in the student's time zone.
 * Assignments don't count, and trying the same question again is free.
 */
export async function practiceQuestionsToday(userId: string, workspaceId: string, tz: string): Promise<Set<string>> {
  const admin = await createAdminClient()
  const since = new Date(Date.now() - 26 * 3600_000).toISOString()
  const { data } = await admin
    .from('attempts')
    .select('question_id, submitted_at')
    .eq('student_user_id', userId)
    .eq('workspace_id', workspaceId)
    .is('assignment_id', null)
    .gte('submitted_at', since)
    .limit(2000)
  const { isToday } = zoned(tz)
  return new Set((data ?? []).filter(a => a.submitted_at && isToday(a.submitted_at)).map(a => a.question_id as string))
}

/** Null when the student may answer this practice question now; otherwise why not. */
export async function dailyLimitHit(userId: string, workspaceId: string, questionId: string, tz: string): Promise<{ limit: number } | null> {
  const access = await studentAccess(userId, workspaceId)
  const limit = access.features.dailyQuestions
  if (limit === null) return null
  const today = await practiceQuestionsToday(userId, workspaceId, tz)
  return today.has(questionId) || today.size < limit ? null : { limit }
}

export interface Allowance {
  limit: number | null
  used: number
  left: number | null
}

export async function practiceAllowance(access: StudentAccess, userId: string, workspaceId: string, tz: string): Promise<Allowance> {
  const limit = access.features.dailyQuestions
  if (limit === null) return { limit: null, used: 0, left: null }
  const used = (await practiceQuestionsToday(userId, workspaceId, tz)).size
  return { limit, used, left: Math.max(0, limit - used) }
}

/** Whether a student under 16 is still waiting for a parent to confirm. */
export async function consentPending(userId: string): Promise<{ pending: boolean; parentEmail: string | null }> {
  const admin = await createAdminClient()
  const { data } = await admin.from('parental_consents').select('parent_email, confirmed_at').eq('student_user_id', userId).maybeSingle()
  if (!data) return { pending: false, parentEmail: null }
  return { pending: !data.confirmed_at, parentEmail: data.parent_email as string }
}
