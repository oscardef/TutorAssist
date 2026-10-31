import { LogoMark } from '@/components/ui/brand'
import Link from 'next/link'

/**
 * Two-panel frame for sign-in, sign-up, invites and onboarding, in the
 * app's exercise-book language: the ink cover on the left carries the brand,
 * the squared page on the right holds the form. On small screens the cover
 * collapses to a compact header.
 */
export function AuthShell({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cover lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden text-cover-text lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="Mathium home">
          <LogoMark size={40} />
          <span className="text-2xl font-extrabold tracking-tight text-white">Mathium</span>
        </Link>
        <div className="max-w-md">
          {aside ?? (
            <>
              <p className="font-display text-[2.5rem] font-semibold leading-[1.12] tracking-[-0.015em] text-white">
                Practice that fits the syllabus. Progress you can see.
              </p>
              <p className="mt-5 text-base leading-relaxed text-cover-text">
                Questions tagged to the exact topic, instant checking, spaced review before exams, and the tools tutors use to run it all.
              </p>
            </>
          )}
        </div>
        <p className="text-sm text-cover-text/70">School maths from primary to pre-university.</p>
      </aside>

      <div className="book-page flex min-h-screen flex-col lg:min-h-0 lg:rounded-l-2xl">
        <header className="flex items-center justify-between px-5 py-4 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Mathium home">
            <LogoMark size={32} />
            <span className="text-lg font-extrabold tracking-tight text-ink">Mathium</span>
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="mt-2 text-base text-gray-600">{subtitle}</p>}
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
