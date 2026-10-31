import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, legalContact } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using Mathium, what you agree to, and what we may do with questions you create.',
}

const UPDATED = '31 Oct 2026'

/**
 * Terms of use (decisions Oscar 2026-10-31): broad licence for content
 * people create, incl. beyond Mathium; Swiss law, no court named; free beta
 * for tutors and invited students; Free and Plus plans for students on their
 * own (2026-10-31); uploads people don't own only for private teaching use.
 * Keep in line with the privacy policy and lib/plans.ts.
 */
export default function TermsPage() {
  const contact = legalContact()
  return (
    <LegalPage title="Terms of use" updated={UPDATED}>
      <Section title="About these terms">
        <p>These terms apply when you use Mathium (mathium.app), which is run by Oscar de Francesca, Basel, Switzerland. By creating an account or using Mathium you agree to them. How we handle personal data is in the <Link href="/privacy">privacy policy</Link>. Questions: <a href={`mailto:${contact}`}>{contact}</a>.</p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>Give accurate details and keep your password to yourself. One account per person; don&apos;t share it.</li>
          <li>If you are under 16, a parent or guardian must agree to you using Mathium. Tutors and schools who invite younger students are responsible for getting that agreement; if you sign up on your own, we ask your parent or guardian by email.</li>
          <li>You can stop using Mathium at any time and delete your account in Settings.</li>
        </ul>
      </Section>

      <Section title="Using Mathium fairly">
        <p>Use Mathium for learning and teaching. Don&apos;t:</p>
        <ul>
          <li>break the law, or harass, threaten or impersonate anyone;</li>
          <li>upload anything harmful, hateful, sexual or that you aren&apos;t allowed to share;</li>
          <li>try to get into accounts or data that aren&apos;t yours, test our security without permission, or disrupt the service;</li>
          <li>copy Mathium&apos;s content in bulk with scripts, or get around usage limits, including the limits on AI features.</li>
        </ul>
        <p>If someone breaks these terms we may remove content or suspend their account, telling them why where we can.</p>
      </Section>

      <Section title="Questions and materials you create">
        <p>You keep the rights to the questions, solutions, hints, figures and other teaching material you write or upload. You give Mathium a free, non-exclusive, worldwide and permanent licence to use, copy, adapt, translate, publish and share that material, on Mathium and elsewhere, for example in the shared question library, on worksheets, in examples showing what Mathium can do, in collections of practice material, and as examples for creating new questions, including with AI. Others on Mathium may use what is shared with them. This licence continues after you delete your account, so the students and tutors using your questions keep them; your name is removed.</p>
        <p>This licence does not cover your personal data, such as your answers, results or progress. Those are handled only as the privacy policy describes.</p>
        <p>Questions you create are proposed for the shared library and reviewed before anything is shared. Only create questions you have the right to share: write your own, adapt freely licensed material, or use material whose licence allows it.</p>
      </Section>

      <Section title="Materials you don't own">
        <p>You may upload worksheets, past papers or textbook pages you don&apos;t own only to teach your own students in your own workspace, and only where you are allowed to use them for that. They are never added to the shared library. You are responsible for having the right to use what you upload. If you believe something on Mathium infringes your rights, write to <a href={`mailto:${contact}`}>{contact}</a> and we will look into it promptly.</p>
      </Section>

      <Section title="AI features">
        <p>Some features use AI to generate or check questions. AI can be wrong: check generated questions and answers before relying on them. You may use what the AI produces for you, under the licence above once it is in Mathium. We may limit, pause or change AI features, for example to keep costs under control.</p>
      </Section>

      <Section title="What Mathium is and isn't">
        <p>Mathium supports learning and teaching; it doesn&apos;t guarantee grades or exam results, and it doesn&apos;t replace a teacher&apos;s judgement. Mathium is independent: it is not affiliated with or endorsed by any exam board, school programme or curriculum provider. Course and syllabus names belong to their owners and are used only to describe what material covers.</p>
      </Section>

      <Section title="Plans and payments">
        <ul>
          <li>Tutors, and students who join through a tutor or school, use Mathium for free while it is in beta. If that changes, we tell you at least 30 days in advance, and nothing is charged unless you choose a paid plan.</li>
          <li>Students practising on their own start on the Free plan. It has a daily number of practice questions and shows sponsor messages. We may change what Free includes.</li>
          <li>Plus is a subscription, monthly or yearly, at the price shown before you pay. It renews automatically until cancelled. You can cancel at any time on the Plan page; Plus then runs until the end of the period already paid, and periods already started are not refunded unless the law requires it.</li>
          <li>If you are under 18, a parent or guardian must agree to the purchase and should be the one who pays.</li>
          <li>Stripe processes payments. We tell subscribers at least 30 days before a price change, and you can cancel before it applies.</li>
          <li>Deleting your account cancels Plus.</li>
        </ul>
      </Section>

      <Section title="Sponsor messages">
        <p>The Free plan shows short messages from sponsors that we choose and check ourselves. A sponsor&apos;s offer and website are its own responsibility, under its own terms.</p>
      </Section>

      <Section title="Availability and changes">
        <p>Mathium is in beta: features may change, and it may sometimes be unavailable. We may change these terms; for changes that matter, we tell you at least 30 days ahead on Mathium or by email. If you keep using Mathium after a change takes effect, the new terms apply; if you don&apos;t agree, you can delete your account.</p>
      </Section>

      <Section title="Liability">
        <p>We work to keep Mathium reliable and your data safe. To the extent the law allows, we are not liable for indirect loss or for damage caused by slight negligence. Nothing in these terms limits liability for intent or gross negligence, or any rights you have as a consumer that cannot be excluded.</p>
      </Section>

      <Section title="Law">
        <p>These terms are governed by Swiss law. If you are a consumer, you also keep the protection of the mandatory laws of the country where you live.</p>
      </Section>
    </LegalPage>
  )
}
