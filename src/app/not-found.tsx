import Link from 'next/link'
import { LogoMark } from '@/components/ui/brand'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <main id="main" className="book-page flex min-h-screen items-center justify-center px-5 py-12">
      <div className="card w-full max-w-md p-8">
        <LogoMark size={36} />
        <p className="numeral mt-6 text-[3.5rem] leading-none text-ink/25" aria-hidden="true">404</p>
        <h1 className="page-title mt-2">There’s no page here</h1>
        <p className="page-subtitle">The link may be old, or the page may have moved.</p>
        <div className="mt-6">
          <Link href="/" className="btn btn-primary">Go to the start page</Link>
        </div>
      </div>
    </main>
  )
}
