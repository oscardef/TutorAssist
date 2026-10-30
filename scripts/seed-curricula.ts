/**
 * Upserts the platform curriculum trees from db/curricula into the database.
 * Idempotent: curricula match on code, nodes on (curriculum, code). Nodes are
 * never deleted here because questions may point at them; ones missing from
 * the source are only reported. Run by scripts/db-migrate.ts after migrations,
 * or on its own: DATABASE_URL=... npx tsx scripts/seed-curricula.ts
 */
import postgres from 'postgres'
import { CURRICULA, parseOutline } from '../db/curricula'

export async function seedCurricula(sql: postgres.Sql) {
  for (const c of CURRICULA) {
    const [row] = await sql`
      INSERT INTO public.curricula (code, framework, name, short_name, version, levels, source_note, order_index)
      VALUES (${c.code}, ${c.framework}, ${c.name}, ${c.shortName}, ${c.version}, ${c.levels}, ${c.sourceNote}, ${c.orderIndex})
      ON CONFLICT (code) DO UPDATE SET framework = EXCLUDED.framework, name = EXCLUDED.name, short_name = EXCLUDED.short_name,
        version = EXCLUDED.version, levels = EXCLUDED.levels, source_note = EXCLUDED.source_note, order_index = EXCLUDED.order_index, updated_at = now()
      RETURNING id`
    const nodes = parseOutline(c.outline)
    const ids = new Map<string, string>()
    for (const n of nodes) {
      const parentId = n.parentCode ? ids.get(n.parentCode) ?? null : null
      const [node] = await sql`
        INSERT INTO public.curriculum_nodes (curriculum_id, parent_id, code, title, level, depth, order_index)
        VALUES (${row.id}, ${parentId}, ${n.code}, ${n.title}, ${n.level}, ${n.depth}, ${n.orderIndex})
        ON CONFLICT (curriculum_id, code) DO UPDATE SET parent_id = EXCLUDED.parent_id, title = EXCLUDED.title,
          level = EXCLUDED.level, depth = EXCLUDED.depth, order_index = EXCLUDED.order_index
        RETURNING id`
      ids.set(n.code, node.id as string)
    }
    const stale = await sql`SELECT code FROM public.curriculum_nodes WHERE curriculum_id = ${row.id} AND NOT (code = ANY(${[...ids.keys()]}))`
    console.log(`curriculum ${c.code}: ${nodes.length} nodes${stale.length ? `, ${stale.length} no longer in source: ${stale.map(s => s.code).join(', ')}` : ''}`)
  }
}

if (process.argv[1]?.endsWith('seed-curricula.ts')) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  seedCurricula(sql).then(() => sql.end()).catch(err => { console.error(err); process.exit(1) })
}
