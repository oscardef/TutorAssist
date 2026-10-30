import { eq, inArray } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db, identity } from '@/lib/db'

/**
 * User-directory helpers that replaced Supabase's `auth.admin.*` calls.
 * They talk to the identity schema directly (never through PostgREST).
 */

export interface DirectoryUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
  createdAt: Date
}

const toDirectoryUser = (row: typeof identity.users.$inferSelect): DirectoryUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  emailVerified: row.emailVerified,
  createdAt: row.createdAt,
})

export async function getUserById(id: string): Promise<DirectoryUser | null> {
  const rows = await db.select().from(identity.users).where(eq(identity.users.id, id)).limit(1)
  return rows[0] ? toDirectoryUser(rows[0]) : null
}

export async function getUsersByIds(ids: string[]): Promise<Map<string, DirectoryUser>> {
  if (ids.length === 0) return new Map()
  const rows = await db.select().from(identity.users).where(inArray(identity.users.id, ids))
  return new Map(rows.map(r => [r.id, toDirectoryUser(r)]))
}

export async function getUserByEmail(email: string): Promise<DirectoryUser | null> {
  const rows = await db.select().from(identity.users).where(eq(identity.users.email, email.toLowerCase().trim())).limit(1)
  return rows[0] ? toDirectoryUser(rows[0]) : null
}

export async function listUsers(): Promise<DirectoryUser[]> {
  const rows = await db.select().from(identity.users)
  return rows.map(toDirectoryUser)
}

/** Deletes the identity record; application rows cascade or null out per their foreign keys. */
export async function deleteUser(id: string): Promise<void> {
  await db.delete(identity.users).where(eq(identity.users.id, id))
}

export async function updateUserName(id: string, name: string): Promise<void> {
  await db.update(identity.users).set({ name, updatedAt: new Date() }).where(eq(identity.users.id, id))
}

/**
 * Creates a user with a password without signing anyone in. Used for invite
 * acceptance, where the invite itself proves control of the email address.
 * Writes the identity tables directly with the same bcrypt scheme Better Auth
 * is configured with (see lib/identity/server.ts).
 */
export async function createUserWithPassword(params: { email: string; password: string; name: string; emailVerified?: boolean }): Promise<DirectoryUser> {
  const email = params.email.toLowerCase().trim()
  const passwordHash = await bcrypt.hash(params.password, 10)
  const created = await db.transaction(async tx => {
    const [user] = await tx.insert(identity.users).values({
      email,
      name: params.name,
      emailVerified: params.emailVerified ?? false,
    }).returning()
    await tx.insert(identity.accounts).values({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: passwordHash,
    })
    return user
  })
  return toDirectoryUser(created)
}
