#!/usr/bin/env npx tsx
/**
 * Reset Generated Content Script
 * 
 * This script wipes all AI-generated questions, assignments, attempts, and related data
 * to start fresh for testing. Use with caution in production!
 * 
 * Usage:
 *   npx tsx scripts/reset-generated-content.ts
 *   npx tsx scripts/reset-generated-content.ts --all       # Delete ALL data (including manual questions)
 *   npx tsx scripts/reset-generated-content.ts --workspace <id>  # Only for specific workspace
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing environment variables.')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

interface CleanupOptions {
  all: boolean
  workspaceId?: string
  keepManual: boolean
  dryRun: boolean
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function countRecords(table: string, filter?: Record<string, unknown>): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
  }
  
  const { count } = await query
  return count || 0
}

async function deleteRecords(
  table: string, 
  filter?: Record<string, unknown>,
  dryRun = false
): Promise<number> {
  if (dryRun) {
    return await countRecords(table, filter)
  }
  
  let query = supabase.from(table).delete()
  
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
  } else {
    // Safety: require at least some filter for delete
    query = query.neq('id', '00000000-0000-0000-0000-000000000000')
  }
  
  const { error } = await query
  
  if (error) {
    console.error(`Error deleting from ${table}:`, error.message)
    return 0
  }
  
  return await countRecords(table, filter) === 0 ? 1 : 0
}

async function cleanup(options: CleanupOptions) {
  console.log('\n🔄 TutorAssist Content Reset Script')
  console.log('=' .repeat(50))
  
  if (options.dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n')
  }
  
  const workspaceFilter = options.workspaceId 
    ? { workspace_id: options.workspaceId }
    : undefined
  
  // Count what will be deleted
  console.log('\n📊 Current Data Counts:')
  
  const counts = {
    attempts: await countRecords('attempts', workspaceFilter),
    spacedRep: await countRecords('spaced_repetition', workspaceFilter),
    assignmentItems: await countRecords('assignment_items'),
    assignments: await countRecords('assignments', workspaceFilter),
    questionFlags: await countRecords('question_flags', workspaceFilter),
    tutorFeedback: await countRecords('tutor_feedback', workspaceFilter),
    jobs: await countRecords('jobs', workspaceFilter),
    pdfExports: await countRecords('pdf_exports', workspaceFilter),
    questions: options.keepManual
      ? await countRecords('questions', { ...workspaceFilter, origin: 'ai_generated' })
      : await countRecords('questions', workspaceFilter),
    sourceMaterials: await countRecords('source_materials', workspaceFilter),
  }
  
  console.log(`  - Attempts: ${counts.attempts}`)
  console.log(`  - Spaced Repetition: ${counts.spacedRep}`)
  console.log(`  - Assignment Items: ${counts.assignmentItems}`)
  console.log(`  - Assignments: ${counts.assignments}`)
  console.log(`  - Question Flags: ${counts.questionFlags}`)
  console.log(`  - Tutor Feedback: ${counts.tutorFeedback}`)
  console.log(`  - Jobs: ${counts.jobs}`)
  console.log(`  - PDF Exports: ${counts.pdfExports}`)
  console.log(`  - Questions${options.keepManual ? ' (AI-generated only)' : ''}: ${counts.questions}`)
  if (options.all) {
    console.log(`  - Source Materials: ${counts.sourceMaterials}`)
  }
  
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`\n📈 Total records to delete: ${total}`)
  
  if (options.dryRun) {
    console.log('\n✅ Dry run complete. Run without --dry-run to execute.')
    return
  }
  
  // Confirm deletion
  const confirm = await prompt('\n⚠️  Are you sure you want to delete this data? (yes/no): ')
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\n❌ Cancelled.')
    return
  }
  
  console.log('\n🗑️  Deleting data...\n')
  
  // Delete in order of dependencies (child tables first)
  
  // 1. Delete attempts (depends on questions, assignments)
  console.log('  Deleting attempts...')
  const { error: attemptsError } = await supabase
    .from('attempts')
    .delete()
    .not('id', 'is', null)
  if (attemptsError) console.error('    Error:', attemptsError.message)
  else console.log('    ✓ Done')
  
  // 2. Delete spaced repetition
  console.log('  Deleting spaced_repetition...')
  const { error: srError } = await supabase
    .from('spaced_repetition')
    .delete()
    .not('id', 'is', null)
  if (srError) console.error('    Error:', srError.message)
  else console.log('    ✓ Done')
  
  // 3. Delete assignment items
  console.log('  Deleting assignment_items...')
  const { error: aiError } = await supabase
    .from('assignment_items')
    .delete()
    .not('id', 'is', null)
  if (aiError) console.error('    Error:', aiError.message)
  else console.log('    ✓ Done')
  
  // 4. Delete assignments
  console.log('  Deleting assignments...')
  const { error: assignError } = await supabase
    .from('assignments')
    .delete()
    .not('id', 'is', null)
  if (assignError) console.error('    Error:', assignError.message)
  else console.log('    ✓ Done')
  
  // 5. Delete question flags
  console.log('  Deleting question_flags...')
  const { error: flagsError } = await supabase
    .from('question_flags')
    .delete()
    .not('id', 'is', null)
  if (flagsError) console.error('    Error:', flagsError.message)
  else console.log('    ✓ Done')
  
  // 6. Delete tutor feedback
  console.log('  Deleting tutor_feedback...')
  const { error: feedbackError } = await supabase
    .from('tutor_feedback')
    .delete()
    .not('id', 'is', null)
  if (feedbackError) console.error('    Error:', feedbackError.message)
  else console.log('    ✓ Done')
  
  // 7. Delete jobs
  console.log('  Deleting jobs...')
  const { error: jobsError } = await supabase
    .from('jobs')
    .delete()
    .not('id', 'is', null)
  if (jobsError) console.error('    Error:', jobsError.message)
  else console.log('    ✓ Done')
  
  // 8. Delete PDF exports
  console.log('  Deleting pdf_exports...')
  const { error: pdfError } = await supabase
    .from('pdf_exports')
    .delete()
    .not('id', 'is', null)
  if (pdfError) console.error('    Error:', pdfError.message)
  else console.log('    ✓ Done')
  
  // 9. Delete questions (AI-generated only unless --all)
  if (options.keepManual) {
    console.log('  Deleting AI-generated questions...')
    const { error: qError } = await supabase
      .from('questions')
      .delete()
      .eq('origin', 'ai_generated')
    if (qError) console.error('    Error:', qError.message)
    else console.log('    ✓ Done')
    
    // Also delete variants
    const { error: variantError } = await supabase
      .from('questions')
      .delete()
      .eq('origin', 'variant')
    if (variantError) console.error('    Error deleting variants:', variantError.message)
  } else {
    console.log('  Deleting ALL questions...')
    const { error: qError } = await supabase
      .from('questions')
      .delete()
      .not('id', 'is', null)
    if (qError) console.error('    Error:', qError.message)
    else console.log('    ✓ Done')
  }
  
  // 10. Delete source materials (only with --all)
  if (options.all) {
    console.log('  Deleting source_materials...')
    const { error: matError } = await supabase
      .from('source_materials')
      .delete()
      .not('id', 'is', null)
    if (matError) console.error('    Error:', matError.message)
    else console.log('    ✓ Done')
  }
  
  console.log('\n✅ Cleanup complete!')
  console.log('\n📊 Remaining Data:')
  
  const remaining = {
    questions: await countRecords('questions'),
    topics: await countRecords('topics'),
    students: await countRecords('student_profiles'),
  }
  
  console.log(`  - Questions: ${remaining.questions}`)
  console.log(`  - Topics: ${remaining.topics}`)
  console.log(`  - Student Profiles: ${remaining.students}`)
}

// Parse command line arguments
const args = process.argv.slice(2)
const options: CleanupOptions = {
  all: args.includes('--all'),
  keepManual: !args.includes('--all'),
  dryRun: args.includes('--dry-run'),
}

const workspaceIndex = args.indexOf('--workspace')
if (workspaceIndex !== -1 && args[workspaceIndex + 1]) {
  options.workspaceId = args[workspaceIndex + 1]
}

cleanup(options).catch(console.error)
