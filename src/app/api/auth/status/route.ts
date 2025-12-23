import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    return NextResponse.json({ authenticated: !!user })
  } catch {
    return NextResponse.json({ authenticated: false })
  }
}
