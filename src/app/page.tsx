import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getUserWorkspaceMembership } from '@/lib/workspace'
import { LogoMark } from '@/components/ui/brand'
import { Icons } from '@/components/ui/icons'

export default async function HomePage() {
  const user = await getUser()
  if (user) {
    const membership = await getUserWorkspaceMembership(user.id)
    if (!membership) redirect('/onboarding')
    redirect(membership.membership.role === 'tutor' ? '/tutor/dashboard' : '/student/dashboard')
  }

  const Check = Icons.check

  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Mathium home">
          <LogoMark size={36} />
          <span className="text-xl font-extrabold tracking-tight text-ink">Mathium</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-primary">Get started</Link>
        </nav>
      </header>

      <main id="main">
        {/* Hero: a worked question on graph paper is the most characteristic thing about the product */}
        <section className="bg-graph-fade">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
            <div className="animate-rise">
              <h1 className="text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[3.5rem]">
                Maths practice that matches the syllabus.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
                Every question is tagged to the exact topic you are studying, checked the moment you answer, and brought back
                for review before it fades. Tutors get the tools to run it: assignments, sessions, progress and a question bank
                that writes itself.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="btn btn-primary btn-lg">Start practising free</Link>
                <Link href="/login" className="btn btn-secondary btn-lg">I have an invite</Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-gray-600">
                {['IB MYP and DP', 'GCSE and A-level', 'AP'].map(item => (
                  <li key={item} className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-brand-600" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <QuestionCard />
          </div>
        </section>

        {/* Three audiences, one product */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-ink">
            One place for the student, the tutor and the class.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Audience
              title="Students"
              lead="Practise on your own, at your level."
              points={['Pick a topic, get the right difficulty', 'Hints that nudge, solutions that teach', 'Review comes back before you forget']}
              icon="practice"
            />
            <Audience
              title="Tutors"
              lead="Run every tutee from one screen."
              points={['Assignments with instant marking', 'Sessions synced to Google Calendar', 'See who is stuck before the lesson']}
              icon="students"
            />
            <Audience
              title="Teachers"
              lead="A class, a syllabus, a term plan."
              points={['Question bank per course and paper', 'Printable worksheets with answer keys', 'Class heatmaps by topic']}
              icon="assignments"
            />
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-3">
            <Step n={1} title="Choose the course" body="IB AA or AI, SL or HL, MYP year, GCSE tier. Topics follow the official syllabus down to the sub-point." />
            <Step n={2} title="Practise and get checked" body="Type the answer in real maths notation. Equivalent forms count. Wrong answers get a hint, then a worked solution." />
            <Step n={3} title="Review before it fades" body="Spaced repetition schedules what to revisit. Streaks and accuracy show the trend; the tutor sees the same picture." />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">Ready when you are.</h2>
          <p className="mx-auto mt-3 max-w-md text-gray-600">Free for students while Mathium is in beta. Tutors and schools can ask for an invite.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="btn btn-primary btn-lg">Create an account</Link>
            <Link href="/login" className="btn btn-secondary btn-lg">Sign in</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-gray-500 sm:px-8">
          <span className="inline-flex items-center gap-2"><LogoMark size={22} /> Mathium</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1"><Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link><span>Not affiliated with or endorsed by the International Baccalaureate.</span></span>
        </div>
      </footer>
    </div>
  )
}

function QuestionCard() {
  return (
    <div className="animate-rise-2 relative mx-auto w-full max-w-md">
      <div className="card p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="chip chip-brand">AA SL · Functions 2.6</span>
          <span className="chip">Paper 1 · no calculator</span>
        </div>
        <p className="mt-5 text-lg font-semibold text-ink">
          The function <em>f</em> is defined by <em>f</em>(<em>x</em>) = 2<em>x</em>² − 8<em>x</em> + 5.
        </p>
        <p className="mt-2 text-ink">Find the coordinates of the vertex.</p>
        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 font-semibold text-brand-800">
          (2, −3)
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1f6b43]">
            <Icons.check className="h-4 w-4" /> Correct
          </span>
          <span className="text-sm text-gray-500">Next review in 3 days</span>
        </div>
      </div>
      <div className="absolute -right-3 -top-3 rotate-3 rounded-full bg-spark-400 px-3 py-1 text-xs font-extrabold text-ink shadow-md">
        12 day streak
      </div>
    </div>
  )
}

function Audience({ title, lead, points, icon }: { title: string; lead: string; points: string[]; icon: 'practice' | 'students' | 'assignments' }) {
  const Icon = Icons[icon]
  return (
    <div className="card p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-xl font-extrabold text-ink">{title}</h3>
      <p className="mt-1 text-gray-600">{lead}</p>
      <ul className="mt-4 space-y-2 text-sm text-gray-700">
        {points.map(p => (
          <li key={p} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-spark-400" aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-base font-extrabold text-white tnum">{n}</div>
      <h3 className="mt-4 text-lg font-extrabold text-ink">{title}</h3>
      <p className="mt-2 text-gray-600">{body}</p>
    </div>
  )
}
