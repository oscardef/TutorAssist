import { createAdminClient } from '@/lib/supabase/server'

/**
 * Sponsor messages for Free students: text only, written and switched on
 * by a platform owner, picked at random by weight. No third-party scripts,
 * images, cookies or profiles; only total views and clicks are counted.
 */

export interface SponsorMessage {
  id: string
  sponsor: string
  headline: string
  body: string | null
  link_label: string
}

export async function pickSponsorMessage(today = new Date()): Promise<SponsorMessage | null> {
  const admin = await createAdminClient()
  const day = today.toISOString().slice(0, 10)
  const { data } = await admin
    .from('sponsor_messages')
    .select('id, sponsor, headline, body, link_label, weight, starts_on, ends_on')
    .eq('active', true)
    .limit(200)
  const live = (data ?? []).filter(m => (!m.starts_on || m.starts_on <= day) && (!m.ends_on || m.ends_on >= day))
  if (!live.length) return null
  const total = live.reduce((n, m) => n + (m.weight as number), 0)
  let r = Math.random() * total
  const pick = live.find(m => (r -= m.weight as number) < 0) ?? live[0]
  await admin.rpc('count_sponsor_event', { p_id: pick.id, p_click: false })
  return { id: pick.id, sponsor: pick.sponsor, headline: pick.headline, body: pick.body, link_label: pick.link_label }
}
