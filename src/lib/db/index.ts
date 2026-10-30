import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as identity from './identity-schema'

/**
 * Direct Postgres connection used by Better Auth and server-side helpers that
 * must bypass the PostgREST data API (user management, migrations, worker).
 * Application data access still goes through PostgREST (see lib/supabase/server.ts)
 * so row-level security keeps applying.
 *
 * The connection is opened lazily on first use, so importing this module in a
 * test or build step without DATABASE_URL does not fail.
 */
type Db = PostgresJsDatabase<typeof identity>

const globalForDb = globalThis as unknown as { __mathiumSql?: ReturnType<typeof postgres>; __mathiumDb?: Db }

function connect(): Db {
  if (globalForDb.__mathiumDb) return globalForDb.__mathiumDb
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = globalForDb.__mathiumSql ?? postgres(url, { max: 10, prepare: false })
  const db = drizzle(sql, { schema: identity })
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__mathiumSql = sql
    globalForDb.__mathiumDb = db
  } else {
    globalForDb.__mathiumSql = sql
    globalForDb.__mathiumDb = db
  }
  return db
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = connect() as unknown as Record<string | symbol, unknown>
    const value = Reflect.get(real, prop, receiver)
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})

export { identity }
