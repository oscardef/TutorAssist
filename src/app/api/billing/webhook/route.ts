import { NextResponse } from 'next/server'
import { billingEnabled, handleStripeEvent, verifyWebhook } from '@/lib/billing'

/** Stripe events: the only writer of Stripe-sourced entitlements. */
export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  const payload = await request.text()
  let event
  try {
    event = verifyWebhook(payload, signature)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  try {
    await handleStripeEvent(event)
  } catch (err) {
    // A 500 makes Stripe retry the event later
    console.error('[billing] could not handle', event.type, event.id, err)
    return NextResponse.json({ error: 'Could not handle event' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
