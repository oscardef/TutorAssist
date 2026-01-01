import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface AIReviewResult {
  flagId: string
  recommendation: 'accept' | 'dismiss' | 'fix_question' | 'needs_review'
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  suggestedAction?: string
  suggestedFix?: string
}

const SYSTEM_PROMPT = `You are an expert math tutor assistant reviewing student-submitted flags on math questions.
Your task is to analyze each flag and provide a recommendation.

For each flag, consider:
1. Is the student's answer mathematically equivalent to the correct answer?
2. Could the question have ambiguity or multiple valid interpretations?
3. Is there a genuine error in the question or expected answer?
4. Is the student's claim reasonable based on the evidence?

Flag types:
- claim_correct: Student believes their answer was incorrectly marked wrong
- incorrect_answer: Student thinks the expected answer is wrong
- unclear: Question is confusing or ambiguous
- typo: There's a typo in the question
- multiple_valid: There are multiple valid answers
- too_hard: Question is too difficult
- other: Other issues

Respond with a JSON object for each flag containing:
- recommendation: "accept" (student is right, add their answer), "dismiss" (student is wrong), "fix_question" (question needs correction), "needs_review" (uncertain, tutor should review)
- confidence: "high", "medium", or "low"
- reasoning: Brief explanation of your assessment
- suggestedAction: What action to take (optional)
- suggestedFix: If recommending fix_question, what the fix should be (optional)

Be fair to students - if their answer is mathematically equivalent (different form, simplified differently, etc.), recommend accepting.
Common equivalencies to watch for:
- Fractions vs decimals (1/2 = 0.5)
- Different forms of same expression (2x vs x+x vs x*2)
- Simplified vs unsimplified (4/8 = 1/2)
- Order of terms (x + 2 = 2 + x)
- Unicode vs LaTeX (× vs \\times)
`

// POST - Analyze multiple flags with AI
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can use AI review' }, { status: 403 })
  }
  
  try {
    const body = await request.json()
    const { flagIds } = body
    
    if (!flagIds || !Array.isArray(flagIds) || flagIds.length === 0) {
      return NextResponse.json(
        { error: 'Flag IDs array is required' },
        { status: 400 }
      )
    }
    
    // Limit to prevent excessive API calls
    if (flagIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 flags can be reviewed at once' },
        { status: 400 }
      )
    }
    
    const supabase = await createServerClient()
    
    // Fetch flags with question data (can't join directly to auth.users)
    const { data: flags, error: flagsError } = await supabase
      .from('question_flags')
      .select(`
        id,
        flag_type,
        comment,
        student_answer,
        student_user_id,
        questions (
          id,
          prompt_text,
          prompt_latex,
          correct_answer_json,
          answer_type
        )
      `)
      .eq('workspace_id', context.workspaceId)
      .in('id', flagIds)
      .eq('status', 'pending')
    
    if (flagsError) {
      console.error('Error fetching flags:', flagsError)
      return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 })
    }
    
    if (!flags || flags.length === 0) {
      return NextResponse.json({ error: 'No pending flags found' }, { status: 404 })
    }
    
    // Prepare flags data for AI
    const flagsForReview = flags.map((flag) => {
      // Handle the fact that supabase can return questions as an array
      const qData = flag.questions
      const q = Array.isArray(qData) ? qData[0] : qData
      return {
        flagId: flag.id,
        flagType: flag.flag_type,
        studentComment: flag.comment,
        studentAnswer: flag.student_answer,
        question: q ? {
          text: q.prompt_text,
          latex: q.prompt_latex,
          expectedAnswer: q.correct_answer_json?.value,
          alternates: q.correct_answer_json?.alternates || [],
          tolerance: q.correct_answer_json?.tolerance,
          answerType: q.answer_type,
        } : null,
      }
    })
    
    // Call OpenAI to analyze flags
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Please analyze these ${flagsForReview.length} flags and provide recommendations for each:

${JSON.stringify(flagsForReview, null, 2)}

Respond with a JSON array of recommendations, one for each flag.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })
    
    const responseText = completion.choices[0]?.message?.content || '{}'
    let reviews: AIReviewResult[] = []
    
    try {
      const parsed = JSON.parse(responseText)
      
      // Handle various response formats from the AI
      if (Array.isArray(parsed)) {
        reviews = parsed
      } else if (Array.isArray(parsed.reviews)) {
        reviews = parsed.reviews
      } else if (Array.isArray(parsed.results)) {
        reviews = parsed.results
      } else if (Array.isArray(parsed.recommendations)) {
        reviews = parsed.recommendations
      } else {
        // Try to extract from any array-valued property
        const arrayProp = Object.values(parsed).find(v => Array.isArray(v))
        if (arrayProp) {
          reviews = arrayProp as AIReviewResult[]
        } else {
          console.error('Unexpected AI response format:', parsed)
          return NextResponse.json(
            { error: 'AI returned unexpected format' },
            { status: 500 }
          )
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }
    
    // Map results back to flag IDs
    const reviewResults = reviews.map((review: AIReviewResult, index: number) => ({
      ...review,
      flagId: review.flagId || flagsForReview[index]?.flagId,
    }))
    
    return NextResponse.json({
      results: reviewResults,
      flagsAnalyzed: flags.length,
    })
    
  } catch (error) {
    console.error('AI review error:', error)
    return NextResponse.json(
      { error: 'Failed to process AI review' },
      { status: 500 }
    )
  }
}
