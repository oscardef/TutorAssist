import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function QuestionsPage() {
  const context = await requireTutor()
  const supabase = await createServerClient()

  // Get questions with topics
  const { data: questions } = await supabase
    .from('questions')
    .select('*, topics(name)')
    .eq('workspace_id', context.workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  // Get topics for filtering
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .order('name')

  // Group questions by status
  const activeQuestions = questions?.filter(q => q.status === 'active') || []
  const reviewQuestions = questions?.filter(q => q.status === 'needs_review') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="mt-1 text-sm text-gray-500">
            {questions?.length || 0} questions total
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tutor/generate"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Generate with AI
          </Link>
          <Link
            href="/tutor/questions/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Add Question
          </Link>
        </div>
      </div>

      {/* Needs Review Alert */}
      {reviewQuestions.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Questions Need Review</h3>
              <p className="mt-1 text-sm text-yellow-700">
                {reviewQuestions.length} questions have been flagged for review or have low quality scores.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Topic Filter */}
      {topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
            All Topics
          </span>
          {topics.map(topic => (
            <span key={topic.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 cursor-pointer">
              {topic.name}
            </span>
          ))}
        </div>
      )}

      {/* Questions List */}
      {activeQuestions.length > 0 ? (
        <div className="space-y-4">
          {activeQuestions.map((question) => (
            <div key={question.id} className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {question.topics?.name && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {question.topics.name}
                      </span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      question.difficulty === 1 ? 'bg-green-100 text-green-800' :
                      question.difficulty === 2 ? 'bg-lime-100 text-lime-800' :
                      question.difficulty === 3 ? 'bg-yellow-100 text-yellow-800' :
                      question.difficulty === 4 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {['Easy', 'Medium-Easy', 'Medium', 'Medium-Hard', 'Hard'][question.difficulty - 1] || 'Unrated'}
                    </span>
                    {question.origin === 'ai_generated' && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                        AI Generated
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-gray-900">{question.prompt_text}</p>
                  <div className="mt-2 text-sm text-gray-500">
                    Answer: {typeof question.correct_answer_json?.value === 'object' 
                      ? JSON.stringify(question.correct_answer_json.value) 
                      : question.correct_answer_json?.value}
                    {question.times_attempted > 0 && (
                      <> • {question.times_correct}/{question.times_attempted} correct ({Math.round((question.times_correct / question.times_attempted) * 100)}%)</>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/tutor/questions/${question.id}`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No questions yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating questions manually or generating them with AI.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/tutor/questions/new"
              className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Add Manually
            </Link>
            <Link
              href="/tutor/generate"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              <svg className="-ml-0.5 mr-1.5 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              Generate with AI
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
