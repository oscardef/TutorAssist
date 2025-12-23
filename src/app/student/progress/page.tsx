import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

interface QuestionData {
  topic_id: string
  difficulty: 'easy' | 'medium' | 'hard'
  topics: { name: string } | { name: string }[] | null
}

interface AttemptData {
  is_correct: boolean
  submitted_at: string
  questions: QuestionData | null
}

export default async function StudentProgressPage() {
  const user = await requireUser()
  const context = await getUserContext()
  const supabase = await createServerClient()
  
  // Get all attempts for charts
  const { data: attempts } = await supabase
    .from('attempts')
    .select('is_correct, submitted_at, questions(topic_id, difficulty, topics(name))')
    .eq('student_id', user?.id)
    .order('submitted_at', { ascending: false })
    .limit(500)
  
  // Cast and normalize the data
  const normalizedAttempts = (attempts as unknown as AttemptData[])?.map((a) => ({
    ...a,
    questions: a.questions ? {
      ...a.questions,
      topics: Array.isArray(a.questions.topics) ? a.questions.topics[0] : a.questions.topics
    } : null
  }))
  
  // Calculate overall stats
  const totalAttempts = normalizedAttempts?.length || 0
  const correctAttempts = normalizedAttempts?.filter((a) => a.is_correct).length || 0
  const overallAccuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0
  
  // Group by topic
  const topicStats = new Map<string, { name: string; total: number; correct: number }>()
  normalizedAttempts?.forEach((attempt) => {
    const question = attempt.questions
    if (!question?.topic_id) return
    
    const topicName = question.topics?.name || 'Unknown'
    const existing = topicStats.get(question.topic_id) || { name: topicName, total: 0, correct: 0 }
    existing.total += 1
    if (attempt.is_correct) existing.correct += 1
    topicStats.set(question.topic_id, existing)
  })
  
  // Group by difficulty
  const difficultyStats = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } }
  normalizedAttempts?.forEach((attempt) => {
    const question = attempt.questions
    if (!question?.difficulty) return
    
    difficultyStats[question.difficulty].total += 1
    if (attempt.is_correct) difficultyStats[question.difficulty].correct += 1
  })
  
  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  const dailyActivity = new Map<string, { total: number; correct: number }>()
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const key = date.toISOString().split('T')[0]
    dailyActivity.set(key, { total: 0, correct: 0 })
  }
  
  attempts?.forEach((attempt) => {
    const date = new Date(attempt.submitted_at!).toISOString().split('T')[0]
    const existing = dailyActivity.get(date)
    if (existing) {
      existing.total += 1
      if (attempt.is_correct) existing.correct += 1
    }
  })
  
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
        <p className="text-gray-600 mt-1">
          Track your learning journey and identify areas for improvement.
        </p>
      </div>
      
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-4xl font-bold text-blue-600">{totalAttempts}</div>
          <div className="text-gray-600">Questions Practiced</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-4xl font-bold text-green-600">{overallAccuracy}%</div>
          <div className="text-gray-600">Overall Accuracy</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-4xl font-bold text-purple-600">{topicStats.size}</div>
          <div className="text-gray-600">Topics Studied</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Topic</h2>
          
          {topicStats.size > 0 ? (
            <div className="space-y-4">
              {Array.from(topicStats.entries()).map(([topicId, stats]) => {
                const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                
                return (
                  <div key={topicId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900">{stats.name}</span>
                      <span className="text-gray-500">
                        {stats.correct}/{stats.total} ({accuracy}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          accuracy >= 80 ? 'bg-green-500' :
                          accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              Start practicing to see your topic breakdown!
            </p>
          )}
        </div>
        
        {/* Difficulty Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Difficulty</h2>
          
          <div className="space-y-4">
            {(['easy', 'medium', 'hard'] as const).map((difficulty) => {
              const stats = difficultyStats[difficulty]
              const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
              
              const colors = {
                easy: { bg: 'bg-green-500', label: 'Easy', badge: 'bg-green-100 text-green-700' },
                medium: { bg: 'bg-yellow-500', label: 'Medium', badge: 'bg-yellow-100 text-yellow-700' },
                hard: { bg: 'bg-red-500', label: 'Hard', badge: 'bg-red-100 text-red-700' },
              }
              
              return (
                <div key={difficulty}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[difficulty].badge}`}>
                      {colors[difficulty].label}
                    </span>
                    <span className="text-gray-500">
                      {stats.total > 0 ? `${stats.correct}/${stats.total} (${accuracy}%)` : 'No attempts'}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${colors[difficulty].bg} rounded-full transition-all`}
                      style={{ width: stats.total > 0 ? `${accuracy}%` : '0%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Weekly Activity */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Last 7 Days</h2>
        
        <div className="flex items-end gap-2 h-32">
          {Array.from(dailyActivity.entries()).reverse().map(([date, stats]) => {
            const maxHeight = Math.max(...Array.from(dailyActivity.values()).map(s => s.total))
            const height = maxHeight > 0 ? (stats.total / maxHeight) * 100 : 0
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
            
            return (
              <div key={date} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center" style={{ height: '80px' }}>
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${height}%`, minHeight: stats.total > 0 ? '4px' : '0' }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2">{dayName}</div>
                <div className="text-xs text-gray-400">{stats.total}</div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Recommendations */}
      <div className="mt-6 bg-blue-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">💡 Recommendations</h2>
        <ul className="space-y-2 text-blue-800">
          {totalAttempts < 10 && (
            <li>• Practice more questions to get accurate progress insights</li>
          )}
          {overallAccuracy < 60 && totalAttempts >= 10 && (
            <li>• Focus on easier questions first to build confidence</li>
          )}
          {Array.from(topicStats.entries()).some(([, stats]) => 
            stats.total >= 5 && (stats.correct / stats.total) < 0.5
          ) && (
            <li>• Review topics where your accuracy is below 50%</li>
          )}
          {difficultyStats.easy.total > 20 && difficultyStats.easy.correct / difficultyStats.easy.total > 0.8 && (
            <li>• You&apos;re doing great on easy questions! Try more medium difficulty</li>
          )}
          <li>• Consistent daily practice leads to better retention</li>
        </ul>
      </div>
    </div>
  )
}
