import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import QuestionBankClient from './QuestionBankClient'

export default async function QuestionsPage() {
  const context = await requireTutor()
  const supabase = await createServerClient()

  // Get questions with topics
  const { data: questions } = await supabase
    .from('questions')
    .select('*, topics(name)')
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })
    .limit(500)

  // Get topics for filtering
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .order('name')

  return (
    <QuestionBankClient 
      initialQuestions={questions || []} 
      initialTopics={topics || []} 
    />
  )
}
