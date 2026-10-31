import Link from 'next/link'
import { LogoMark } from '@/components/ui/brand'

/** Frame for long-form public pages (privacy policy, terms of use). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-ink"><LogoMark size={32} /> Mathium</Link>
        <Link href="/login" className="btn btn-secondary btn-sm">Sign in</Link>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 pb-20 pt-6 sm:px-8">
        <h1 className="text-[2rem] font-extrabold leading-tight text-ink sm:text-[2.5rem]">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated {updated}</p>
        <div className="prose-policy mt-8 space-y-8 text-[15px] leading-relaxed text-gray-700">{children}</div>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-gray-500 sm:px-8">
          <span className="inline-flex items-center gap-2"><LogoMark size={22} /> Mathium</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:text-ink hover:underline">Terms</Link>
            <span>Independent: not affiliated with or endorsed by any exam board or curriculum provider.</span>
          </span>
        </div>
      </footer>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  )
}

export const legalContact = () => process.env.PRIVACY_CONTACT_EMAIL || 'privacy@mathium.app'
