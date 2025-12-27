import { NextRequest, NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Generate Topics/Syllabus API
 * 
 * AI-generates topics for a given program/grade level and creates them in the database.
 * Can optionally map from an existing program's topics.
 * 
 * POST /api/syllabus/generate
 * {
 *   name: "IB Math HL Year 1", // Name/description for the syllabus
 *   description?: "...",
 *   targetProgramId?: "...", // Program to create topics for
 *   targetGradeLevelId: "...", // Grade level to create topics for (required)
 *   topicCount: 10, // Number of topics to generate
 *   depth: "standard", // "overview" | "standard" | "detailed"
 *   includeSubtopics: true,
 *   includeLearningObjectives: true,
 *   sourceProgramId?: "...", // Program to map from
 *   sourceGradeLevelId?: "...", // Grade level to map from
 *   customPrompt?: "..." // Additional instructions
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireTutor()
    const supabase = await createServerClient()
    const body = await request.json()
    
    const {
      name,
      description,
      targetGradeLevelId,
      topicCount, // Optional - AI will determine if not specified
      depth = 'standard',
      includeSubtopics = true,
      includeLearningObjectives = true,
      sourceProgramId,
      sourceGradeLevelId,
      customPrompt,
    } = body
    
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    if (!targetGradeLevelId) {
      return NextResponse.json({ error: 'Target grade level is required' }, { status: 400 })
    }
    
    // Verify target grade level exists
    const { data: targetGrade, error: gradeError } = await supabase
      .from('grade_levels')
      .select(`
        id, name, code,
        program:study_programs (
          id, name, code
        )
      `)
      .eq('id', targetGradeLevelId)
      .eq('workspace_id', context.workspaceId)
      .single()
    
    if (gradeError || !targetGrade) {
      return NextResponse.json({ error: 'Target grade level not found' }, { status: 404 })
    }
    
    // Get source topics if mapping from existing program
    let sourceTopics: { name: string; description: string | null }[] = []
    if (sourceProgramId && sourceGradeLevelId) {
      const { data: topics } = await supabase
        .from('topics')
        .select('name, description')
        .eq('workspace_id', context.workspaceId)
        .eq('grade_level_id', sourceGradeLevelId)
        .order('order_index')
      
      sourceTopics = topics || []
    }
    
    // Build the AI prompt
    // Handle the case where program could be an array (Supabase returns array for joins)
    const programData = targetGrade.program
    const program = Array.isArray(programData) ? programData[0] : programData
    const programInfo = program
      ? `${program.name} (${program.code})`
      : 'General curriculum'
    const gradeInfo = `${targetGrade.name} (${targetGrade.code})`
    
    const depthDescriptions: Record<string, string> = {
      overview: 'high-level broad topics',
      standard: 'balanced level of detail',
      detailed: 'granular, specific topics',
    }
    const depthDescription = depthDescriptions[depth as string] || 'balanced level of detail'
    
    // Build dynamic prompt based on whether topic count is specified
    let userPrompt: string
    if (topicCount) {
      // User specified exact count
      userPrompt = `Create a mathematics curriculum with exactly ${topicCount} topics for:
- Program: ${programInfo}
- Grade Level: ${gradeInfo}
- Topic Name/Theme: ${name}
${description ? `- Description: ${description}` : ''}
- Detail Level: ${depthDescription}
${includeSubtopics ? '- Include 3-5 subtopics for each main topic' : ''}
${includeLearningObjectives ? '- Include 2-3 learning objectives for each topic' : ''}`
    } else {
      // AI determines optimal count based on curriculum standards
      userPrompt = `Create a comprehensive mathematics curriculum for:
- Program: ${programInfo}
- Grade Level: ${gradeInfo}
- Topic Name/Theme: ${name}
${description ? `- Description: ${description}` : ''}
- Detail Level: ${depthDescription}
${includeSubtopics ? '- Include 3-5 subtopics for each main topic' : ''}
${includeLearningObjectives ? '- Include 2-3 learning objectives for each topic' : ''}

Determine the optimal number of topics based on:
- Standard curriculum expectations for this program and grade level
- Typical semester/year duration (assume academic year unless specified otherwise)
- International curriculum standards (IB, GCSE, etc.) for this grade level
- Pedagogical best practices for topic coverage and depth

Use your knowledge of curriculum standards to create an appropriate number of topics (typically 8-15 for a semester, 15-25 for a full year).`
    }

    if (sourceTopics.length > 0) {
      userPrompt += `\n\nAdapt the following topics from another curriculum to fit ${programInfo} ${gradeInfo}:\n`
      userPrompt += sourceTopics.map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n')
    }
    
    if (customPrompt) {
      userPrompt += `\n\nAdditional requirements: ${customPrompt}`
    }

    const systemPrompt = `You are an expert curriculum designer specializing in mathematics education.
Create pedagogically-sound topics that follow proper learning progressions.

Guidelines:
- Organize topics from foundational to advanced
- Ensure appropriate difficulty progression
- Include real-world applications where relevant
- Align with the specified curriculum standards

Return your response as a JSON object with this exact structure:
{
  "topics": [
    {
      "name": "Topic name",
      "description": "Comprehensive description and learning objectives",
      "difficulty": 1-5,
      "order_index": 0,
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "learning_objectives": ["Objective 1", "Objective 2"]
    }
  ]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }
    
    const generated = JSON.parse(content)
    
    if (!generated.topics || !Array.isArray(generated.topics)) {
      throw new Error('Invalid response format from AI')
    }
    
    // Create the topics in the database
    const topicsToInsert = generated.topics.map((topic: {
      name: string
      description?: string
      difficulty?: number
      order_index?: number
      subtopics?: string[]
      learning_objectives?: string[]
    }, index: number) => ({
      workspace_id: context.workspaceId,
      name: topic.name,
      description: topic.description || null,
      grade_level_id: targetGradeLevelId,
      order_index: topic.order_index ?? index,
      metadata: {
        difficulty: topic.difficulty,
        subtopics: topic.subtopics || [],
        learning_objectives: topic.learning_objectives || [],
        generated_from: sourceProgramId ? 'mapping' : 'ai',
        source_program_id: sourceProgramId || null,
        source_grade_level_id: sourceGradeLevelId || null,
      },
    }))
    
    const { data: createdTopics, error: insertError } = await supabase
      .from('topics')
      .insert(topicsToInsert)
      .select('id, name')
    
    if (insertError) {
      console.error('Error inserting topics:', insertError)
      return NextResponse.json({ error: 'Failed to save topics' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      topicsCreated: createdTopics?.length || 0,
      topics: createdTopics,
      message: `Created ${createdTopics?.length || 0} topics for ${gradeInfo}`,
    })
    
  } catch (error) {
    console.error('Syllabus generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate syllabus' },
      { status: 500 }
    )
  }
}
