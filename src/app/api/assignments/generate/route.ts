import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { 
  ASSIGNMENT_GENERATION_SYSTEM_PROMPT,
  ANSWER_FORMAT_SPEC,
  stripLatexToPlainText,
  normalizeAnswer,
} from '@/lib/prompts/question-generation'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface StudentHistory {
  topicsStruggled: { topicId: string; topicName: string; errorRate: number }[]
  recentTopics: string[]
  averageDifficulty: number
  totalAttempts: number
  overallAccuracy: number
}

interface GenerateAssignmentRequest {
  studentId?: string      // Legacy: single student
  studentIds?: string[]   // New: multiple students
  prompt?: string         // Legacy: AI prompt
  title?: string          // New: assignment title
  topicIds?: string[]     // Topics to draw questions from
  questionCount?: number
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive'
  dueDate?: string        // New: ISO date string
  instructions?: string   // New: instructions for students
  customPrompt?: string   // Custom AI prompt for generation
  options?: {             // New: additional options
    timeLimit?: number | null
    shuffleQuestions?: boolean
    showResultsImmediately?: boolean
    splitIntoSubAssignments?: boolean
    questionsPerSubAssignment?: number
    useExistingQuestions?: boolean
    generateNewQuestions?: boolean
    focusOnWeakAreas?: boolean
  }
  includeMarkscheme?: boolean
  includeSolutionSteps?: boolean
  focusOnWeakAreas?: boolean
}

interface SelectedQuestion {
  id: string
  promptText: string
  promptLatex?: string
  difficulty: number
  topicName: string
  answerType: string
  correctAnswer: unknown
  hints?: string[]
  solutionSteps?: unknown[]
  isGenerated?: boolean
}

interface GeneratedAssignment {
  title: string
  description: string
  questions: SelectedQuestion[]
  suggestedDueDate: string
  estimatedMinutes: number
  topicsCovered: string[]
  difficultyBreakdown: { easy: number; medium: number; hard: number }
}

// Get student's learning history and weak areas
async function getStudentHistory(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  studentProfileId: string,
  workspaceId: string
): Promise<StudentHistory> {
  // Get student profile to find user_id
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('user_id')
    .eq('id', studentProfileId)
    .single()

  if (!profile?.user_id) {
    return {
      topicsStruggled: [],
      recentTopics: [],
      averageDifficulty: 3,
      totalAttempts: 0,
      overallAccuracy: 0,
    }
  }

  // Get attempts with question info
  const { data: attempts } = await supabase
    .from('attempts')
    .select(`
      is_correct,
      question_id,
      questions!inner(
        difficulty,
        topic_id,
        topics(id, name)
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('student_user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!attempts || attempts.length === 0) {
    return {
      topicsStruggled: [],
      recentTopics: [],
      averageDifficulty: 3,
      totalAttempts: 0,
      overallAccuracy: 0,
    }
  }

  // Calculate topic performance
  const topicStats: Record<string, { correct: number; total: number; name: string }> = {}
  let totalCorrect = 0
  let totalDifficulty = 0
  const recentTopicIds: string[] = []

  for (const attempt of attempts) {
    const questions = attempt.questions as unknown as {
      difficulty: number
      topic_id: string
      topics: { id: string; name: string }[] | null
    }[] | null
    const question = questions?.[0]
    
    if (question?.topics?.[0]) {
      const topicId = question.topics[0].id
      const topicName = question.topics[0].name

      if (!topicStats[topicId]) {
        topicStats[topicId] = { correct: 0, total: 0, name: topicName }
      }
      topicStats[topicId].total++
      if (attempt.is_correct) {
        topicStats[topicId].correct++
        totalCorrect++
      }

      if (!recentTopicIds.includes(topicId) && recentTopicIds.length < 5) {
        recentTopicIds.push(topicId)
      }

      totalDifficulty += question.difficulty || 3
    }
  }

  // Find topics where student struggles (error rate > 40%)
  const topicsStruggled = Object.entries(topicStats)
    .map(([topicId, stats]) => ({
      topicId,
      topicName: stats.name,
      errorRate: 1 - (stats.correct / stats.total),
    }))
    .filter((t) => t.errorRate > 0.4 && topicStats[t.topicId].total >= 3)
    .sort((a, b) => b.errorRate - a.errorRate)

  return {
    topicsStruggled,
    recentTopics: recentTopicIds,
    averageDifficulty: totalDifficulty / attempts.length,
    totalAttempts: attempts.length,
    overallAccuracy: totalCorrect / attempts.length,
  }
}

// Generate new questions for an assignment and save them to the Question Bank
async function generateQuestionsForAssignment(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  workspaceId: string,
  userId: string,
  topics: { id: string; name: string; description?: string | null }[],
  count: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' | 'adaptive',
  customPrompt?: string,
  focusOnWeakAreas?: boolean
): Promise<{ id: string }[]> {
  if (topics.length === 0) {
    console.log('No topics provided for question generation')
    throw new Error('No topics selected for question generation')
  }
  
  if (count <= 0) {
    return []
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured')
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment.')
  }

  // Build the generation prompt
  const topicContext = topics.map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n')
  
  const difficultyGuidance = {
    easy: 'Focus on basic concepts and straightforward applications. Difficulty level 1-2.',
    medium: 'Include moderate complexity with some multi-step problems. Difficulty level 2-4.',
    hard: 'Create challenging problems requiring deep understanding and multiple concepts. Difficulty level 4-5.',
    mixed: 'Create a balanced mix of easy (30%), medium (40%), and hard (30%) questions.',
    adaptive: 'Create a variety of difficulty levels to assess student understanding.',
  }[difficulty]

  const systemPrompt = `You are an expert math tutor creating practice questions. Generate exactly ${count} math questions covering the following topics:

${topicContext}

Difficulty guidance: ${difficultyGuidance}
${customPrompt ? `\nAdditional instructions: ${customPrompt}` : ''}
${focusOnWeakAreas ? '\nFocus on challenging areas that students commonly struggle with.' : ''}

## CRITICAL: LaTeX Formatting Rules
Use \\( ... \\) for inline math and \\[ ... \\] for display math. NEVER use bare $ delimiters.

## Question Types
Vary the question types! Use a mix of:
- "short_answer" - Single value/expression (e.g., "7", "x+2")
- "numeric" - Numerical answer with tolerance (for calculations)
- "multiple_choice" - 4 options with one correct
- "expression" - Algebraic expressions (e.g., "2x+3", "x^2-4")
- "true_false" - True/False statements

${ANSWER_FORMAT_SPEC}

## IMPORTANT: Answer Consistency
For answers that could be written multiple ways, ALWAYS include alternates:
- Roots/zeros: value "(-2, 2)" with alternates ["-2, 2", "x = -2, x = 2", "x = ±2", "-2 and 2"]
- Fractions: value "1/2" with alternates ["0.5", "1/2"]
- Expressions: value "2x + 3" with alternates ["3 + 2x", "2*x + 3"]

For each question, provide:
1. questionText - The question with LaTeX (use \\( inline \\) or \\[ display \\])
2. answerType - One of the types above
3. correctAnswer - Object with "value", "latex", and "alternates" array
4. difficulty - Number from 1-5
5. topicName - Which topic this relates to
6. hints - Array of 2-3 helpful hints with LaTeX where appropriate
7. solutionSteps - Array of objects: {"step": "description", "latex": "\\\\(math work\\\\)", "result": "intermediate result"}

Respond with a JSON object: { "questions": [...] }`

  try {
    console.log(`Calling OpenAI to generate ${count} questions for topics: ${topics.map(t => t.name).join(', ')}`)
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate ${count} questions now.` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8000, // Increased to avoid truncation
      temperature: 0.8,
    })

    const content = response.choices[0].message.content
    console.log('OpenAI response received, parsing...')
    
    // Try to parse the JSON, with recovery for truncated responses
    let result: { questions?: unknown[] }
    try {
      result = JSON.parse(content || '{"questions": []}')
    } catch (parseError) {
      // Try to salvage truncated JSON by finding the last complete question
      console.warn('JSON parse failed, attempting to recover truncated response...')
      const truncatedContent = content || ''
      
      // Find the last complete object in the questions array
      const questionsMatch = truncatedContent.match(/"questions"\s*:\s*\[/)
      if (questionsMatch) {
        // Find all complete question objects (ending with })
        const questionPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
        const matches = truncatedContent.match(questionPattern) || []
        
        if (matches.length > 0) {
          // Reconstruct valid JSON with complete questions only
          const validQuestions = matches.slice(0, -1) // Skip last potentially incomplete one
          if (validQuestions.length > 0) {
            try {
              const reconstructed = `{"questions": [${validQuestions.join(',')}]}`
              result = JSON.parse(reconstructed)
              console.log(`Recovered ${validQuestions.length} questions from truncated response`)
            } catch {
              throw new Error('Failed to parse AI response - JSON was truncated')
            }
          } else {
            throw new Error('Failed to parse AI response - JSON was truncated')
          }
        } else {
          throw new Error('Failed to parse AI response - JSON was truncated')
        }
      } else {
        throw new Error('Failed to parse AI response - invalid JSON structure')
      }
    }
    
    const generatedQuestions = (result.questions || []) as Array<{
      questionText?: string
      answerType?: string
      correctAnswer?: unknown
      difficulty?: number
      topicName?: string
      hints?: string[]
      solutionSteps?: unknown[]
    }>

    if (generatedQuestions.length === 0) {
      console.log('No questions in OpenAI response')
      throw new Error('AI returned no questions')
    }
    
    console.log(`Parsed ${generatedQuestions.length} questions from AI response`)

    // Map topic names to IDs
    const topicNameToId = new Map(topics.map(t => [t.name.toLowerCase(), t.id]))

    // Save questions to the database
    const questionsToInsert = generatedQuestions.map((q) => {
      // Find matching topic
      const topicId = topicNameToId.get(q.topicName?.toLowerCase() || '') || topics[0]?.id
      
      // Normalize answer type - map to supported types
      let answerType = 'short_answer'
      const inputType = q.answerType?.toLowerCase() || ''
      if (inputType === 'multiple_choice') answerType = 'multiple_choice'
      else if (inputType === 'numeric') answerType = 'short_answer'
      else if (inputType === 'exact' || inputType === 'short_answer') answerType = 'short_answer'
      else if (inputType === 'expression') answerType = 'short_answer'
      else if (inputType === 'true_false') answerType = 'short_answer'

      // Normalize correct answer - preserve alternates for answer checking
      let correctAnswerJson: unknown
      const answer = q.correctAnswer as Record<string, unknown> | string | undefined
      
      if (q.answerType === 'multiple_choice' && typeof answer === 'object' && answer !== null) {
        // Multiple choice - keep as-is with choices array
        correctAnswerJson = answer
      } else if (typeof answer === 'object' && answer !== null) {
        // Object with value, latex, alternates - preserve all fields
        correctAnswerJson = {
          value: String((answer as Record<string, unknown>).value || ''),
          latex: (answer as Record<string, unknown>).latex || undefined,
          alternates: Array.isArray((answer as Record<string, unknown>).alternates) 
            ? (answer as Record<string, unknown>).alternates 
            : undefined,
          tolerance: (answer as Record<string, unknown>).tolerance || undefined,
        }
      } else {
        // Simple string/number answer
        correctAnswerJson = { value: String(answer || '') }
      }

      return {
        workspace_id: workspaceId,
        topic_id: topicId,
        origin: 'ai_generated' as const,
        status: 'active' as const,
        prompt_text: stripLatexToPlainText(q.questionText || ''),
        prompt_latex: q.questionText || '',
        answer_type: answerType,
        correct_answer_json: correctAnswerJson,
        difficulty: Math.min(5, Math.max(1, q.difficulty || 3)),
        hints_json: q.hints || [],
        solution_steps_json: q.solutionSteps || [],
        created_by: userId,
        generation_metadata: {
          model: 'gpt-4o-mini',
          generated_at: new Date().toISOString(),
          source: 'assignment_generation',
          custom_prompt: customPrompt || null,
        },
      }
    })

    console.log(`Inserting ${questionsToInsert.length} questions into database`)
    
    // Insert all questions
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('id')

    if (insertError) {
      console.error('Failed to insert generated questions:', insertError)
      throw new Error(`Database insert failed: ${insertError.message}`)
    }

    console.log(`Successfully inserted ${insertedQuestions?.length || 0} questions`)
    return insertedQuestions || []
  } catch (error) {
    console.error('Error generating questions for assignment:', error)
    throw error // Re-throw so caller can handle it
  }
}

// AI function to select and generate questions
async function generateAssignmentWithAI(
  prompt: string,
  studentHistory: StudentHistory,
  availableQuestions: SelectedQuestion[],
  topics: { id: string; name: string }[],
  options: GenerateAssignmentRequest
): Promise<GeneratedAssignment> {
  const targetCount = options.questionCount || 10
  const difficulty = options.difficulty || 'adaptive'
  
  // Build context about student for AI
  const studentContext = studentHistory.totalAttempts > 0
    ? `
Student Performance Context:
- Overall accuracy: ${Math.round(studentHistory.overallAccuracy * 100)}%
- Average difficulty handled: ${studentHistory.averageDifficulty.toFixed(1)}/5
- Topics they struggle with: ${studentHistory.topicsStruggled.map(t => `${t.topicName} (${Math.round(t.errorRate * 100)}% error rate)`).join(', ') || 'None identified'}
- Recent topics practiced: ${studentHistory.recentTopics.length > 0 ? 'Has recent practice history' : 'New student'}
${options.focusOnWeakAreas ? '- PRIORITY: Focus on weak areas to help improvement' : ''}
`
    : 'New student - no practice history available.'

  // Format available questions for AI
  const questionsContext = availableQuestions.slice(0, 50).map((q, i) => ({
    index: i,
    id: q.id,
    topic: q.topicName,
    difficulty: q.difficulty,
    preview: q.promptText.slice(0, 100),
  }))

  const topicsContext = topics.map(t => t.name).join(', ')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',  // Use cheaper model for assignment selection
    messages: [
      { role: 'system', content: ASSIGNMENT_GENERATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `
Tutor's Request: "${prompt}"

Target Question Count: ${targetCount}
Difficulty Setting: ${difficulty}
Include Solutions/Markscheme: ${options.includeMarkscheme ? 'Yes' : 'No'}
Include Step-by-Step: ${options.includeSolutionSteps ? 'Yes' : 'No'}

${studentContext}

Available Topics: ${topicsContext}

Available Questions from Question Bank:
${JSON.stringify(questionsContext, null, 2)}

Please create an assignment based on these requirements.
- Prefer selecting from existing questions when they match the requirements
- Only generate new questions if needed to fill gaps
- Remember: Use \\( \\) for inline math in any new questions`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    temperature: 0.7,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  // Map selected questions
  const selectedQuestions: SelectedQuestion[] = []
  
  // Add selected existing questions
  for (const idx of result.selectedQuestionIndices || []) {
    if (availableQuestions[idx]) {
      selectedQuestions.push(availableQuestions[idx])
    }
  }

  // Add newly generated questions - normalize them properly
  for (const newQ of result.newQuestions || []) {
    // Handle different field names from AI (questionLatex vs promptLatex)
    const questionText = newQ.questionLatex || newQ.promptLatex || newQ.promptText
    
    selectedQuestions.push({
      id: `generated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      promptText: stripLatexToPlainText(questionText),
      promptLatex: questionText,
      difficulty: Math.min(5, Math.max(1, newQ.difficulty || 3)),
      topicName: newQ.topicName,
      answerType: newQ.answerType || 'exact',
      correctAnswer: normalizeAnswer(newQ.correctAnswer, newQ.answerType || 'exact'),
      hints: Array.isArray(newQ.hints) ? newQ.hints : [],
      solutionSteps: Array.isArray(newQ.solutionSteps) ? newQ.solutionSteps : [],
      isGenerated: true,
    })
  }

  // Calculate difficulty breakdown
  const difficultyBreakdown = { easy: 0, medium: 0, hard: 0 }
  for (const q of selectedQuestions) {
    if (q.difficulty <= 2) difficultyBreakdown.easy++
    else if (q.difficulty <= 3) difficultyBreakdown.medium++
    else difficultyBreakdown.hard++
  }

  // Get unique topics covered
  const topicsCovered = [...new Set(selectedQuestions.map(q => q.topicName))]

  // Calculate suggested due date
  const suggestedDueDate = new Date()
  suggestedDueDate.setDate(suggestedDueDate.getDate() + (result.suggestedDueDays || 7))

  return {
    title: result.title || 'Practice Assignment',
    description: result.description || '',
    questions: selectedQuestions,
    suggestedDueDate: suggestedDueDate.toISOString().split('T')[0],
    estimatedMinutes: result.estimatedMinutes || selectedQuestions.length * 3,
    topicsCovered,
    difficultyBreakdown,
  }
}

// POST: Generate a new AI-powered assignment
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can generate assignments' }, { status: 403 })
  }

  try {
    const body: GenerateAssignmentRequest = await request.json()
    const {
      studentId,
      studentIds,
      prompt,
      title,
      topicIds,
      questionCount = 10,
      difficulty = 'adaptive',
      dueDate,
      instructions,
      customPrompt,
      options = {},
      includeMarkscheme = true,
      includeSolutionSteps = true,
      focusOnWeakAreas = false,
    } = body

    // Extract new options with defaults
    const useExistingQuestions = options.useExistingQuestions ?? true
    const generateNewQuestions = options.generateNewQuestions ?? true
    const splitIntoSubAssignments = options.splitIntoSubAssignments ?? false
    const questionsPerSubAssignment = options.questionsPerSubAssignment ?? 5
    
    console.log('Assignment generation request:', {
      topicIds,
      studentIds,
      questionCount,
      difficulty,
      useExistingQuestions,
      generateNewQuestions,
      customPrompt: customPrompt?.slice(0, 100),
    })

    const supabase = await createServerClient()
    
    // Determine which students to create assignments for
    const targetStudentIds = studentIds?.length ? studentIds : studentId ? [studentId] : []
    
    // NEW FORMAT: Create assignments from topic questions for multiple students
    if (targetStudentIds.length > 0 && topicIds?.length) {
      // Get topics info for AI generation context
      const { data: topicsData } = await supabase
        .from('topics')
        .select('id, name, description')
        .in('id', topicIds)
      
      // Get available existing questions from the selected topics (if using existing)
      let existingQuestions: { id: string; difficulty: number; topic_id: string }[] = []
      
      if (useExistingQuestions) {
        let questionsQuery = supabase
          .from('questions')
          .select(`
            id,
            difficulty,
            topic_id
          `)
          .eq('workspace_id', context.workspaceId)
          .eq('status', 'active')
          .in('topic_id', topicIds)
        
        // Apply difficulty filter
        if (difficulty === 'easy') {
          questionsQuery = questionsQuery.lte('difficulty', 2)
        } else if (difficulty === 'medium') {
          questionsQuery = questionsQuery.gte('difficulty', 2).lte('difficulty', 4)
        } else if (difficulty === 'hard') {
          questionsQuery = questionsQuery.gte('difficulty', 4)
        }
        // For 'mixed' and 'adaptive', don't filter - include all difficulties
        
        const { data: questions, error: questionsError } = await questionsQuery
        
        if (questionsError) {
          console.error('Failed to fetch existing questions:', questionsError)
        } else {
          existingQuestions = questions || []
        }
      }
      
      // Check if we need to generate new questions
      const needsMoreQuestions = existingQuestions.length < questionCount
      let generatedQuestionIds: string[] = []
      
      console.log('Question sourcing decision:', {
        existingQuestionsCount: existingQuestions.length,
        questionCount,
        needsMoreQuestions,
        useExistingQuestions,
        generateNewQuestions,
        willGenerate: generateNewQuestions && needsMoreQuestions,
      })
      
      if (generateNewQuestions && needsMoreQuestions) {
        const totalToGenerate = questionCount - existingQuestions.length
        const BATCH_SIZE = 20 // Generate in smaller batches to avoid token limit truncation
        
        // Generate new questions in batches and save to Question Bank
        try {
          console.log(`Need to generate ${totalToGenerate} questions for topics:`, topicsData?.map(t => t.name))
          
          // Generate in batches to avoid timeout and improve reliability
          let remainingToGenerate = totalToGenerate
          while (remainingToGenerate > 0 && generatedQuestionIds.length < totalToGenerate) {
            const batchSize = Math.min(remainingToGenerate, BATCH_SIZE)
            console.log(`Generating batch of ${batchSize} questions (${generatedQuestionIds.length}/${totalToGenerate} done)`)
            
            const generatedQuestions = await generateQuestionsForAssignment(
              supabase,
              context.workspaceId,
              user.id,
              topicsData || [],
              batchSize,
              difficulty,
              customPrompt || prompt,
              options.focusOnWeakAreas || focusOnWeakAreas
            )
            
            generatedQuestionIds.push(...generatedQuestions.map(q => q.id))
            remainingToGenerate -= generatedQuestions.length
            
            // If we got fewer than requested, AI might be struggling - break to avoid infinite loop
            if (generatedQuestions.length < batchSize * 0.5) {
              console.log(`Batch returned fewer questions than expected (${generatedQuestions.length}/${batchSize}), stopping generation`)
              break
            }
          }
          
          console.log(`Successfully generated ${generatedQuestionIds.length} questions total`)
        } catch (genError) {
          console.error('Failed to generate questions:', genError)
          // If we have no existing questions and generation failed, return error
          if (existingQuestions.length === 0 && generatedQuestionIds.length === 0) {
            return NextResponse.json({ 
              error: `Failed to generate questions: ${genError instanceof Error ? genError.message : 'Unknown error'}` 
            }, { status: 500 })
          }
          // Otherwise continue with what we have
        }
      }
      
      // Combine existing and generated questions
      const allQuestionIds = [
        ...existingQuestions.map(q => q.id),
        ...generatedQuestionIds,
      ]
      
      if (allQuestionIds.length === 0) {
        return NextResponse.json({ 
          error: 'No questions available. Enable "Generate new questions" or create questions for the selected topics first.' 
        }, { status: 400 })
      }
      
      // Verify all students belong to workspace
      const { data: students, error: studentsError } = await supabase
        .from('student_profiles')
        .select('id, user_id, name')
        .eq('workspace_id', context.workspaceId)
        .in('id', targetStudentIds)
      
      if (studentsError || !students || students.length !== targetStudentIds.length) {
        return NextResponse.json({ error: 'Some students not found' }, { status: 404 })
      }
      
      // Create assignments for each student
      const createdAssignments: { studentId: string; studentName: string; assignmentId: string; subAssignments?: string[] }[] = []
      
      for (const student of students) {
        // Select and shuffle questions for this student
        let selectedQuestionIds = [...allQuestionIds]
        
        // Shuffle if enabled
        if (options.shuffleQuestions !== false) {
          selectedQuestionIds = selectedQuestionIds.sort(() => Math.random() - 0.5)
        }
        
        // Limit to requested count
        selectedQuestionIds = selectedQuestionIds.slice(0, questionCount)
        
        // Handle sub-assignment splitting
        if (splitIntoSubAssignments && selectedQuestionIds.length > questionsPerSubAssignment) {
          const subAssignmentIds: string[] = []
          const chunks: string[][] = []
          
          for (let i = 0; i < selectedQuestionIds.length; i += questionsPerSubAssignment) {
            chunks.push(selectedQuestionIds.slice(i, i + questionsPerSubAssignment))
          }
          
          // Create parent assignment first (no questions, just a container)
          const { data: parentAssignment, error: parentError } = await supabase
            .from('assignments')
            .insert({
              workspace_id: context.workspaceId,
              created_by: user.id,
              student_profile_id: student.id,
              assigned_student_user_id: student.user_id,
              title: title || 'Practice Set',
              description: instructions || null,
              due_at: dueDate || null,
              settings_json: {
                timeLimit: options.timeLimit || null,
                shuffleQuestions: options.shuffleQuestions ?? true,
                showResultsImmediately: options.showResultsImmediately ?? false,
                generatedFrom: 'ai-studio',
                topicIds,
                totalParts: chunks.length,
                isParent: true,
                customPrompt: customPrompt || undefined,
              },
              status: 'active',
            })
            .select('id')
            .single()
          
          if (parentError || !parentAssignment) {
            console.error('Failed to create parent assignment:', parentError)
            continue
          }
          
          for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx]
            const subTitle = `${title || 'Practice Set'} - Part ${idx + 1}`
            
            const { data: assignment, error: assignmentError } = await supabase
              .from('assignments')
              .insert({
                workspace_id: context.workspaceId,
                created_by: user.id,
                student_profile_id: student.id,
                assigned_student_user_id: student.user_id,
                parent_assignment_id: parentAssignment.id,
                title: subTitle,
                description: instructions || null,
                due_at: dueDate || null,
                settings_json: {
                  timeLimit: options.timeLimit || null,
                  shuffleQuestions: options.shuffleQuestions ?? true,
                  showResultsImmediately: options.showResultsImmediately ?? false,
                  generatedFrom: 'ai-studio',
                  topicIds,
                  partNumber: idx + 1,
                  totalParts: chunks.length,
                  customPrompt: customPrompt || undefined,
                },
                status: 'active',
              })
              .select('id')
              .single()
            
            if (assignmentError || !assignment) {
              console.error('Failed to create sub-assignment:', assignmentError)
              continue
            }
            
            const assignmentItems = chunk.map((qId, qIdx) => ({
              assignment_id: assignment.id,
              question_id: qId,
              order_index: qIdx,
              points: 1,
            }))
            
            const { error: itemsError } = await supabase.from('assignment_items').insert(assignmentItems)
            
            if (itemsError) {
              console.error('Failed to create assignment items:', itemsError)
              await supabase.from('assignments').delete().eq('id', assignment.id)
              continue
            }
            
            subAssignmentIds.push(assignment.id)
          }
          
          if (subAssignmentIds.length > 0) {
            createdAssignments.push({
              studentId: student.id,
              studentName: student.name,
              assignmentId: parentAssignment.id,
              subAssignments: subAssignmentIds,
            })
          }
        } else {
          // Create single assignment
          const { data: assignment, error: assignmentError } = await supabase
            .from('assignments')
            .insert({
              workspace_id: context.workspaceId,
              created_by: user.id,
              student_profile_id: student.id,
              assigned_student_user_id: student.user_id,
              title: title || 'AI-Generated Assignment',
              description: instructions || null,
              due_at: dueDate || null,
              settings_json: {
                timeLimit: options.timeLimit || null,
                shuffleQuestions: options.shuffleQuestions ?? true,
                showResultsImmediately: options.showResultsImmediately ?? false,
                generatedFrom: 'ai-studio',
                topicIds,
                customPrompt: customPrompt || undefined,
              },
              status: 'active',
            })
            .select('id')
            .single()
          
          if (assignmentError || !assignment) {
            console.error('Failed to create assignment for student:', student.id, assignmentError)
            continue
          }
          
          // Create assignment items (link questions to assignment)
          const assignmentItems = selectedQuestionIds.map((qId, idx) => ({
            assignment_id: assignment.id,
            question_id: qId,
            order_index: idx,
            points: 1,
          }))
          
          const { error: itemsError } = await supabase.from('assignment_items').insert(assignmentItems)
          
          if (itemsError) {
            console.error('Failed to create assignment items:', itemsError)
            await supabase.from('assignments').delete().eq('id', assignment.id)
            continue
          }
          
          createdAssignments.push({
            studentId: student.id,
            studentName: student.name,
            assignmentId: assignment.id,
          })
        }
      }
      
      const totalAssignments = createdAssignments.reduce((sum, a) => 
        sum + (a.subAssignments?.length || 1), 0
      )
      
      return NextResponse.json({
        success: true,
        assignmentsCreated: totalAssignments,
        assignments: createdAssignments,
        questionsGenerated: generatedQuestionIds.length,
        questionsFromBank: existingQuestions.length,
        message: `Created ${totalAssignments} assignment(s) for ${createdAssignments.length} student(s)`,
      })
    }

    // LEGACY FORMAT: AI-powered assignment generation with prompt
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Please provide a prompt describing the assignment or select students and topics' }, { status: 400 })
    }

    // Verify student if specified
    if (studentId) {
      const { data: student, error: studentError } = await supabase
        .from('student_profiles')
        .select('id, name')
        .eq('id', studentId)
        .eq('workspace_id', context.workspaceId)
        .single()

      if (studentError || !student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }
    }

    // Get student history
    const studentHistory = studentId
      ? await getStudentHistory(supabase, studentId, context.workspaceId)
      : {
          topicsStruggled: [],
          recentTopics: [],
          averageDifficulty: 3,
          totalAttempts: 0,
          overallAccuracy: 0,
        }

    // Get available questions
    let questionsQuery = supabase
      .from('questions')
      .select(`
        id,
        prompt_text,
        prompt_latex,
        difficulty,
        answer_type,
        correct_answer_json,
        hints_json,
        solution_steps_json,
        topics!inner(id, name)
      `)
      .eq('workspace_id', context.workspaceId)
      .eq('status', 'active')
      .limit(100)

    if (topicIds && topicIds.length > 0) {
      questionsQuery = questionsQuery.in('topic_id', topicIds)
    }

    const { data: questions } = await questionsQuery

    const availableQuestions: SelectedQuestion[] = (questions || []).map((q) => ({
      id: q.id,
      promptText: q.prompt_text,
      promptLatex: q.prompt_latex || undefined,
      difficulty: q.difficulty || 3,
      topicName: ((q.topics as unknown as { name: string }[] | null)?.[0])?.name || 'Unknown',
      answerType: q.answer_type,
      correctAnswer: q.correct_answer_json,
      hints: q.hints_json as string[] || [],
      solutionSteps: q.solution_steps_json as unknown[] || [],
    }))

    // Get all topics
    const { data: topics } = await supabase
      .from('topics')
      .select('id, name')
      .eq('workspace_id', context.workspaceId)

    // Generate assignment with AI
    const assignment = await generateAssignmentWithAI(
      prompt,
      studentHistory,
      availableQuestions,
      topics || [],
      {
        studentId,
        prompt,
        questionCount,
        difficulty,
        includeMarkscheme,
        includeSolutionSteps,
        focusOnWeakAreas,
        topicIds,
      }
    )

    return NextResponse.json({
      success: true,
      assignment,
      studentHistory: {
        totalAttempts: studentHistory.totalAttempts,
        overallAccuracy: Math.round(studentHistory.overallAccuracy * 100),
        topicsStruggled: studentHistory.topicsStruggled.slice(0, 5),
      },
    })
  } catch (error) {
    console.error('Generate assignment error:', error)
    return NextResponse.json(
      { error: 'Failed to generate assignment' },
      { status: 500 }
    )
  }
}
