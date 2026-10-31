import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Stripe Checkout and Customer Portal for the Plus plan. Billing is on only
 * when all four variables are set (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 * STRIPE_PRICE_PLUS_MONTH, STRIPE_PRICE_PLUS_YEAR); until then the plan page
 * says Plus isn't on sale yet and a platform owner can still grant it.
 * The webhook (/api/billing/webhook) is the only writer of Stripe-sourced
 * rows in public.entitlements.
 */

export type Interval = 'month' | 'year'

export function billingEnabled(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_PLUS_MONTH && process.env.STRIPE_PRICE_PLUS_YEAR)
}

let client: Stripe | null = null
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Billing is not configured')
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY)
  return client
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const priceFor = (interval: Interval) => (interval === 'year' ? process.env.STRIPE_PRICE_PLUS_YEAR : process.env.STRIPE_PRICE_PLUS_MONTH) as string

export async function createCheckout(params: { userId: string; email: string; interval: Interval; customerId: string | null }): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceFor(params.interval), quantity: 1 }],
    ...(params.customerId ? { customer: params.customerId } : { customer_email: params.email }),
    client_reference_id: params.userId,
    metadata: { userId: params.userId },
    subscription_data: { metadata: { userId: params.userId } },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/student/plan?upgraded=1`,
    cancel_url: `${appUrl()}/student/plan`,
  })
  if (!session.url) throw new Error('Stripe did not return a checkout page')
  return session.url
}

export async function createPortal(customerId: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl()}/student/plan` })
  return session.url
}

const STATUS: Record<Stripe.Subscription.Status, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  unpaid: 'unpaid',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete',
  paused: 'canceled',
}

/** The entitlement row a subscription gives. Exported for tests. */
export function entitlementFromSubscription(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0]
  // Recent API versions keep the period on the item; older ones on the subscription
  const periodEnd = (item as unknown as { current_period_end?: number } | undefined)?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end
    ?? null
  return {
    plan: 'plus' as const,
    status: STATUS[sub.status] ?? 'incomplete',
    source: 'stripe' as const,
    billing_interval: (item?.price?.recurring?.interval === 'year' ? 'year' : 'month') as Interval,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
  }
}

async function saveSubscription(sub: Stripe.Subscription, userIdHint?: string | null) {
  const admin = await createAdminClient()
  let userId = sub.metadata?.userId || userIdHint || null
  if (!userId) {
    const { data } = await admin.from('entitlements').select('user_id').eq('stripe_subscription_id', sub.id).maybeSingle()
    userId = (data?.user_id as string | undefined) ?? null
  }
  if (!userId) {
    console.error('[billing] subscription without a user', sub.id)
    return
  }
  const { error } = await admin
    .from('entitlements')
    .upsert({ user_id: userId, ...entitlementFromSubscription(sub), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

export function verifyWebhook(payload: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET as string)
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription' || !session.subscription) return
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      const sub = await stripe().subscriptions.retrieve(subId)
      await saveSubscription(sub, session.client_reference_id)
      return
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await saveSubscription(event.data.object as Stripe.Subscription)
      return
    default:
      return
  }
}

/** Stops billing when an account is deleted, so nobody pays for a closed account. */
export async function cancelSubscriptionFor(userId: string) {
  if (!process.env.STRIPE_SECRET_KEY) return
  const admin = await createAdminClient()
  const { data } = await admin.from('entitlements').select('stripe_subscription_id, status').eq('user_id', userId).maybeSingle()
  const subId = data?.stripe_subscription_id as string | undefined
  if (!subId || data?.status === 'canceled') return
  await stripe().subscriptions.cancel(subId)
}
