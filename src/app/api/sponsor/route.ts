import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { studentAccess } from '@/lib/student-plan'
import { pickSponsorMessage } from '@/lib/sponsor'

/** The sponsor message to show this student, if their plan shows one. */
export async function GET() {
  const context = await getUserContext()
  if (!context || context.role !== 'student') return NextResponse.json({ show: false })
  const access = await studentAccess(context.userId, context.workspaceId)
  if (!access.features.sponsorMessages) return NextResponse.json({ show: false })
  return NextResponse.json({ show: true, message: await pickSponsorMessage() }, { headers: { 'Cache-Control': 'no-store' } })
}
