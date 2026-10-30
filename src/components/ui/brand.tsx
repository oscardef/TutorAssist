import Link from 'next/link'

/** Mathium mark: a teal tile with an M whose apex carries the amber spark. */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={className}
    >
      <rect width="40" height="40" rx="11" fill="#0f7a77" />
      <path
        d="M9 29V12.5l11 11 11-11V29"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="23.5" r="3" fill="#f2a541" />
    </svg>
  )
}

export function Wordmark({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-lg" aria-label="Mathium home">
      <LogoMark size={compact ? 32 : 36} />
      {!compact && <span className="text-[1.3rem] font-extrabold tracking-tight text-ink">Mathium</span>}
    </Link>
  )
}
