import Link from 'next/link'
import { AuthShell, AuthHeading } from '@/components/ui/auth-shell'
import { findConsent } from '@/lib/consent'
import { getUserById } from '@/lib/users'
import { FREE_DAILY_QUESTIONS } from '@/lib/plans'
import { ConfirmButton } from './ConfirmButton'
import { legalContact } from '@/components/legal-page'

export const metadata = { title: 'Confirm for your child', robots: { index: false } }

export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const consent = token.length <= 100 ? await findConsent(token) : null
  const child = consent ? await getUserById(consent.student_user_id) : null

  if (!consent || !child) {
    return (
      <AuthShell>
        <AuthHeading title="This link doesn't work" subtitle="It may have been replaced by a newer email. Ask your child to send it again from Mathium." />
        <Link href="/" className="btn btn-secondary">Go to Mathium</Link>
      </AuthShell>
    )
  }
  const first = (child.name || '').split(' ')[0] || 'Your child'
  if (consent.confirmed_at) {
    return (
      <AuthShell>
        <AuthHeading title="All set" subtitle={`${first} can start practising. Thank you.`} />
        <Link href="/" className="btn btn-secondary">Go to Mathium</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeading title={`Can ${first} use Mathium?`} subtitle={<>{first} signed up with <strong className="text-ink">{child.email}</strong> to practise school maths on their own.</>} />
      <div className="card space-y-3 p-5 text-sm leading-relaxed text-gray-700">
        <p><strong className="text-ink">What they get for free:</strong> {FREE_DAILY_QUESTIONS} practice questions a day from their course, instant marking, hints and progress.</p>
        <p><strong className="text-ink">Sponsor messages:</strong> the Free plan shows one small text message from a sponsor we choose ourselves, never during a question. There is no tracking and nothing is personalised.</p>
        <p><strong className="text-ink">Paying:</strong> nothing is charged unless someone chooses Plus and pays at checkout. Plus can be cancelled any time.</p>
        <p><strong className="text-ink">Data:</strong> we keep their name, email and practice results to run the service. You can ask us to see, export or delete it at any time. <Link href="/privacy" className="font-semibold text-brand-700 hover:underline">Privacy policy</Link>, <Link href="/terms" className="font-semibold text-brand-700 hover:underline">terms</Link>.</p>
      </div>
      <ConfirmButton token={token} name={first} />
      <p className="mt-6 text-xs text-gray-500">If you don&apos;t agree, close this page. The account stays locked, and you can write to <a href={`mailto:${legalContact()}`} className="font-semibold text-brand-700 hover:underline">{legalContact()}</a> to have it deleted.</p>
    </AuthShell>
  )
}
