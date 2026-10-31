'use client'

import { AppShell, type NavItem } from '@/components/app-shell'

const items: NavItem[] = [
  { href: '/student/dashboard', label: 'Home', icon: 'home', primary: true },
  { href: '/student/practice', label: 'Practice', icon: 'practice', primary: true },
  { href: '/student/assignments', label: 'Assignments', icon: 'assignments', primary: true },
  { href: '/student/progress', label: 'Progress', icon: 'progress', primary: true },
  { href: '/student/settings', label: 'Settings', icon: 'settings', primary: true },
]

// Practising without a tutor: no assignments, and the plan has its own page
const soloItems: NavItem[] = [
  { href: '/student/dashboard', label: 'Home', icon: 'home', primary: true },
  { href: '/student/practice', label: 'Practice', icon: 'practice', primary: true },
  { href: '/student/progress', label: 'Progress', icon: 'progress', primary: true },
  { href: '/student/plan', label: 'Plan', icon: 'star', primary: true },
  { href: '/student/settings', label: 'Settings', icon: 'settings', primary: true },
]

export function StudentNav({ userName, workspaceName, solo = false, children }: { userName: string; workspaceName?: string | null; solo?: boolean; children: React.ReactNode }) {
  return (
    <AppShell items={solo ? soloItems : items} homeHref="/student/dashboard" roleLabel="Student" userName={userName} workspaceName={solo ? null : workspaceName}>
      {children}
    </AppShell>
  )
}
