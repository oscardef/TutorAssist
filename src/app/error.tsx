'use client'

import Link from 'next/link'
import { LogoMark } from '@/components/ui/brand'

// Shown when a page fails on the server or in the browser. Says what
// happened and offers the two ways forward: try again, or go home.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="book-page flex min-h-screen items-center justify-center px-5 py-12">
      <div className="card w-full max-w-md p-8">
        <LogoMark size={36} />
        <h1 className="page-title mt-6">This page didn’t load</h1>
        <p className="page-subtitle">
          Something went wrong on our side, not yours. Try again in a moment. If it keeps happening, quote the reference below to your tutor or to Mathium.
        </p>
        {error.digest && <p className="mt-3 text-xs text-gray-500">Reference: <span className="tnum">{error.digest}</span></p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-secondary">Go to the start page</Link>
        </div>
      </div>
    </main>
  )
}
