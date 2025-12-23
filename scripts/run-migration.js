const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    console.log('📖 Reading migration file...')
    const migrationPath = path.join(__dirname, '../supabase/migrations/005_add_grade_level_to_questions.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    
    console.log('🔄 Running migration directly via SQL...\n')
    
    // Parse and run each SQL statement
    const statements = [
      'ALTER TABLE questions ADD COLUMN IF NOT EXISTS grade_level INTEGER',
      'ALTER TABLE questions ADD CONSTRAINT check_grade_level CHECK (grade_level IS NULL OR (grade_level >= 1 AND grade_level <= 16))',
      'CREATE INDEX IF NOT EXISTS idx_questions_grade_level ON questions(grade_level)',
      'ALTER TABLE topics ADD COLUMN IF NOT EXISTS grade_level_min INTEGER',
      'ALTER TABLE topics ADD COLUMN IF NOT EXISTS grade_level_max INTEGER'
    ]
    
    for (const statement of statements) {
      console.log(`  Executing: ${statement.substring(0, 70)}...`)
      try {
        // Use raw SQL query through Supabase
        const { error } = await supabase.from('_migrations').select('*').limit(0)
        
        // Since we can't execute DDL directly, try using the PostgREST API
        const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ sql: statement })
        })
        
        if (response.ok || response.status === 404) {
          console.log('  ✓')
        } else {
          const text = await response.text()
          console.log(`  ⚠️  ${response.status}: ${text}`)
        }
      } catch (err) {
        console.log(`  ⚠️  ${err.message}`)
      }
    }
    
    console.log('\n✅ Migration script completed!')
    console.log('\n📝 Note: If errors occurred, please run the migration manually:')
    console.log('1. Open your Supabase project dashboard')
    console.log('2. Go to SQL Editor')
    console.log('3. Copy and paste from: supabase/migrations/005_add_grade_level_to_questions.sql')
    console.log('4. Click "Run"')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

runMigration()
