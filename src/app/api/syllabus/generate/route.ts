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
 * AI-generates a hierarchical topic structure for a given program/grade level.
 * Creates UNITS as parent topics and SUBTOPICS as child topics with parent_id set.
 * 
 * Structure Example:
 *   Unit 1: Number (parent topic)
 *     ├── 1A. Exponents and Surds (child topic)
 *     └── 1B. Sequences (child topic)
 *   Unit 2: Algebra (parent topic)
 *     ├── 2A. Algebra (child topic)
 *     └── 2B. Equations (child topic)
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
      topicCount,
      depth = 'standard',
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
    
    // Build dynamic prompt
    let userPrompt: string
    if (topicCount) {
      userPrompt = `Create a mathematics curriculum with exactly ${topicCount} UNITS for:
- Program: ${programInfo}
- Grade Level: ${gradeInfo}
- Topic Name/Theme: ${name}
${description ? `- Description: ${description}` : ''}
- Detail Level: ${depthDescription}

IMPORTANT STRUCTURE REQUIREMENTS:
- Create ${topicCount} main UNITS (e.g., "Number", "Algebra", "Functions", "Geometry")
- Each UNIT MUST have 2-5 SUBTOPICS that belong to that unit
- UNITS are broad categories, SUBTOPICS are specific skill areas within each unit
${includeLearningObjectives ? '- Include 2-3 learning objectives for each SUBTOPIC' : ''}`
    } else {
      userPrompt = `Create a comprehensive mathematics curriculum for:
- Program: ${programInfo}
- Grade Level: ${gradeInfo}
- Topic Name/Theme: ${name}
${description ? `- Description: ${description}` : ''}
- Detail Level: ${depthDescription}

IMPORTANT STRUCTURE REQUIREMENTS:
- Create main UNITS (e.g., "Number", "Algebra", "Functions", "Geometry", "Statistics & Probability")
- Each UNIT MUST have 2-5 SUBTOPICS that belong to that unit
- UNITS are broad categories (typically 4-8 for a year), SUBTOPICS are specific skill areas
${includeLearningObjectives ? '- Include 2-3 learning objectives for each SUBTOPIC' : ''}`
    }

    if (sourceTopics.length > 0) {
      userPrompt += `\n\nAdapt the following topics from another curriculum:\n`
      userPrompt += sourceTopics.map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n')
    }
    
    if (customPrompt) {
      userPrompt += `\n\nCURRICULUM OUTLINE/REQUIREMENTS - PARSE THIS CAREFULLY:
The user has provided a detailed curriculum outline below. You MUST:
1. Extract each UNIT (typically marked as "Unit 1:", "Unit 2:", etc.)
2. Extract each SUBTOPIC within each unit (typically marked as "1A.", "1B.", "2A.", etc. or bullet points)
3. Extract any learning objectives or bullet points listed under each subtopic
4. Preserve the exact names and structure from this outline

USER'S CURRICULUM OUTLINE:
${customPrompt}

IMPORTANT: Create subtopics for EVERY unit listed above. Each subtopic should include the learning objectives/bullet points as its description.`
    }

    const systemPrompt = `You are an expert curriculum designer specializing in mathematics education.

CRITICAL REQUIREMENTS:
1. You MUST create a HIERARCHICAL structure with UNITS and SUBTOPICS
2. Every UNIT must have at least 2 SUBTOPICS - this is mandatory!
3. If the user provides a curriculum outline, follow it EXACTLY
4. NEVER name a subtopic the same as its parent unit (e.g., if unit is "Algebra", subtopics should be "Algebraic Expressions", "Equations", NOT "Algebra")

Structure:
- UNITS: Broad categories (e.g., "Number", "Algebra", "Geometry")
- SUBTOPICS: Specific topics within each unit (e.g., "Exponents and Surds", "Sequences", "Algebraic Expressions")
- Subtopic names MUST be distinct from their parent unit name

RESPONSE FORMAT - You MUST return valid JSON with this EXACT structure:
{
  "units": [
    {
      "name": "Number",
      "description": "Brief description of this unit",
      "order_index": 0,
      "subtopics": [
        {
          "name": "Exponents and Surds",
          "description": "Covers laws of exponents, simplifying expressions, introduction to surds",
          "order_index": 0,
          "difficulty": 2,
          "learning_objectives": [
            "Laws of exponents including multiplication, division, powers of powers",
            "Simplifying expressions with integer and fractional indices",
            "Introduction to surds and simplifying radical expressions"
          ]
        },
        {
          "name": "Sequences",
          "description": "Recognizing patterns, arithmetic sequences, finding nth term",
          "order_index": 1,
          "difficulty": 2,
          "learning_objectives": ["Recognising and extending number patterns", "Arithmetic sequences"]
        }
      ]
    }
  ]
}

REMEMBER: Every unit in the "units" array MUST have a "subtopics" array with at least 2 items! No exceptions!`

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
    
    console.log('AI Response:', content)
    
    const generated = JSON.parse(content)
    
    if (!generated.units || !Array.isArray(generated.units)) {
      console.error('Invalid AI response structure:', generated)
      throw new Error('Invalid response format from AI - expected "units" array')
    }
    
    console.log(`Parsed ${generated.units.length} units from AI response`)
    
    // Validate that units have subtopics
    let totalExpectedSubtopics = 0
    generated.units.forEach((unit: { name: string; subtopics?: unknown[] }, idx: number) => {
      const subtopicCount = unit.subtopics?.length || 0
      console.log(`Unit ${idx + 1}: "${unit.name}" has ${subtopicCount} subtopics`)
      totalExpectedSubtopics += subtopicCount
    })
    console.log(`Total expected subtopics: ${totalExpectedSubtopics}`)
    
    // Get the program_id from the grade level
    const programId = program?.id || null
    console.log(`Program ID: ${programId}, Grade Level ID: ${targetGradeLevelId}`)
    
    // Get existing topic names to avoid conflicts
    const { data: existingTopics } = await supabase
      .from('topics')
      .select('name')
      .eq('workspace_id', context.workspaceId)
    
    const existingNames = new Set(existingTopics?.map(t => t.name.toLowerCase()) || [])
    
    // Create UNIT topics (parent topics) first
    const unitTopics = generated.units.map((unit: {
      name: string
      description?: string
      order_index?: number
    }, index: number) => ({
      workspace_id: context.workspaceId,
      name: unit.name,
      description: unit.description || null,
      parent_id: null,
      program_id: programId,
      grade_level_id: targetGradeLevelId,
      order_index: unit.order_index ?? index,
      is_core: true,
      metadata: {
        type: 'unit',
        generated_from: sourceProgramId ? 'mapping' : 'ai',
        source_program_id: sourceProgramId || null,
        source_grade_level_id: sourceGradeLevelId || null,
      },
    }))
    
    // Insert units first
    console.log(`Inserting ${unitTopics.length} units...`)
    const { data: createdUnits, error: unitsError } = await supabase
      .from('topics')
      .insert(unitTopics)
      .select('id, name')
    
    if (unitsError) {
      console.error('Error inserting units:', unitsError)
      return NextResponse.json({ error: `Failed to save units: ${unitsError.message}` }, { status: 500 })
    }
    
    console.log(`Successfully created ${createdUnits?.length || 0} units:`, createdUnits?.map(u => u.name))
    
    // Now create subtopics with parent_id pointing to their unit
    const subtopicsToInsert: Array<{
      workspace_id: string
      name: string
      description: string | null
      parent_id: string
      program_id: string | null
      grade_level_id: string
      order_index: number
      is_core: boolean
      metadata: Record<string, unknown>
    }> = []
    
    generated.units.forEach((unit: {
      name: string
      subtopics?: Array<{
        name: string
        description?: string
        order_index?: number
        difficulty?: number
        learning_objectives?: string[]
      }>
    }, unitIndex: number) => {
      const parentUnit = createdUnits?.find(u => u.name === unit.name)
      if (!parentUnit) {
        console.warn(`Could not find parent unit for: ${unit.name}`)
        return
      }
      if (!unit.subtopics || unit.subtopics.length === 0) {
        console.warn(`No subtopics for unit: ${unit.name}`)
        return
      }
      
      console.log(`Processing ${unit.subtopics.length} subtopics for unit: ${unit.name}`)
      
      unit.subtopics.forEach((subtopic, subIndex) => {
        let subtopicName = subtopic.name
        
        // Check for name conflict with existing topics or the parent unit
        if (existingNames.has(subtopicName.toLowerCase()) || subtopicName.toLowerCase() === unit.name.toLowerCase()) {
          // Rename by appending a descriptive suffix
          const originalName = subtopicName
          subtopicName = `${subtopicName} - Fundamentals`
          console.warn(`Name conflict detected: "${originalName}" conflicts with existing topic. Renamed to: "${subtopicName}"`)
        }
        
        // Add the new name to our set
        existingNames.add(subtopicName.toLowerCase())
        
        subtopicsToInsert.push({
          workspace_id: context.workspaceId,
          name: subtopicName,
          description: subtopic.description || null,
          parent_id: parentUnit.id,
          program_id: programId,
          grade_level_id: targetGradeLevelId,
          order_index: subtopic.order_index ?? subIndex,
          is_core: false,
          metadata: {
            type: 'subtopic',
            difficulty: subtopic.difficulty,
            learning_objectives: subtopic.learning_objectives || [],
            unit_order: unitIndex,
            generated_from: sourceProgramId ? 'mapping' : 'ai',
            original_name: subtopic.name !== subtopicName ? subtopic.name : undefined,
          },
        })
      })
    })
    
    console.log(`Total subtopics to insert: ${subtopicsToInsert.length}`)
    
    // Insert subtopics
    let createdSubtopics: Array<{ id: string; name: string }> | null = null
    if (subtopicsToInsert.length > 0) {
      console.log(`Inserting ${subtopicsToInsert.length} subtopics...`)
      const { data: subs, error: subsError } = await supabase
        .from('topics')
        .insert(subtopicsToInsert)
        .select('id, name')
      
      if (subsError) {
        console.error('Error inserting subtopics:', subsError)
        return NextResponse.json({
          success: true,
          warning: `Units created but subtopics failed: ${subsError.message}`,
          topicsCreated: createdUnits?.length || 0,
          unitsCreated: createdUnits?.length || 0,
          subtopicsCreated: 0,
          units: createdUnits,
          subtopics: null,
        })
      } else {
        createdSubtopics = subs
        console.log(`Successfully created ${subs?.length || 0} subtopics`)
      }
    } else {
      console.warn('No subtopics to insert - check AI response format')
    }
    
    const totalCreated = (createdUnits?.length || 0) + (createdSubtopics?.length || 0)
    
    return NextResponse.json({
      success: true,
      topicsCreated: totalCreated,
      unitsCreated: createdUnits?.length || 0,
      subtopicsCreated: createdSubtopics?.length || 0,
      units: createdUnits,
      subtopics: createdSubtopics,
      message: `Created ${createdUnits?.length || 0} units with ${createdSubtopics?.length || 0} subtopics for ${gradeInfo}`,
    })
    
  } catch (error) {
    console.error('Syllabus generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate syllabus' },
      { status: 500 }
    )
  }
}
