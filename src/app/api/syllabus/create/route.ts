import { NextRequest, NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface TopicData {
  name: string
  description: string
  difficulty: number
  questionCount: number
  subtopics?: string[]
}

interface SyllabusData {
  title: string
  description: string
  grade: string
  curriculum: string
  topics: TopicData[]
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTutor()
    const supabase = await createServerClient()
    const body = await request.json()
    
    const { syllabus, questionsPerTopic } = body as { syllabus: SyllabusData; questionsPerTopic: number }
    
    if (!syllabus || !syllabus.topics || syllabus.topics.length === 0) {
      return NextResponse.json({ error: 'Invalid syllabus data' }, { status: 400 })
    }
    
    const createdTopics: { id: string; name: string; questionCount: number; difficulty: number; subtopics?: string[] }[] = []
    
    // Create topics in database
    for (const topic of syllabus.topics) {
      // First check if topic with this name already exists
      const { data: existingTopic } = await supabase
        .from('topics')
        .select('id')
        .eq('workspace_id', context.workspaceId)
        .eq('name', topic.name)
        .single()
      
      if (existingTopic) {
        // Use existing topic
        createdTopics.push({
          id: existingTopic.id,
          name: topic.name,
          questionCount: topic.questionCount || questionsPerTopic,
          difficulty: topic.difficulty,
          subtopics: topic.subtopics
        })
        continue
      }
      
      const { data: createdTopic, error: topicError } = await supabase
        .from('topics')
        .insert({
          workspace_id: context.workspaceId,
          name: topic.name,
          description: topic.description,
          tags: topic.subtopics || []
        })
        .select()
        .single()
      
      if (topicError) {
        console.error('Failed to create topic:', topicError)
        continue
      }
      
      createdTopics.push({
        id: createdTopic.id,
        name: topic.name,
        questionCount: topic.questionCount || questionsPerTopic,
        difficulty: topic.difficulty,
        subtopics: topic.subtopics
      })
    }
    
    if (createdTopics.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to create any topics. Topics may already exist with these names.',
        details: syllabus.topics.map((t: TopicData) => t.name)
      }, { status: 500 })
    }
    
    // Generate questions for each topic directly (synchronously)
    let totalQuestionsGenerated = 0
    const errors: string[] = []
    
    for (const topic of createdTopics) {
      try {
        const questionsGenerated = await generateQuestionsForTopic(
          supabase,
          context.workspaceId,
          context.userId,
          topic,
          syllabus,
          questionsPerTopic
        )
        totalQuestionsGenerated += questionsGenerated
      } catch (error) {
        console.error(`Failed to generate questions for ${topic.name}:`, error)
        errors.push(`${topic.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      topicsCreated: createdTopics.length,
      questionsGenerated: totalQuestionsGenerated,
      errors: errors.length > 0 ? errors : undefined
    })
    
  } catch (error) {
    console.error('Syllabus creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create syllabus' },
      { status: 500 }
    )
  }
}

const QUESTION_SYSTEM_PROMPT = `You are an expert math curriculum designer. Generate high-quality practice questions.

Guidelines:
1. Match curriculum standards when specified
2. Use clear language appropriate for grade level
3. Include step-by-step hints
4. Use LaTeX for math (wrap in \\( \\) inline or \\[ \\] display)
5. Vary styles: calculation, word problems, proofs
6. Ensure mathematical correctness
7. Match difficulty (1=easy, 5=hard)

Return JSON with "questions" array. Each question:
{
  "promptText": "Question text",
  "promptLatex": "LaTeX version if needed", 
  "answerType": "exact|numeric|multiple_choice",
  "correctAnswer": {"value": "answer"},
  "difficulty": 1-5,
  "hints": ["hint1"],
  "solutionSteps": ["step1"],
  "tags": ["tag1"]
}`

async function generateQuestionsForTopic(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  workspaceId: string,
  userId: string,
  topic: { id: string; name: string; questionCount: number; difficulty: number; subtopics?: string[] },
  syllabus: SyllabusData,
  questionsPerTopic: number
): Promise<number> {
  const count = topic.questionCount || questionsPerTopic
  
  // Build context
  const contextPrompt = `
Curriculum: ${syllabus.curriculum}
Grade Level: ${syllabus.grade}
Course: ${syllabus.title}`

  const subtopicsPrompt = topic.subtopics?.length 
    ? `\nSubtopics to cover: ${topic.subtopics.join(', ')}`
    : ''

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: QUESTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate ${count} practice questions for:

Topic: ${topic.name}
${contextPrompt}
${subtopicsPrompt}

Target difficulty around ${topic.difficulty} (1-5 scale), with some variation.
Return a JSON object with a "questions" array of exactly ${count} questions.`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
    temperature: 0.8,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')
  const questions = result.questions || []

  if (questions.length === 0) {
    throw new Error('No questions generated by AI')
  }

  // Insert questions
  const questionsToInsert = questions.map((q: {
    promptText: string
    promptLatex?: string
    answerType?: string
    correctAnswer: { value: string | number }
    difficulty?: number
    hints?: string[]
    solutionSteps?: string[]
    tags?: string[]
  }) => ({
    workspace_id: workspaceId,
    topic_id: topic.id,
    origin: 'ai_generated',
    status: 'active',
    prompt_text: q.promptText,
    prompt_latex: q.promptLatex || null,
    answer_type: q.answerType || 'exact',
    correct_answer_json: q.correctAnswer,
    difficulty: q.difficulty || topic.difficulty,
    hints_json: q.hints || [],
    solution_steps_json: q.solutionSteps || [],
    tags_json: [...(q.tags || []), topic.name, syllabus.curriculum, syllabus.grade].filter(Boolean),
    quality_score: 1.0,
    created_by: userId,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select('id')

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`)
  }

  return inserted?.length || 0
}
