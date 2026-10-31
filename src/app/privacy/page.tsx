import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, Section, legalContact } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Mathium collects, why, who processes it, how long it is kept, and your rights.',
}

const UPDATED = '31 Oct 2026'

/**
 * Plain-language privacy policy. Keep it true to what the code does: update
 * it whenever a new kind of data, cookie or processor is added.
 */
export default function PrivacyPage() {
  const contact = legalContact()
  return (
    <LegalPage title="Privacy policy" updated={UPDATED}>
          <Section title="In short">
            <ul>
              <li>We collect what Mathium needs to work: your account, your learning and tutoring activity, and the files and boards you create.</li>
              <li>We don&apos;t sell data or use tracking or analytics cookies. Students on the Free plan see short sponsor messages that we choose ourselves; they are not personalised and nobody is tracked.</li>
              <li>Mathium runs on our own server in Switzerland. A few services help us run it (AI, Google, email, payments); they are listed below.</li>
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
              <dt>Practising on your own</dt>
              <dd>Your course and year, whether you are 16 or older and, if not, your parent or guardian&apos;s email address and when they agreed.</dd>
              <dt>Plan and payments</dt>
              <dd>Your plan (Free or Plus), its status and renewal date, and the reference numbers Stripe gives the customer and subscription. Card details go straight to Stripe; we never see or store them.</dd>
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
              <li>To ask a parent or guardian to agree before a student under 16 starts on their own, and to keep a record that they did (legal obligation and legitimate interest).</li>
              <li>To run the Plus plan: take payments through Stripe, switch features on and off, and keep the records accounting law requires (performance of our agreement, legal obligation).</li>
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
              <dt>Stripe</dt>
              <dd>Stripe takes payments for Plus on its own checkout and billing pages. It receives the email address and payment details entered there and handles them under its own privacy policy. It tells us whether a subscription is active and when it renews.</dd>
            </dl>
            <p>Some of these providers are in the United States. Transfers rely on the safeguards the law requires, such as the EU Standard Contractual Clauses and the Swiss–US and EU–US data privacy frameworks.</p>
          </Section>

          <Section title="Cookies">
            <p>We use two cookies, both needed for Mathium to work: a sign-in cookie that keeps you logged in, and a <code>tz</code> cookie with your time zone so times are shown correctly. No advertising, analytics or third-party tracking cookies. Stripe&apos;s checkout and billing pages are on Stripe&apos;s own website and use Stripe&apos;s cookies there.</p>
          </Section>

          <Section title="Sponsor messages">
            <p>Students on the Free plan see one short text message from a sponsor on some pages, never during a question. We choose the sponsors ourselves and only accept ones suitable for children. The messages are plain text served by Mathium: no images, scripts or cookies from the sponsor, and nothing is chosen based on who you are. We count how often each message is shown and clicked in total, never per person, and sponsors receive no data about you. A click opens the sponsor&apos;s website in a new tab, where its own privacy policy applies.</p>
          </Section>

          <Section title="How long we keep it">
            <ul>
              <li>Account and learning data: while your account exists. Deleting your account (Settings → Your data) removes it straight away, and from backups within 14 days.</li>
              <li>Accounts not used for 24 months are deleted. We email you 30 days before, and signing in keeps your account.</li>
              <li>Session rooms and files: as long as the session or question they belong to exists.</li>
              <li>A parent or guardian&apos;s agreement: as long as the student&apos;s account exists.</li>
              <li>Payments: deleting your account cancels Plus. Payment records and invoices stay in our Stripe account for as long as Swiss accounting law requires (up to 10 years).</li>
              <li>Questions and other teaching material you create stay on Mathium after you leave, without your name, so the students and tutors using them keep them. They may be offered to others through the shared library after review.</li>
            </ul>
          </Section>

          <Section title="Children">
            <p>Many Mathium students are under 18. If you are under 16, a parent or guardian must agree before you use Mathium. Tutors and schools inviting younger students are responsible for getting that agreement. Students who sign up on their own are asked whether they are 16 or older; if not, we email the parent or guardian they name, and the student can start only once that person agrees. Paying for Plus is for a parent or guardian to decide. Parents and guardians can contact us at any time to see, export or delete their child&apos;s data.</p>
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
          <Section title="Terms">
            <p>How you may use Mathium, and what we may do with questions you create, is in our <Link href="/terms">terms of use</Link>.</p>
          </Section>
    </LegalPage>
  )
}
