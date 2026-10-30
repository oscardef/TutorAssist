import type { Metadata } from 'next'
import Link from 'next/link'
import { LogoMark } from '@/components/ui/brand'

export const metadata: Metadata = {
  title: 'Privacy policy · Mathium',
  description: 'What Mathium collects, why, who processes it, how long it is kept, and your rights.',
}

const UPDATED = '30 Oct 2026'

/**
 * Plain-language privacy policy. Keep it true to what the code does: update
 * it whenever a new kind of data, cookie or processor is added.
 */
export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL || 'privacy@mathium.app'
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-ink"><LogoMark size={32} /> Mathium</Link>
        <Link href="/login" className="btn btn-secondary btn-sm">Sign in</Link>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-5 pb-20 pt-6 sm:px-8">
        <h1 className="text-[2rem] font-extrabold leading-tight text-ink sm:text-[2.5rem]">Privacy policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated {UPDATED}</p>

        <div className="prose-policy mt-8 space-y-8 text-[15px] leading-relaxed text-gray-700">
          <Section title="In short">
            <ul>
              <li>We collect what Mathium needs to work: your account, your learning and tutoring activity, and the files and boards you create.</li>
              <li>We don&apos;t sell data, show ads or use tracking or analytics cookies.</li>
              <li>Mathium runs on our own server in Switzerland. A few services help us run it (AI, Google, email); they are listed below.</li>
              <li>You can download your data or delete your account yourself in Settings, or write to <a href={`mailto:${contact}`}>{contact}</a>.</li>
            </ul>
          </Section>

          <Section title="Who is responsible">
            <p>Mathium is run by Oscar de Francesca, Basel, Switzerland, who is the controller of the personal data described here. Contact: <a href={`mailto:${contact}`}>{contact}</a>.</p>
            <p>When a school or tutoring organisation uses Mathium for its students, it decides which students to invite and what they work on; for that use we process data on its behalf.</p>
          </Section>

          <Section title="What we collect">
            <dl>
              <dt>Account</dt>
              <dd>Name, email address and a securely hashed password. If you sign in with Google: your Google account&apos;s name, email address and profile picture.</dd>
              <dt>Learning and tutoring</dt>
              <dd>Your answers, scores, progress, practice history and review schedule; assignments; questions you write or flag; booked and past sessions; notes your tutor shares with you. Tutors&apos; private notes are visible only to tutors.</dd>
              <dt>Session rooms</dt>
              <dd>What is drawn, written or pasted on a session&apos;s whiteboard, including images, saved with that session.</dd>
              <dt>Files</dt>
              <dd>Images and materials that tutors upload.</dd>
              <dt>Calendar</dt>
              <dd>If a tutor connects Google Calendar: access tokens to create session events and read busy times. We don&apos;t store the contents of their calendar.</dd>
              <dt>Technical data</dt>
              <dd>For sign-in sessions and security: IP address, browser type and the time of requests. With answers we store the browser type. Server access logs are kept only for a limited time, for security.</dd>
            </dl>
          </Section>

          <Section title="Why we use it">
            <ul>
              <li>To provide Mathium: accounts, practice, assignments, grading, progress, session rooms and booking (performance of our agreement with you).</li>
              <li>To keep Mathium secure and working, and to prevent abuse (legitimate interest).</li>
              <li>To send emails you need, such as password resets, booking confirmations and new assignments (performance of our agreement).</li>
              <li>To improve questions: answers are used in aggregate to adjust question difficulty and find mistakes in questions (legitimate interest).</li>
            </ul>
          </Section>

          <Section title="Who helps us process it">
            <dl>
              <dt>AI providers (currently OpenAI)</dt>
              <dd>
                When a tutor uses AI features (generating questions or assignments, reading uploaded material, reviewing flagged questions), what that task needs is sent to the provider: topics, question content, uploaded material, flag comments and the tutor&apos;s own request. To help tutors personalise practice, a summary of a student&apos;s results (accuracy and weaker topics) can be included. We do this to support teaching (legitimate interest), we never send students&apos; names or email addresses, and these providers do not use the data to train their models. A school or tutor can switch the results summary off for their workspace in Settings, and students or their parents can object by writing to us; we then stop for that student.
              </dd>
              <dt>Google</dt>
              <dd>Sign-in with Google, and Google Calendar and Meet links for tutors who connect their calendar.</dd>
              <dt>Email</dt>
              <dd>Our email provider delivers the emails described above.</dd>
            </dl>
            <p>Some of these providers are in the United States. Transfers rely on the safeguards the law requires, such as the EU Standard Contractual Clauses and the Swiss–US and EU–US data privacy frameworks.</p>
          </Section>

          <Section title="Cookies">
            <p>We use two cookies, both needed for Mathium to work: a sign-in cookie that keeps you logged in, and a <code>tz</code> cookie with your time zone so times are shown correctly. No advertising, analytics or third-party tracking cookies.</p>
          </Section>

          <Section title="How long we keep it">
            <ul>
              <li>Account and learning data: while your account exists. Deleting your account (Settings → Your data) removes it straight away, and from backups within 14 days.</li>
              <li>Accounts not used for 24 months are deleted. We email you 30 days before, and signing in keeps your account.</li>
              <li>Session rooms and files: as long as the session or question they belong to exists.</li>
              <li>Questions and other teaching material you create stay on Mathium after you leave, without your name, so the students and tutors using them keep them. They may be offered to others through the shared library after review.</li>
            </ul>
          </Section>

          <Section title="Children">
            <p>Many Mathium students are under 18. Students usually join through an invitation from their tutor or school. If you are under 16, a parent or guardian must agree before you use Mathium; tutors and schools inviting younger students are responsible for getting that agreement. Parents and guardians can contact us at any time to see, export or delete their child&apos;s data.</p>
          </Section>

          <Section title="Your rights">
            <p>Under the Swiss Federal Act on Data Protection and, where it applies, the EU General Data Protection Regulation, you can access, correct, export or delete your data, object to or restrict how we use it, and withdraw consent you have given. You can download your data and delete your account yourself in Settings → Your data; for anything else write to <a href={`mailto:${contact}`}>{contact}</a> and we answer within 30 days. You can also complain to the Swiss Federal Data Protection and Information Commissioner (FDPIC) or your local data protection authority.</p>
          </Section>

          <Section title="Security">
            <p>Data is sent over encrypted connections, passwords are hashed, each school or tutor&apos;s data is separated at the database level, and access is limited to what each person needs. No system is perfectly secure. If a breach puts your data at risk, we tell you and the data protection authorities within 72 hours of finding it.</p>
          </Section>

          <Section title="Changes">
            <p>When we change this policy we update the date above, and tell you on Mathium or by email if the change matters for you.</p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-gray-500 sm:px-8">
          <span className="inline-flex items-center gap-2"><LogoMark size={22} /> Mathium</span>
          <span>Not affiliated with or endorsed by the International Baccalaureate.</span>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  )
}
