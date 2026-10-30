import { redirect } from 'next/navigation'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { StudentNav } from '@/components/student-nav'
import { ToastProvider } from '@/components/toast'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const context = await getUserContext()
  if (!context) redirect('/onboarding')
  if (context.role !== 'student') redirect('/tutor/dashboard')

  const supabase = await createServerClient()
  const { data: workspace } = await supabase.from('workspaces').select('name').eq('id', context.workspaceId).maybeSingle()

  return (
    <ToastProvider>
      <StudentNav userName={user.name || user.email} workspaceName={workspace?.name}>
        {children}
      </StudentNav>
    </ToastProvider>
  )
}
