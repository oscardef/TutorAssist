import { TutorNav } from '@/components/tutor-nav'
import { ToastProvider } from '@/components/toast'
import { requireTutor, getUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const context = await requireTutor()
  const user = await getUser()
  const supabase = await createServerClient()
  const { data: workspace } = await supabase.from('workspaces').select('name').eq('id', context.workspaceId).maybeSingle()

  return (
    <ToastProvider>
      <TutorNav userName={user?.name || user?.email || 'Tutor'} workspaceName={workspace?.name}>
        {children}
      </TutorNav>
    </ToastProvider>
  )
}
