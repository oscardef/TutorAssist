import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { consentPending } from '@/lib/student-plan'

/** Whether the signed-in student is still waiting for a parent to agree. */
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pending } = await consentPending(user.id)
  return NextResponse.json({ pending }, { headers: { 'Cache-Control': 'no-store' } })
}
