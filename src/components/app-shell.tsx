'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { authClient } from '@/lib/identity/client'
import { Icons, type IconName } from '@/components/ui/icons'
import { LogoMark } from '@/components/ui/brand'

export interface NavItem {
  href: string
  label: string
  icon: IconName
  /** Show in the mobile tab bar (max five). */
  primary?: boolean
}

interface AppShellProps {
  items: NavItem[]
  homeHref: string
  roleLabel: string
  userName: string
  workspaceName?: string | null
  children: React.ReactNode
}

// Collapsed state is per-device UI state; kept in localStorage through a small
// external store so React never sets state inside an effect.
const KEY = 'mathium-sidebar-collapsed'
const listeners = new Set<() => void>()
function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}
function readCollapsed() {
  try { return localStorage.getItem(KEY) === 'true' } catch { return false }
}
function writeCollapsed(v: boolean) {
  try { localStorage.setItem(KEY, String(v)) } catch { /* ignore */ }
  listeners.forEach(l => l())
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
}

export function AppShell({ items, homeHref, roleLabel, userName, workspaceName, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const signOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  const Chevron = Icons.chevronLeft
  const SignOut = Icons.signout
  const mobileItems = items.filter(i => i.primary).slice(0, 5)

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar (md and up) */}
      <aside
        className={`sticky top-0 hidden h-screen flex-shrink-0 flex-col border-r border-line bg-white/70 backdrop-blur md:flex transition-[width] duration-200 ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}
        aria-label="Primary"
      >
        <div className={`flex h-16 items-center ${collapsed ? 'justify-center' : 'justify-between pl-4 pr-2'}`}>
          <Link href={homeHref} className="flex items-center gap-2.5 rounded-lg" aria-label="Mathium home">
            <LogoMark size={32} />
            {!collapsed && <span className="text-lg font-extrabold tracking-tight text-ink">Mathium</span>}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => writeCollapsed(true)}
              className="rounded-lg p-2 text-gray-400 hover:bg-paper-deep hover:text-ink"
              aria-label="Collapse sidebar"
            >
              <Chevron className="h-5 w-5" />
            </button>
          )}
        </div>

        {!collapsed && workspaceName && (
          <div className="mx-3 mb-2 rounded-xl bg-paper px-3 py-2">
            <p className="text-[11px] font-semibold text-gray-500">{roleLabel}</p>
            <p className="truncate text-sm font-bold text-ink">{workspaceName}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {items.map(item => {
              const Icon = Icons[item.icon]
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-semibold transition-colors ${
                      active ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-paper-deep hover:text-ink'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-ink'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-line p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={() => writeCollapsed(false)} className="rounded-lg p-2 text-gray-400 hover:bg-paper-deep hover:text-ink" aria-label="Expand sidebar">
                <Chevron className="h-5 w-5 rotate-180" />
              </button>
              <button type="button" onClick={signOut} className="rounded-lg p-2 text-gray-400 hover:bg-paper-deep hover:text-ink" aria-label="Sign out">
                <SignOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-spark-100 text-sm font-extrabold text-spark-700" aria-hidden="true">
                {initials(userName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{userName}</p>
                <p className="truncate text-xs text-gray-500">{roleLabel}</p>
              </div>
              <button type="button" onClick={signOut} className="rounded-lg p-2 text-gray-400 hover:bg-paper-deep hover:text-ink" aria-label="Sign out">
                <SignOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur md:hidden">
          <Link href={homeHref} className="flex items-center gap-2" aria-label="Mathium home">
            <LogoMark size={28} />
            <span className="font-extrabold text-ink">Mathium</span>
          </Link>
          <button type="button" onClick={signOut} className="rounded-lg p-2 text-gray-500" aria-label="Sign out">
            <SignOut className="h-5 w-5" />
          </button>
        </header>

        <main id="main" className="flex-1 pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>

        {/* Mobile tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:hidden" aria-label="Primary" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length || 1}, minmax(0, 1fr))` }}>
            {mobileItems.map(item => {
              const Icon = Icons[item.icon]
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-brand-700' : 'text-gray-500'}`}
                  >
                    <span className={`rounded-full px-3 py-1 ${active ? 'bg-brand-100' : ''}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}
