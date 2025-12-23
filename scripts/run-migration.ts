import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

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

async function runMigration() {
  try {
    console.log('Reading migration file...')
    const migrationPath = join(__dirname, '../supabase/migrations/005_add_grade_level_to_questions.sql')
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
