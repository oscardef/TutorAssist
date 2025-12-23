import { NextRequest, NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    await requireTutor()
    const body = await request.json()
    
    const { prompt, curriculum, grade, duration, questionsPerTopic } = body
    
    if (!prompt && !curriculum) {
      return NextResponse.json({ error: 'Please provide a description or curriculum' }, { status: 400 })
    }
    
    const curriculumNames: Record<string, string> = {
      ib: 'IB (International Baccalaureate)',
      ap: 'AP (Advanced Placement)',
      gcse: 'GCSE (UK)',
      alevels: 'A-Levels (UK)',
      common_core: 'Common Core (US)',
      cbse: 'CBSE (India)',
      custom: 'Custom'
    }
    
    const durationWeeks: Record<string, string> = {
      quarter: '8-10 weeks',
      semester: '15-18 weeks',
      year: '36-40 weeks',
      custom: 'flexible duration'
    }
    
    const systemPrompt = `You are an expert curriculum designer specializing in mathematics education. 
Create detailed, pedagogically-sound syllabi that follow proper learning progressions.

Guidelines:
- Organize topics from foundational to advanced
- Include prerequisite dependencies between topics
- Align with the specified curriculum standards when applicable
- Ensure appropriate difficulty progression
- Include real-world applications where relevant

Return your response as a JSON object with this structure:
{
  "title": "Course title",
  "description": "Brief course description",
  "grade": "Grade level",
  "curriculum": "Curriculum name",
  "topics": [
    {
      "name": "Topic name",
      "description": "Topic description and learning objectives",
      "difficulty": 1-5,
      "questionCount": number,
      "subtopics": ["Subtopic 1", "Subtopic 2"]
    }
  ]
}`

    const userPrompt = `Create a comprehensive mathematics syllabus with the following requirements:

${prompt ? `Description: ${prompt}` : ''}
${curriculum ? `Curriculum: ${curriculumNames[curriculum] || curriculum}` : ''}
${grade ? `Grade Level: ${grade}` : ''}
Duration: ${durationWeeks[duration] || duration}
Questions per topic: ${questionsPerTopic || 10}

Generate an appropriate number of topics for the duration (typically 8-15 topics for a semester, more for a full year).
Each topic should have ${questionsPerTopic || 10} questions planned.`

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
    
    const syllabus = JSON.parse(content)
    
    // Ensure all topics have the question count
    syllabus.topics = syllabus.topics.map((topic: { questionCount?: number }) => ({
      ...topic,
      questionCount: topic.questionCount || questionsPerTopic || 10
    }))
    
    return NextResponse.json({ syllabus })
    
  } catch (error) {
    console.error('Syllabus generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate syllabus' },
      { status: 500 }
    )
  }
}
