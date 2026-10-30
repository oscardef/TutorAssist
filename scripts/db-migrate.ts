/**
 * Applies db/migrations/*.sql in filename order, recording each in
 * public.schema_migrations. Usage: DATABASE_URL=... npx tsx scripts/db-migrate.ts
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  const dir = join(process.cwd(), 'db', 'migrations')
  try {
    await sql`CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
    const applied = new Set((await sql`SELECT name FROM public.schema_migrations`).map(r => r.name as string))
    const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (applied.has(file)) { console.log(`skip  ${file}`); continue }
      const body = readFileSync(join(dir, file), 'utf8')
      console.log(`apply ${file}`)
      await sql.unsafe(body)
      await sql`INSERT INTO public.schema_migrations (name) VALUES (${file})`
    }
    console.log('migrations up to date')
  } finally {
    await sql.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
