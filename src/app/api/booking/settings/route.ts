import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_BOOKING } from '@/lib/booking'
import { isValidTimeZone, normaliseWindows } from '@/lib/scheduling'

/** The signed-in tutor's booking settings in their workspace. */
export async function GET() {
  const context = await requireTutor()
  const supabase = await createServerClient()
  const { data } = await supabase.from('booking_settings').select('*').eq('workspace_id', context.workspaceId).eq('tutor_user_id', context.userId).maybeSingle()
  return NextResponse.json({ settings: data ?? { ...DEFAULT_BOOKING, workspace_id: context.workspaceId, tutor_user_id: context.userId } })
}

export async function PUT(request: Request) {
  const context = await requireTutor()
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const int = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d }
  const timezone = typeof body.timezone === 'string' && isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_BOOKING.timezone
  const row = {
    workspace_id: context.workspaceId,
    tutor_user_id: context.userId,
    enabled: body.enabled === true,
    timezone,
    slot_minutes: int(body.slot_minutes, 15, 240, 60),
    buffer_minutes: int(body.buffer_minutes, 0, 120, 15),
    min_notice_hours: int(body.min_notice_hours, 0, 336, 24),
    max_days_ahead: int(body.max_days_ahead, 1, 120, 28),
    cancel_notice_hours: int(body.cancel_notice_hours, 0, 336, 24),
    windows: normaliseWindows(body.windows),
    updated_at: new Date().toISOString(),
  }
  const supabase = await createServerClient()
  const { data, error } = await supabase.from('booking_settings').upsert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
