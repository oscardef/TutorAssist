'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Tells the server the browser's time zone so server-rendered times match it. */
export function TimezoneCookie() {
  const router = useRouter()
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!tz) return
      const current = document.cookie.split('; ').find(c => c.startsWith('tz='))?.slice(3)
      if (current === encodeURIComponent(tz)) return
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`
      router.refresh()
    } catch {
      // Older browsers: the server default zone stays in use
    }
  }, [router])
  return null
}
