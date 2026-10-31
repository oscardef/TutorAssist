import { NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/auth'
import { aiPolicyFor, aiUsageFor } from '@/lib/ai-access'

/** The caller's AI access and how much of their allowance is used. */
export async function GET() {
  const context = await requireUserContext()
  const policy = await aiPolicyFor(context)
  const usage = policy.enabled ? await aiUsageFor(context) : null
  return NextResponse.json({
    enabled: policy.enabled,
    reason: policy.offReason ?? null,
    unlimited: policy.owner,
    person: policy.person,
    usage: usage?.person ?? null,
  })
}
