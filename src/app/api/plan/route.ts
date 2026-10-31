import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { userTimeZone } from '@/lib/tz'
import { practiceAllowance, studentAccess } from '@/lib/student-plan'
import { billingEnabled } from '@/lib/billing'

/** The signed-in student's plan, features and what is left of today's practice. */
export async function GET() {
  const context = await getUserContext()
  if (!context || context.role !== 'student') return NextResponse.json({ kind: 'tutor', solo: false, features: null, allowance: null })
  const access = await studentAccess(context.userId, context.workspaceId)
  const allowance = await practiceAllowance(access, context.userId, context.workspaceId, await userTimeZone())
  return NextResponse.json({ kind: access.kind, solo: access.solo, features: access.features, allowance, billingEnabled: billingEnabled() }, { headers: { 'Cache-Control': 'no-store' } })
}
