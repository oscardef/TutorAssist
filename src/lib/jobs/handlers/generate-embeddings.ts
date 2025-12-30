import { createAdminClient } from '@/lib/supabase/server'
import type { Job } from '@/lib/types'
import OpenAI from 'openai'
import crypto from 'crypto'

const openai = new OpenAI()

// Job handler to generate embeddings for questions
export async function handleGenerateEmbedding(job: Job): Promise<void> {
  const { questionId, questionIds } = job.payload_json as {
    questionId?: string
    questionIds?: string[]
  }

  const idsToProcess = questionIds || (questionId ? [questionId] : [])
  
  if (idsToProcess.length === 0) {
    console.log('[Embeddings] No question IDs provided')
    return
  }

  console.log(`[Embeddings] Processing ${idsToProcess.length} questions for workspace ${job.workspace_id}`)
  
  const supabase = await createAdminClient()

  // Fetch questions
  const { data: questions, error: fetchError } = await supabase
    .from('questions')
    .select('id, prompt_text, prompt_latex, tags_json, topics(name)')
    .in('id', idsToProcess)
    .eq('workspace_id', job.workspace_id)

  if (fetchError || !questions || questions.length === 0) {
    console.error('[Embeddings] Failed to fetch questions:', fetchError)
    return
  }

  // Process each question
  for (const question of questions) {
    try {
      // Build text for embedding (combine prompt, tags, topic)
      const topicData = question.topics as { name: string }[] | null
      const topicName = topicData?.[0]?.name || ''
      const tags = Array.isArray(question.tags_json) ? question.tags_json.join(' ') : ''
      
      const textForEmbedding = [
        question.prompt_text,
        question.prompt_latex,
        topicName,
        tags,
      ].filter(Boolean).join(' ')

      // Calculate hash to check if we need to update
      const textHash = crypto
        .createHash('md5')
        .update(textForEmbedding)
        .digest('hex')

      // Check if embedding exists and is current
      const { data: existing } = await supabase
        .from('question_embeddings')
        .select('text_hash')
        .eq('question_id', question.id)
        .single()

      if (existing?.text_hash === textHash) {
        console.log(`[Embeddings] Question ${question.id} embedding is current, skipping`)
        continue
      }

      // Generate embedding using OpenAI
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: textForEmbedding,
        dimensions: 1536,
      })

      const embedding = embeddingResponse.data[0].embedding

      // Upsert embedding
      const { error: upsertError } = await supabase
        .from('question_embeddings')
        .upsert({
          question_id: question.id,
          workspace_id: job.workspace_id,
          embedding: JSON.stringify(embedding), // pgvector accepts JSON array
          text_hash: textHash,
          embedding_model: 'text-embedding-3-small',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'question_id',
        })

      if (upsertError) {
        console.error(`[Embeddings] Failed to upsert embedding for ${question.id}:`, upsertError)
      } else {
        console.log(`[Embeddings] Generated embedding for question ${question.id}`)
      }
    } catch (err) {
      console.error(`[Embeddings] Error processing question ${question.id}:`, err)
    }
  }

  console.log(`[Embeddings] Completed processing ${questions.length} questions`)
}

// Utility to generate embedding for a single text (for API use)
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536,
    })
    return response.data[0].embedding
  } catch (err) {
    console.error('[Embeddings] Failed to generate embedding:', err)
    return null
  }
}

// Find similar questions by embedding
export async function findSimilarQuestions(
  questionId: string,
  workspaceId: string,
  options: {
    threshold?: number
    limit?: number
  } = {}
): Promise<{ questionId: string; similarity: number }[]> {
  const { threshold = 0.75, limit = 10 } = options
  
  const supabase = await createAdminClient()

  // Use the database function for efficient search
  const { data, error } = await supabase.rpc('find_similar_questions', {
    target_question_id: questionId,
    target_workspace_id: workspaceId,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error('[Embeddings] Failed to find similar questions:', error)
    return []
  }

  return (data || []).map((row: { question_id: string; similarity: number }) => ({
    questionId: row.question_id,
    similarity: row.similarity,
  }))
}

// Batch generate embeddings for all questions in a workspace
export async function generateAllEmbeddings(workspaceId: string): Promise<number> {
  const supabase = await createAdminClient()
  
  // Get all question IDs that don't have embeddings
  const { data: questionsWithoutEmbeddings, error } = await supabase
    .from('questions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .not('id', 'in', 
      supabase
        .from('question_embeddings')
        .select('question_id')
        .eq('workspace_id', workspaceId)
    )

  if (error || !questionsWithoutEmbeddings) {
    console.error('[Embeddings] Failed to get questions without embeddings:', error)
    return 0
  }

  // Process in batches of 100
  const batchSize = 100
  let processed = 0

  for (let i = 0; i < questionsWithoutEmbeddings.length; i += batchSize) {
    const batch = questionsWithoutEmbeddings.slice(i, i + batchSize)
    const questionIds = batch.map(q => q.id)
    
    // Create a job for this batch
    await supabase.from('jobs').insert({
      workspace_id: workspaceId,
      type: 'GENERATE_EMBEDDINGS',
      status: 'pending',
      payload_json: { questionIds },
      priority: 0,
    })
    
    processed += batch.length
  }

  return processed
}
