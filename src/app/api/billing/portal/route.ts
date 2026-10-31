import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { billingEnabled, createPortal } from '@/lib/billing'
import { getEntitlement } from '@/lib/student-plan'

/** Stripe's page for changing card, switching monthly or yearly, or cancelling. */
export async function POST() {
  const context = await getUserContext()
  if (!context) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!billingEnabled()) return NextResponse.json({ error: 'Billing is not available.' }, { status: 503 })
  const entitlement = await getEntitlement(context.userId)
  if (!entitlement?.stripe_customer_id) return NextResponse.json({ error: 'There is no subscription to manage.' }, { status: 404 })
  try {
    return NextResponse.json({ url: await createPortal(entitlement.stripe_customer_id) })
  } catch (err) {
    console.error('[billing] portal failed', err)
    return NextResponse.json({ error: 'Could not open the billing page. Try again in a moment.' }, { status: 502 })
  }
}
