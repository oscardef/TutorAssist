import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { exportAccount } from '@/lib/account'
import { isoDate } from '@/lib/dates'

/** Download everything Mathium holds about the signed-in person, as JSON. */
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await exportAccount(user.id)
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="mathium-data-${isoDate(new Date())}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
