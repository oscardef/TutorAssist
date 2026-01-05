import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface FlagInsight {
  type: 'pattern' | 'question_issue' | 'student_pattern' | 'recommendation'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  affectedCount: number
  questionIds?: string[]
  actionSuggestion?: string
}

interface FlagData {
  id: string
  flag_type: string
  comment: string | null
  status: string
  student_answer: string | null
  created_at: string
  ai_analysis_json: unknown
  questions: {
    id: string
    prompt_text: string
    prompt_latex: string | null
    correct_answer_json: unknown
    answer_type: string
    topics: { name: string } | null
  } | null
}

// GET - Get AI-generated insights about flag patterns
export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can view flag insights' }, { status: 403 })
  }
  
  try {
    const supabase = await createServerClient()
    
    // Get all flags from the last 30 days with question data
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: flagsRaw, error: flagsError } = await supabase
      .from('question_flags')
      .select(`
        id,
        flag_type,
        comment,
        status,
        student_answer,
        created_at,
        ai_analysis_json,
        questions (
          id,
          prompt_text,
          prompt_latex,
          correct_answer_json,
          answer_type,
          topics (name)
        )
      `)
      .eq('workspace_id', context.workspaceId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
    
    // Cast to proper type
    const flags = flagsRaw as unknown as FlagData[]
    
    if (flagsError) {
      console.error('Error fetching flags:', flagsError)
      return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 })
    }
    
    if (!flags || flags.length === 0) {
      return NextResponse.json({ 
        insights: [],
        summary: {
          totalFlags: 0,
          pendingCount: 0,
          acceptedRate: 0,
          commonTypes: [],
        }
      })
    }
    
    // Calculate basic stats
    const totalFlags = flags.length
    const pendingCount = flags.filter(f => f.status === 'pending').length
    const acceptedCount = flags.filter(f => f.status === 'accepted').length
    const acceptedRate = totalFlags > 0 ? Math.round((acceptedCount / totalFlags) * 100) : 0
    
    // Group flags by type
    const typeCounts = flags.reduce((acc, f) => {
      acc[f.flag_type] = (acc[f.flag_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const commonTypes = Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))
    
    // Group flags by question to find problematic questions
    const questionFlags = flags.reduce((acc, f) => {
      if (f.questions?.id) {
        if (!acc[f.questions.id]) {
          acc[f.questions.id] = {
            question: f.questions,
            flags: [],
          }
        }
        acc[f.questions.id].flags.push(f)
      }
      return acc
    }, {} as Record<string, { question: typeof flags[0]['questions'], flags: typeof flags }>)
    
    // Find questions with multiple flags (potential issues)
    const problematicQuestions = Object.values(questionFlags)
      .filter(q => q.flags.length >= 2)
      .sort((a, b) => b.flags.length - a.flags.length)
    
    // Generate insights
    const insights: FlagInsight[] = []
    
    // High priority: Questions with many claim_correct flags (might have wrong answer)
    const questionsWithManyClaimCorrect = Object.values(questionFlags)
      .filter(q => q.flags.filter(f => f.flag_type === 'claim_correct').length >= 2)
    
    if (questionsWithManyClaimCorrect.length > 0) {
      insights.push({
        type: 'question_issue',
        severity: 'high',
        title: 'Questions with Multiple "I Was Right" Claims',
        description: `${questionsWithManyClaimCorrect.length} question(s) have been flagged as having a wrong answer by multiple students. These questions likely need their correct answer reviewed.`,
        affectedCount: questionsWithManyClaimCorrect.length,
        questionIds: questionsWithManyClaimCorrect.map(q => q.question?.id).filter(Boolean) as string[],
        actionSuggestion: 'Review these questions and consider adding alternate answers or fixing the expected answer.',
      })
    }
    
    // Medium priority: High percentage of claim_correct flags being accepted
    if (acceptedCount > 5 && acceptedRate > 50) {
      insights.push({
        type: 'pattern',
        severity: 'medium',
        title: 'High Accept Rate on Student Claims',
        description: `${acceptedRate}% of student "I was right" claims have been accepted. This suggests that answer validation might be too strict or questions may need alternate answers added.`,
        affectedCount: acceptedCount,
        actionSuggestion: 'Consider reviewing your answer comparison logic or proactively adding common alternate forms.',
      })
    }
    
    // Medium priority: Topics with many flags
    const topicFlags = flags.reduce((acc, f) => {
      const topicName = f.questions?.topics?.name
      if (topicName) {
        acc[topicName] = (acc[topicName] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
    
    const problemTopics = Object.entries(topicFlags)
      .filter(([, count]) => count >= 5)
      .sort(([,a], [,b]) => b - a)
    
    if (problemTopics.length > 0) {
      insights.push({
        type: 'pattern',
        severity: 'medium',
        title: 'Topics with Frequent Flags',
        description: `These topics have the most flagged questions: ${problemTopics.slice(0, 3).map(([t, c]) => `${t} (${c})`).join(', ')}. Consider reviewing questions in these areas.`,
        affectedCount: problemTopics.reduce((sum, [, c]) => sum + c, 0),
        actionSuggestion: 'Review and improve questions in these topic areas.',
      })
    }
    
    // Low priority: Unclear questions
    const unclearFlags = flags.filter(f => f.flag_type === 'unclear')
    if (unclearFlags.length >= 3) {
      insights.push({
        type: 'pattern',
        severity: 'low',
        title: 'Questions Marked as Unclear',
        description: `${unclearFlags.length} questions have been flagged as unclear or confusing. Consider rewriting these to be more explicit.`,
        affectedCount: unclearFlags.length,
        questionIds: unclearFlags.map(f => f.questions?.id).filter((id): id is string => !!id),
        actionSuggestion: 'Review question wording for ambiguity.',
      })
    }
    
    // Try to use AI for deeper analysis if there are enough flags
    let aiSummary = null
    if (flags.length >= 10) {
      try {
        const flagSummary = flags.slice(0, 50).map(f => ({
          type: f.flag_type,
          status: f.status,
          comment: f.comment?.slice(0, 100),
          questionPreview: (f.questions as { prompt_text?: string })?.prompt_text?.slice(0, 100),
          studentAnswer: f.student_answer?.slice(0, 50),
        }))
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an educational analytics assistant. Analyze the following flag data from a tutoring platform and provide a brief, actionable summary of patterns you observe. Focus on:
1. Any systemic issues with question quality
2. Patterns in student misunderstandings
3. Recommendations for improvement

Keep your response concise (2-3 paragraphs max).`
            },
            {
              role: 'user',
              content: `Here are recent flags from our tutoring platform:\n${JSON.stringify(flagSummary, null, 2)}\n\nProvide a brief analysis of patterns and recommendations.`
            }
          ],
          max_tokens: 500,
        })
        
        aiSummary = completion.choices[0]?.message?.content
      } catch (err) {
        console.error('AI summary generation failed:', err)
        // Continue without AI summary
      }
    }
    
    return NextResponse.json({
      insights,
      summary: {
        totalFlags,
        pendingCount,
        acceptedRate,
        commonTypes,
        problematicQuestionCount: problematicQuestions.length,
      },
      aiSummary,
    })
  } catch (err) {
    console.error('Error getting flag insights:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
