import { redirect } from 'next/navigation'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { StudentNav } from '@/components/student-nav'
import { ToastProvider } from '@/components/toast'
import { consentPending, isSoloWorkspace } from '@/lib/student-plan'
import { syncSoloLibrary } from '@/lib/solo'
import { ConsentPending } from './ConsentPending'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const context = await getUserContext()
  if (!context) redirect('/onboarding')
  if (context.role !== 'student') redirect('/tutor/dashboard')

  const supabase = await createServerClient()
  const [{ data: workspace }, solo] = await Promise.all([
    supabase.from('workspaces').select('name').eq('id', context.workspaceId).maybeSingle(),
    isSoloWorkspace(context.workspaceId),
  ])
  if (solo) {
    const consent = await consentPending(user.id)
    if (consent.pending) return <ConsentPending name={user.name || user.email} parentEmail={consent.parentEmail || ''} />
    // New and edited library questions reach the student's own copy (throttled)
    try { await syncSoloLibrary(context.workspaceId) } catch (err) { console.error('[solo] library sync failed', err) }
  }

  return (
    <ToastProvider>
      <StudentNav userName={user.name || user.email} workspaceName={workspace?.name} solo={solo}>
        {children}
      </StudentNav>
    </ToastProvider>
  )
}
