/**
 * Script to sync question program/grade from their topics
 * 
 * This updates questions that don't have primary_program_id or primary_grade_level_id
 * to inherit those values from their associated topic.
 * 
 * Usage: npx ts-node scripts/sync-question-program-grade.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function syncQuestionProgramGrade() {
  console.log('Starting sync of question program/grade from topics...\n')

  // First, get all topics with their program/grade
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, name, program_id, grade_level_id')
    .or('program_id.not.is.null,grade_level_id.not.is.null')

  if (topicsError) {
    console.error('Error fetching topics:', topicsError)
    return
  }

  console.log(`Found ${topics?.length || 0} topics with program/grade set\n`)

  let updatedProgram = 0
  let updatedGrade = 0
  let errors = 0

  for (const topic of topics || []) {
    // Update questions with this topic to have the topic's program if not set
    if (topic.program_id) {
      const { data: programUpdates, error: progError } = await supabase
        .from('questions')
        .update({ primary_program_id: topic.program_id })
        .eq('topic_id', topic.id)
        .is('primary_program_id', null)
        .select('id')

      if (progError) {
        console.error(`Error updating program for topic ${topic.name}:`, progError)
        errors++
      } else if (programUpdates?.length) {
        updatedProgram += programUpdates.length
        console.log(`  ✓ Set program on ${programUpdates.length} questions in "${topic.name}"`)
      }
    }

    // Update questions with this topic to have the topic's grade level if not set
    if (topic.grade_level_id) {
      const { data: gradeUpdates, error: gradeError } = await supabase
        .from('questions')
        .update({ primary_grade_level_id: topic.grade_level_id })
        .eq('topic_id', topic.id)
        .is('primary_grade_level_id', null)
        .select('id')

      if (gradeError) {
        console.error(`Error updating grade for topic ${topic.name}:`, gradeError)
        errors++
      } else if (gradeUpdates?.length) {
        updatedGrade += gradeUpdates.length
        console.log(`  ✓ Set grade level on ${gradeUpdates.length} questions in "${topic.name}"`)
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Questions updated with program: ${updatedProgram}`)
  console.log(`Questions updated with grade level: ${updatedGrade}`)
  if (errors > 0) {
    console.log(`Errors: ${errors}`)
  }
  console.log('\nDone!')
}

syncQuestionProgramGrade().catch(console.error)
