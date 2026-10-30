import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { isPlatformOwnerEmail } from '@/lib/library'
import LibraryClient from './LibraryClient'

export default async function LibraryPage() {
  const context = await requireTutor()
  const supabase = await createServerClient()
  const { data: mine } = await supabase
    .from('questions')
    .select('id, prompt_text, prompt_latex, review_status, review_notes, submitted_at, reviewed_at, topics(name)')
    .eq('workspace_id', context.workspaceId)
    .eq('library', 'workspace')
    .neq('review_status', 'none')
    .order('submitted_at', { ascending: false })
    .limit(100)
  const isOwner = context.isPlatformOwner || isPlatformOwnerEmail(context.email)
  return <LibraryClient isOwner={isOwner} initialMine={(mine || []) as never} />
}
