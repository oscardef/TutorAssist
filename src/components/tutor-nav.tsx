'use client'

import { AppShell, type NavItem } from '@/components/app-shell'

const items: NavItem[] = [
  { href: '/tutor/dashboard', label: 'Dashboard', icon: 'home', primary: true },
  { href: '/tutor/students', label: 'Students', icon: 'students', primary: true },
  { href: '/tutor/assignments', label: 'Assignments', icon: 'assignments', primary: true },
  { href: '/tutor/questions', label: 'Question bank', icon: 'questions', primary: true },
  { href: '/tutor/library', label: 'Library', icon: 'book' },
  { href: '/tutor/topics', label: 'Topics', icon: 'topics' },
  { href: '/tutor/generate', label: 'Generate', icon: 'sparkles' },
  { href: '/tutor/sessions', label: 'Sessions', icon: 'calendar' },
  { href: '/tutor/materials', label: 'Materials', icon: 'folder' },
  { href: '/tutor/flags', label: 'Flags', icon: 'flag' },
  { href: '/tutor/settings', label: 'Settings', icon: 'settings', primary: true },
]

// Platform owners also manage AI limits for everyone
const ownerItems: NavItem[] = [{ href: '/tutor/admin/ai', label: 'AI usage', icon: 'progress' }]

export function TutorNav({ userName, workspaceName, isOwner = false, children }: { userName: string; workspaceName?: string | null; isOwner?: boolean; children: React.ReactNode }) {
  return (
    <AppShell items={isOwner ? [...items.slice(0, -1), ...ownerItems, items[items.length - 1]] : items} homeHref="/tutor/dashboard" roleLabel="Tutor" userName={userName} workspaceName={workspaceName}>
      {children}
    </AppShell>
  )
}
