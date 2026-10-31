import { redirect } from 'next/navigation'
import { requireUserContext } from '@/lib/auth'
import { userTimeZone } from '@/lib/tz'
import { formatDate } from '@/lib/dates'
import { practiceAllowance, studentAccess } from '@/lib/student-plan'
import { billingEnabled } from '@/lib/billing'
import { PLAN_COPY, PLUS_PRICES } from '@/lib/plans'
import { Icons } from '@/components/ui/icons'
import { PlanActions } from './PlanActions'

export const metadata = { title: 'Your plan' }

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const context = await requireUserContext()
  const access = await studentAccess(context.userId, context.workspaceId)
  if (!access.solo) redirect('/student/dashboard')
  const tz = await userTimeZone()
  const allowance = await practiceAllowance(access, context.userId, context.workspaceId, tz)
  const { upgraded } = await searchParams
  const e = access.entitlement
  const plus = access.plan === 'plus'
  const saving = Math.round((1 - PLUS_PRICES.year / (PLUS_PRICES.month * 12)) * 100)

  let status: string
  if (!plus) status = allowance.left === 0 ? `You've used today's ${allowance.limit} questions. More tomorrow.` : `${allowance.left} of ${allowance.limit} questions left today.`
  else if (e?.source === 'grant') status = 'Plus was given to you by Mathium.'
  else if (e?.cancel_at_period_end && e.current_period_end) status = `Plus ends on ${formatDate(e.current_period_end, { tz })}. You won't be charged again.`
  else if (e?.current_period_end) status = `Plus renews on ${formatDate(e.current_period_end, { tz })}, ${e.billing_interval === 'year' ? 'yearly' : 'monthly'}.`
  else status = 'You have Plus.'

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="page-title">Your plan</h1>
        <p className="page-subtitle">{status}</p>
      </div>

      {upgraded && plus && <div className="alert-success" role="status">Welcome to Plus. Everything is unlocked.</div>}
      {upgraded && !plus && <div className="alert-success" role="status">Payment received. Plus switches on in a moment; reload the page if it hasn&apos;t yet.</div>}

      <div className="grid gap-5 md:grid-cols-2">
        {(['free', 'plus'] as const).map(id => {
          const copy = PLAN_COPY[id]
          const mine = access.plan === id
          return (
            <section key={id} aria-labelledby={`plan-${id}`} className={`card relative flex flex-col p-6 ${id === 'plus' ? 'border-ink' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`plan-${id}`} className="card-title text-2xl">{copy.name}</h2>
                {mine && <span className="chip chip-good">Your plan</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">{copy.summary}</p>
              <p className="mt-5">
                {id === 'free' ? (
                  <span className="numeral text-4xl text-ink">CHF 0</span>
                ) : (
                  <>
                    <span className="numeral text-4xl text-ink">CHF {PLUS_PRICES.month}</span>
                    <span className="text-sm text-gray-600"> a month, or CHF {PLUS_PRICES.year} a year (save {saving}%)</span>
                  </>
                )}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-gray-700">
                {copy.includes.map(item => (
                  <li key={item} className="flex gap-2.5">
                    <Icons.check className={`mt-0.5 h-4 w-4 shrink-0 ${id === 'plus' ? 'text-brand-600' : 'text-gray-400'}`} />
                    {item}
                  </li>
                ))}
              </ul>
              {id === 'plus' && (
                <div className="mt-6">
                  <PlanActions plus={plus} billing={billingEnabled()} canManage={!!e?.stripe_customer_id && e.source === 'stripe'} />
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="text-sm leading-relaxed text-gray-600">
        <p>Under 18? Ask a parent or guardian before paying. Payments are handled by Stripe; Mathium never sees card details. Plus can be cancelled any time and runs until the end of the period already paid.</p>
      </div>
    </div>
  )
}
