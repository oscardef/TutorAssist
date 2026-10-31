import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { billingEnabled, createCheckout, type Interval } from '@/lib/billing'
import { consentPending, studentAccess } from '@/lib/student-plan'

/** Start a Plus subscription in Stripe Checkout. Solo students only. */
export async function POST(request: Request) {
  const context = await getUserContext()
  if (!context || context.role !== 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!billingEnabled()) return NextResponse.json({ error: "Plus isn't on sale yet." }, { status: 503 })
  const access = await studentAccess(context.userId, context.workspaceId)
  if (!access.solo) return NextResponse.json({ error: 'Your tutor already gives you full access.' }, { status: 409 })
  if (access.plan === 'plus') return NextResponse.json({ error: 'You already have Plus.' }, { status: 409 })
  if ((await consentPending(context.userId)).pending) return NextResponse.json({ error: 'A parent or guardian needs to confirm your account first.' }, { status: 403 })
  const { interval } = await request.json().catch(() => ({})) as { interval?: Interval }
  try {
    const url = await createCheckout({
      userId: context.userId,
      email: context.email,
      interval: interval === 'year' ? 'year' : 'month',
      customerId: access.entitlement?.stripe_customer_id ?? null,
    })
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[billing] checkout failed', err)
    return NextResponse.json({ error: 'Could not open the payment page. Try again in a moment.' }, { status: 502 })
  }
}
