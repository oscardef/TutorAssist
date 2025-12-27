/**
 * Delete Topics Script for TutorAssist
 * 
 * This script deletes all topics from the database
 * 
 * Run with: node scripts/delete-topics.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function deleteTopics() {
  console.log('🗑️  Deleting all topics...\n')
  
  try {
    // First, count how many topics exist
    const { count, error: countError } = await supabase
      .from('topics')
      .select('*', { count: 'exact', head: true })
    
    if (countError) throw new Error(`Count error: ${countError.message}`)
    
    console.log(`Found ${count} topics to delete`)
    
    if (count === 0) {
      console.log('✅ No topics found. Database is already clean.')
      return
    }
    
    // Delete all topics
    const { error: deleteError } = await supabase
      .from('topics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    
    if (deleteError) throw new Error(`Delete error: ${deleteError.message}`)
    
    console.log(`✅ Successfully deleted ${count} topics!`)
    
  } catch (error) {
    console.error('❌ Error deleting topics:', error.message)
    process.exit(1)
  }
}

// Run
deleteTopics()
