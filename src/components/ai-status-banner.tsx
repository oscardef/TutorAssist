'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Icons } from '@/components/ui/icons'

interface Status {
  enabled: boolean
  reason: 'platform_off' | 'not_enabled' | null
  unlimited: boolean
  person: { daily: number | null; monthly: number | null; monthlyCost: number | null }
  usage: { day: number; month: number; monthCost: number } | null
}

/** Tells tutors up front whether AI is available and how much is left. */
export function AiStatusBanner() {
  const [s, setS] = useState<Status | null>(null)
  useEffect(() => { fetch('/api/ai/status').then(r => r.json()).then(setS).catch(() => null) }, [])
  if (!s) return null
  if (!s.enabled) {
    return (
      <div className="card flex flex-wrap items-start gap-4 border-[#f2d9a8] bg-[#fff8ea] p-5" role="status">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-spark-100 text-spark-700"><Icons.sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-ink">{s.reason === 'platform_off' ? 'AI generation is paused for now' : 'AI generation isn’t switched on for your account yet'}</p>
          <p className="mt-1 text-sm text-gray-600">{s.reason === 'platform_off' ? 'Everything else works as usual. Try again later.' : 'While Mathium is in beta, AI features are switched on account by account. Meanwhile you can write questions yourself or add ready-made ones from the shared library.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/tutor/questions/new" className="btn btn-secondary btn-sm"><Icons.plus className="h-4 w-4" /> Write a question</Link>
            <Link href="/tutor/library" className="btn btn-secondary btn-sm"><Icons.book className="h-4 w-4" /> Browse the library</Link>
          </div>
        </div>
      </div>
    )
  }
  if (s.unlimited || !s.usage) return null
  const parts: string[] = []
  if (s.person.daily !== null) parts.push(`${s.usage.day} of ${s.person.daily} today`)
  if (s.person.monthly !== null) parts.push(`${s.usage.month} of ${s.person.monthly} this month`)
  if (parts.length === 0) return null
  const tight = (s.person.daily !== null && s.usage.day >= s.person.daily * 0.8) || (s.person.monthly !== null && s.usage.month >= s.person.monthly * 0.8)
  return <p className={`text-sm ${tight ? 'font-semibold text-[#9b5c00]' : 'text-gray-500'}`} role="status">AI requests: {parts.join(', ')}</p>
}
