import { getUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await getUser()
    return NextResponse.json({ authenticated: !!user, email: user?.email || null })
  } catch {
    return NextResponse.json({ authenticated: false, email: null })
  }
}
