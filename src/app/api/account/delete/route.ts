import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { deleteAccount } from '@/lib/account'

/**
 * Delete the signed-in person's account. They must type their email to
 * confirm. A tutor who is the only tutor of a workspace with students gets a
 * `blocked` answer and must confirm deleting that workspace too.
 */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { confirmEmail?: string; deleteWorkspaces?: boolean }
  if ((body.confirmEmail || '').trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Type your email address exactly to confirm.' }, { status: 400 })
  }
  const result = await deleteAccount(user.id, body.deleteWorkspaces === true)
  if (!result.ok) {
    const members = result.blocked.reduce((n, b) => n + b.members, 0)
    return NextResponse.json({ error: `You are the only tutor of a workspace with ${members} other member${members === 1 ? '' : 's'}. Deleting your account would also delete that workspace and their data there.`, code: 'sole_tutor', blocked: result.blocked }, { status: 409 })
  }
  const res = NextResponse.json({ ok: true })
  // The sign-in session rows are gone; clear the cookies too
  for (const name of ['better-auth.session_token', '__Secure-better-auth.session_token', 'better-auth.session_data', '__Secure-better-auth.session_data']) {
    res.cookies.set(name, '', { path: '/', maxAge: 0 })
  }
  return res
}
