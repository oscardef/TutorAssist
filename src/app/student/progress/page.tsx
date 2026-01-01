import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

interface QuestionData {
  topic_id: string
  difficulty: number | string
  topics: { name: string } | { name: string }[] | null
}

interface AttemptData {
  is_correct: boolean
  submitted_at: string
  questions: QuestionData | null
}

export default async function StudentProgressPage() {
  const user = await requireUser()
  await getUserContext()
  const supabase = await createServerClient()
  
  // Get all attempts - fix: use student_user_id instead of student_id
  const { data: attempts } = await supabase
    .from('attempts')
    .select('is_correct, submitted_at, questions(topic_id, difficulty, topics(name))')
    .eq('student_user_id', user?.id)
    .order('submitted_at', { ascending: false })
    .limit(500)
  
  // Normalize the data
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
  
  // Group by difficulty - map numeric difficulty to category
  const difficultyStats = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } }
  normalizedAttempts?.forEach((attempt) => {
    const question = attempt.questions
    if (!question?.difficulty) return
    
    // Map numeric difficulty (1-5) to category
    const diff = typeof question.difficulty === 'number' ? question.difficulty : parseInt(String(question.difficulty))
    let category: 'easy' | 'medium' | 'hard'
    if (diff <= 2) category = 'easy'
    else if (diff <= 3) category = 'medium'
    else category = 'hard'
    
    difficultyStats[category].total += 1
    if (attempt.is_correct) difficultyStats[category].correct += 1
  })
  
  // Get recent activity (last 7 days)
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

  // Calculate streak
  let currentStreak = 0
  const sortedDays = Array.from(dailyActivity.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  for (const [, stats] of sortedDays) {
    if (stats.total > 0) currentStreak++
    else break
  }
  
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
        <p className="text-gray-600 mt-1">
          Track your learning journey
        </p>
      </div>
      
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalAttempts}</div>
          <div className="text-sm text-gray-500">Questions Practiced</div>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900">{overallAccuracy}%</div>
          <div className="text-sm text-gray-500">Overall Accuracy</div>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900">{topicStats.size}</div>
          <div className="text-sm text-gray-500">Topics Studied</div>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900">{currentStreak}</div>
          <div className="text-sm text-gray-500">Day Streak</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Topic</h2>
          
          {topicStats.size > 0 ? (
            <div className="space-y-4">
              {Array.from(topicStats.entries())
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 8)
                .map(([topicId, stats]) => {
                  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                  
                  return (
                    <div key={topicId}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-900">{stats.name}</span>
                        <span className="text-gray-500">
                          {stats.correct}/{stats.total} ({accuracy}%)
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            accuracy >= 80 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                            accuracy >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 
                            'bg-gradient-to-r from-red-400 to-red-500'
                          }`}
                          style={{ width: `${accuracy}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-gray-500">
                Start practicing to see your topic breakdown!
              </p>
            </div>
          )}
        </div>
        
        {/* Difficulty Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Difficulty</h2>
          
          <div className="space-y-5">
            {(['easy', 'medium', 'hard'] as const).map((difficulty) => {
              const stats = difficultyStats[difficulty]
              const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
              
              const colors = {
                easy: { 
                  bg: 'bg-gradient-to-r from-green-400 to-green-500', 
                  label: 'Easy', 
                  badge: 'bg-green-100 text-green-700',
                  icon: '🌱'
                },
                medium: { 
                  bg: 'bg-gradient-to-r from-yellow-400 to-yellow-500', 
                  label: 'Medium', 
                  badge: 'bg-yellow-100 text-yellow-700',
                  icon: '🌿'
                },
                hard: { 
                  bg: 'bg-gradient-to-r from-red-400 to-red-500', 
                  label: 'Hard', 
                  badge: 'bg-red-100 text-red-700',
                  icon: '🌳'
                },
              }
              
              return (
                <div key={difficulty}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{colors[difficulty].icon}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[difficulty].badge}`}>
                        {colors[difficulty].label}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {stats.total > 0 ? `${stats.correct}/${stats.total} (${accuracy}%)` : 'No attempts yet'}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${colors[difficulty].bg} rounded-full transition-all duration-500`}
                      style={{ width: stats.total > 0 ? `${accuracy}%` : '0%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Quick Summary */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {difficultyStats.easy.total}
                </div>
                <div className="text-xs text-gray-500">Easy</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {difficultyStats.medium.total}
                </div>
                <div className="text-xs text-gray-500">Medium</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {difficultyStats.hard.total}
                </div>
                <div className="text-xs text-gray-500">Hard</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Weekly Activity */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Last 7 Days</h2>
        
        <div className="flex items-end gap-3 h-40">
          {Array.from(dailyActivity.entries()).reverse().map(([date, stats]) => {
            const maxHeight = Math.max(...Array.from(dailyActivity.values()).map(s => s.total), 1)
            const height = maxHeight > 0 ? (stats.total / maxHeight) * 100 : 0
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
            const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
            
            return (
              <div key={date} className="flex-1 flex flex-col items-center group">
                <div className="relative w-full flex flex-col items-center" style={{ height: '100px' }}>
                  {/* Tooltip on hover */}
                  {stats.total > 0 && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {accuracy}% accuracy
                    </div>
                  )}
                  <div className="w-full flex justify-center items-end h-full">
                    <div 
                      className={`w-full max-w-[40px] rounded-t-lg transition-all ${
                        stats.total === 0 
                          ? 'bg-gray-100' 
                          : accuracy >= 70 
                          ? 'bg-gradient-to-t from-blue-400 to-blue-500' 
                          : 'bg-gradient-to-t from-blue-300 to-blue-400'
                      }`}
                      style={{ height: `${Math.max(height, 8)}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-600 mt-2">{dayName}</div>
                <div className="text-xs text-gray-400">{stats.total > 0 ? stats.total : '-'}</div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Empty state message */}
      {totalAttempts === 0 && (
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100 p-8 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Start?</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Complete some practice questions or assignments to see your progress stats here.
          </p>
        </div>
      )}
    </div>
  )
}
