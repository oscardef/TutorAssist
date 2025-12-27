import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Get migration file from command line arg or use default
const migrationArg = process.argv[2]
const migrationFile = migrationArg || '007_simplify_status_and_stats.sql'

async function runMigration() {
  try {
    console.log(`Reading migration file: ${migrationFile}`)
    const migrationPath = join(__dirname, `../supabase/migrations/${migrationFile}`)
    
    if (!existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`)
      process.exit(1)
    }
    
    const sql = readFileSync(migrationPath, 'utf-8')
    
    console.log('Running migration...')
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('✓ Migration completed successfully!')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

runMigration()
