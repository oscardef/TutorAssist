'use client'

import { AppShell, type NavItem } from '@/components/app-shell'

const items: NavItem[] = [
  { href: '/student/dashboard', label: 'Home', icon: 'home', primary: true },
  { href: '/student/practice', label: 'Practice', icon: 'practice', primary: true },
  { href: '/student/assignments', label: 'Assignments', icon: 'assignments', primary: true },
  { href: '/student/progress', label: 'Progress', icon: 'progress', primary: true },
  { href: '/student/settings', label: 'Settings', icon: 'settings', primary: true },
]

export function StudentNav({ userName, workspaceName, children }: { userName: string; workspaceName?: string | null; children: React.ReactNode }) {
  return (
    <AppShell items={items} homeHref="/student/dashboard" roleLabel="Student" userName={userName} workspaceName={workspaceName}>
      {children}
    </AppShell>
  )
}
