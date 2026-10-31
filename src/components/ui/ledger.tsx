/**
 * A row of key numbers set like a textbook table: ruled above and below,
 * figures in the display face, labels underneath. Used instead of a grid of
 * stat boxes.
 */
export function Ledger({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 border-y border-ink/15 sm:grid-cols-4 sm:divide-x sm:divide-ink/10 ${className}`}>
      {children}
    </dl>
  )
}

export function LedgerItem({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: 'good' | 'spark' }) {
  const color = tone === 'good' ? 'text-[#1f6b43]' : tone === 'spark' ? 'text-spark-600' : 'text-ink'
  return (
    <div className="flex flex-col-reverse px-1 py-4 sm:px-5 sm:first:pl-1">
      <dt className="mt-1 text-xs font-semibold text-gray-500">
        {label}
        {note && <span className="block font-normal">{note}</span>}
      </dt>
      <dd className={`numeral text-[2.25rem] leading-none ${color}`}>{value}</dd>
    </div>
  )
}
