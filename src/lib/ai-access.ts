import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Who may spend AI credit. With the site public, anyone can sign up as a
 * tutor, so AI features are limited to platform owners and the accounts in
 * AI_ALLOWED_EMAILS (comma separated), unless AI_OPEN_TO_ALL=true. Every
 * workspace also has a daily cap on AI calls (AI_DAILY_LIMIT, default 300),
 * counted from ai_usage_log.
 */
interface Caller { userId: string; email: string; workspaceId: string; isPlatformOwner?: boolean }

export function aiAllowed(caller: Caller): boolean {
  if (caller.isPlatformOwner || process.env.AI_OPEN_TO_ALL === 'true') return true
  const allowed = (process.env.AI_ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(caller.email.toLowerCase())
}

/** A response to return when the caller may not use AI right now, else null. */
export async function aiAccessError(caller: Caller): Promise<NextResponse | null> {
  if (!aiAllowed(caller)) {
    return NextResponse.json({ error: 'AI features are not switched on for this account yet. Ask the Mathium team to enable them.', code: 'ai_not_enabled' }, { status: 403 })
  }
  const limit = Number(process.env.AI_DAILY_LIMIT || 300)
  if (limit > 0) {
    const admin = await createAdminClient()
    const { count } = await admin
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', caller.workspaceId)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    if ((count ?? 0) >= limit) {
      return NextResponse.json({ error: `This workspace has reached today's AI limit (${limit} requests). It resets within 24 hours.`, code: 'ai_daily_limit' }, { status: 429 })
    }
  }
  return null
}

/**
 * Whether AI features may use anonymised student results (accuracy, weaker
 * topics; never names or emails) in this workspace. On unless the workspace
 * turned it off in settings (settings_json.ai_student_data = false).
 */
export async function sharesStudentDataWithAI(workspaceId: string): Promise<boolean> {
  const admin = await createAdminClient()
  const { data } = await admin.from('workspaces').select('settings_json').eq('id', workspaceId).maybeSingle()
  return (data?.settings_json as { ai_student_data?: boolean } | null)?.ai_student_data !== false
}
