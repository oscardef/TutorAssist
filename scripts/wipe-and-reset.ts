/**
 * Wipe and Reset Script for TutorAssist
 * 
 * This script cleans all generated content to start fresh:
 * - Deletes all questions (AI-generated and manual)
 * - Deletes all assignments and related data
 * - Deletes all attempts, flags, and feedback
 * - Keeps: workspaces, users, student profiles, topics, sessions
 * 
 * Run with: npx tsx scripts/wipe-and-reset.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function wipeData() {
  console.log('🧹 Starting TutorAssist Data Wipe...\n')
  
  try {
    // 1. Delete attempts (depends on questions, assignments)
    console.log('1/8 Deleting attempts...')
    const { error: attemptsError } = await supabase
      .from('attempts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    if (attemptsError) throw new Error(`Attempts: ${attemptsError.message}`)
    console.log(`   ✓ Deleted attempts`)

    // 2. Delete question flags
    console.log('2/8 Deleting question flags...')
    const { error: flagsError } = await supabase
      .from('question_flags')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (flagsError) throw new Error(`Flags: ${flagsError.message}`)
    console.log(`   ✓ Deleted flags`)

    // 3. Delete tutor feedback
    console.log('3/8 Deleting tutor feedback...')
    const { error: feedbackError } = await supabase
      .from('tutor_feedback')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (feedbackError) throw new Error(`Feedback: ${feedbackError.message}`)
    console.log(`   ✓ Deleted feedback`)

    // 4. Delete spaced repetition data
    console.log('4/8 Deleting spaced repetition data...')
    const { error: srError } = await supabase
      .from('spaced_repetition')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (srError) throw new Error(`Spaced rep: ${srError.message}`)
    console.log(`   ✓ Deleted spaced repetition data`)

    // 5. Delete assignment items
    console.log('5/8 Deleting assignment items...')
    const { error: itemsError } = await supabase
      .from('assignment_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (itemsError) throw new Error(`Assignment items: ${itemsError.message}`)
    console.log(`   ✓ Deleted assignment items`)

    // 6. Delete assignments
    console.log('6/8 Deleting assignments...')
    const { error: assignmentsError } = await supabase
      .from('assignments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (assignmentsError) throw new Error(`Assignments: ${assignmentsError.message}`)
    console.log(`   ✓ Deleted assignments`)

    // 7. Delete questions
    console.log('7/8 Deleting questions...')
    const { error: questionsError } = await supabase
      .from('questions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (questionsError) throw new Error(`Questions: ${questionsError.message}`)
    console.log(`   ✓ Deleted questions`)

    // 8. Delete pending/failed jobs
    console.log('8/8 Cleaning up jobs...')
    const { error: jobsError } = await supabase
      .from('jobs')
      .delete()
      .in('status', ['pending', 'processing', 'failed', 'batch_pending'])
    if (jobsError) throw new Error(`Jobs: ${jobsError.message}`)
    console.log(`   ✓ Cleaned up jobs`)

    console.log('\n✅ Data wipe complete!')
    console.log('\nPreserved data:')
    console.log('  - Workspaces')
    console.log('  - Users and workspace members')
    console.log('  - Student profiles')
    console.log('  - Topics')
    console.log('  - Sessions')
    console.log('  - OAuth connections')
    console.log('  - Source materials')

  } catch (error) {
    console.error('\n❌ Error during wipe:', error)
    process.exit(1)
  }
}

// Run if called directly
wipeData()
