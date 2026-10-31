/** @jest-environment node */
import Stripe from 'stripe'
import { entitlementFromSubscription } from '@/lib/billing'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn() }))

const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  status: 'active',
  customer: 'cus_1',
  cancel_at_period_end: false,
  metadata: { userId: 'u1' },
  items: { data: [{ current_period_end: 1798761600, price: { recurring: { interval: 'year' } } }] },
  ...over,
}) as unknown as Stripe.Subscription

describe('entitlementFromSubscription', () => {
  it('maps an active yearly subscription to Plus', () => {
    expect(entitlementFromSubscription(sub())).toMatchObject({
      plan: 'plus', status: 'active', source: 'stripe', billing_interval: 'year',
      current_period_end: new Date(1798761600 * 1000).toISOString(), stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1',
    })
  })
  it('reads the period from the subscription on older API versions', () => {
    const s = sub({ items: { data: [{ price: { recurring: { interval: 'month' } } }] }, current_period_end: 1798761600 })
    expect(entitlementFromSubscription(s)).toMatchObject({ billing_interval: 'month', current_period_end: new Date(1798761600 * 1000).toISOString() })
  })
  it('treats expired and paused subscriptions as not live', () => {
    expect(entitlementFromSubscription(sub({ status: 'incomplete_expired' })).status).toBe('incomplete')
    expect(entitlementFromSubscription(sub({ status: 'paused' })).status).toBe('canceled')
  })
})

describe('webhook signatures', () => {
  it('accepts a correctly signed payload and rejects a tampered one', () => {
    const s = new Stripe('sk_test_dummy')
    const secret = 'whsec_test'
    const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'customer.subscription.updated', data: { object: {} } })
    const header = s.webhooks.generateTestHeaderString({ payload, secret })
    expect(s.webhooks.constructEvent(payload, header, secret).id).toBe('evt_1')
    expect(() => s.webhooks.constructEvent(payload.replace('evt_1', 'evt_2'), header, secret)).toThrow()
  })
})
