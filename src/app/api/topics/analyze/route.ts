import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface TopicGroup {
  canonicalName: string
  canonicalId: string | null
  variants: { id: string; name: string; questionCount: number }[]
  suggestedMerge: boolean
}

// GET: Analyze topics and suggest groupings
export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await getUserContext()
  if (!context) {
    return NextResponse.json({ error: 'No workspace' }, { status: 403 })
  }

  const supabase = await createServerClient()

  // Get all topics with question counts
  const { data: topics } = await supabase
    .from('topics')
    .select(`
      id,
      name,
      description,
      parent_id,
      questions:questions(count)
    `)
    .eq('workspace_id', context.workspaceId)
    .order('name')

  if (!topics || topics.length === 0) {
    return NextResponse.json({ groups: [], suggestions: [] })
  }

  const topicsWithCounts = topics.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    parentId: t.parent_id,
    questionCount: (t.questions as { count: number }[])?.[0]?.count || 0,
  }))

  // Use AI to identify similar/duplicate topics
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are analyzing a list of educational topics to identify duplicates and similar topics that should be grouped together.

Look for:
1. Exact duplicates with different capitalization/spacing
2. Topics that are essentially the same (e.g., "Linear Equations" and "Solving Linear Equations")
3. Topics that could be parent-child relationships
4. Topics with typos that are meant to be the same

Output JSON with this structure:
{
  "groups": [
    {
      "canonicalName": "The best/standardized name for this topic",
      "members": ["topic-id-1", "topic-id-2"],
      "reason": "Why these are grouped",
      "suggestedMerge": true/false
    }
  ],
  "hierarchySuggestions": [
    {
      "parentId": "topic-id",
      "childId": "topic-id",
      "reason": "Why this should be a parent-child relationship"
    }
  ],
  "standalonTopics": ["topic-id-1", "topic-id-2"]
}`,
      },
      {
        role: 'user',
        content: `Analyze these topics and identify groups/duplicates:

${JSON.stringify(topicsWithCounts.map(t => ({
  id: t.id,
  name: t.name,
  description: t.description,
  questionCount: t.questionCount,
})), null, 2)}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
    temperature: 0.3,
  })

  const analysis = JSON.parse(response.choices[0].message.content || '{}')

  // Build grouped response
  const groups: TopicGroup[] = (analysis.groups || []).map((g: { canonicalName: string; members: string[]; suggestedMerge?: boolean }) => {
    const memberTopics = g.members
      .map((id: string) => topicsWithCounts.find((t) => t.id === id))
      .filter(Boolean) as typeof topicsWithCounts

    // Find the one with the most questions as canonical
    const canonical = memberTopics.reduce((a, b) => 
      a.questionCount >= b.questionCount ? a : b
    , memberTopics[0])

    return {
      canonicalName: g.canonicalName,
      canonicalId: canonical?.id || null,
      variants: memberTopics.map((t) => ({
        id: t.id,
        name: t.name,
        questionCount: t.questionCount,
      })),
      suggestedMerge: g.suggestedMerge !== false,
    }
  })

  return NextResponse.json({
    groups,
    hierarchySuggestions: analysis.hierarchySuggestions || [],
    standaloneTopics: (analysis.standaloneTopics || [])
      .map((id: string) => topicsWithCounts.find(t => t.id === id))
      .filter(Boolean),
    totalTopics: topics.length,
    potentialDuplicates: groups.filter(g => g.variants.length > 1).length,
  })
}

// POST: Merge duplicate topics
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = await getUserContext()
  if (!context || context.role === 'student') {
    return NextResponse.json({ error: 'Only tutors can merge topics' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { canonicalTopicId, mergeTopicIds, newName } = body

    if (!canonicalTopicId || !mergeTopicIds || mergeTopicIds.length === 0) {
      return NextResponse.json(
        { error: 'Canonical topic ID and topics to merge are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Verify all topics belong to workspace
    const { data: topics } = await supabase
      .from('topics')
      .select('id')
      .eq('workspace_id', context.workspaceId)
      .in('id', [canonicalTopicId, ...mergeTopicIds])

    if (!topics || topics.length !== mergeTopicIds.length + 1) {
      return NextResponse.json({ error: 'Some topics not found' }, { status: 404 })
    }

    // Update questions to point to canonical topic
    const { error: updateError } = await supabase
      .from('questions')
      .update({ topic_id: canonicalTopicId })
      .in('topic_id', mergeTopicIds)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update canonical topic name if provided
    if (newName) {
      await supabase
        .from('topics')
        .update({ name: newName })
        .eq('id', canonicalTopicId)
    }

    // Delete merged topics
    const { error: deleteError } = await supabase
      .from('topics')
      .delete()
      .in('id', mergeTopicIds)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Merged ${mergeTopicIds.length} topics into one`,
      canonicalTopicId,
    })
  } catch (error) {
    console.error('Merge topics error:', error)
    return NextResponse.json(
      { error: 'Failed to merge topics' },
      { status: 500 }
    )
  }
}
