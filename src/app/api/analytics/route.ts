import { NextResponse } from 'next/server'
import { requireUser, getUserContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Analytics API - Provides aggregated statistics for tutor dashboard
 * 
 * GET /api/analytics?type=overview|topics|students|ai-usage
 */
export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const context = await getUserContext()
  if (!context || context.role !== 'tutor') {
    return NextResponse.json({ error: 'Tutor access required' }, { status: 403 })
  }
  
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'overview'
  const days = parseInt(searchParams.get('days') || '30')
  
  const supabase = await createServerClient()
  const workspaceId = context.workspaceId
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString()
  
  try {
    switch (type) {
      case 'overview':
        return NextResponse.json(await getOverviewStats(supabase, workspaceId, startDateStr))
      
      case 'topics':
        return NextResponse.json(await getTopicPerformance(supabase, workspaceId, startDateStr))
      
      case 'students':
        return NextResponse.json(await getStudentPerformance(supabase, workspaceId, startDateStr))
      
      case 'ai-usage':
        return NextResponse.json(await getAIUsageStats(supabase, workspaceId, startDateStr))
      
      case 'questions':
        return NextResponse.json(await getQuestionStats(supabase, workspaceId))
      
      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

async function getOverviewStats(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  workspaceId: string,
  startDate: string
) {
  // Parallel queries for efficiency
  const [
    { count: totalStudents },
    { count: totalQuestions },
    { count: totalAttempts },
    { data: recentAttempts },
    { count: activeAssignments },
  ] = await Promise.all([
    supabase.from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('role', 'student'),
    
    supabase.from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
    
    supabase.from('attempts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('submitted_at', startDate),
    
    supabase.from('attempts')
      .select('is_correct')
      .eq('workspace_id', workspaceId)
      .gte('submitted_at', startDate),
    
    supabase.from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
  ])
  
  const correctAttempts = recentAttempts?.filter(a => a.is_correct).length || 0
  const overallAccuracy = totalAttempts && totalAttempts > 0 
    ? Math.round((correctAttempts / totalAttempts) * 100) 
    : 0
  
  return {
    overview: {
      totalStudents: totalStudents || 0,
      totalQuestions: totalQuestions || 0,
      totalAttempts: totalAttempts || 0,
      activeAssignments: activeAssignments || 0,
      overallAccuracy,
      periodDays: Math.ceil((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)),
    }
  }
}

async function getTopicPerformance(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  workspaceId: string,
  startDate: string
) {
  // Get topics with question counts and attempt stats
  const { data: topics } = await supabase
    .from('topics')
    .select(`
      id,
      name,
      questions!inner(
        id,
        times_served,
        times_correct,
        times_incorrect,
        avg_time_seconds,
        difficulty
      )
    `)
    .eq('workspace_id', workspaceId)
  
  const topicStats = (topics || []).map(topic => {
    const questions = topic.questions || []
    const totalServed = questions.reduce((sum, q) => sum + (q.times_served || 0), 0)
    const totalCorrect = questions.reduce((sum, q) => sum + (q.times_correct || 0), 0)
    const avgDifficulty = questions.length > 0
      ? questions.reduce((sum, q) => sum + (q.difficulty || 3), 0) / questions.length
      : 3
    const avgTime = questions.filter(q => q.avg_time_seconds).length > 0
      ? questions.reduce((sum, q) => sum + (q.avg_time_seconds || 0), 0) / questions.filter(q => q.avg_time_seconds).length
      : null
    
    return {
      topicId: topic.id,
      topicName: topic.name,
      questionCount: questions.length,
      totalAttempts: totalServed,
      accuracy: totalServed > 0 ? Math.round((totalCorrect / totalServed) * 100) : null,
      avgDifficulty: Math.round(avgDifficulty * 10) / 10,
      avgTimeSeconds: avgTime ? Math.round(avgTime) : null,
    }
  }).sort((a, b) => b.totalAttempts - a.totalAttempts)
  
  return { topicPerformance: topicStats }
}

async function getStudentPerformance(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  workspaceId: string,
  startDate: string
) {
  // Get students with their attempt stats
  const { data: members } = await supabase
    .from('workspace_members')
    .select(`
      user_id,
      profiles!inner(full_name, email)
    `)
    .eq('workspace_id', workspaceId)
    .eq('role', 'student')
  
  if (!members || members.length === 0) {
    return { studentPerformance: [] }
  }
  
  // Get attempts for each student
  const studentIds = members.map(m => m.user_id)
  const { data: attempts } = await supabase
    .from('attempts')
    .select('student_user_id, is_correct, time_spent_seconds')
    .eq('workspace_id', workspaceId)
    .in('student_user_id', studentIds)
    .gte('submitted_at', startDate)
  
  // Aggregate by student
  const studentMap = new Map<string, { total: number; correct: number; totalTime: number }>()
  for (const attempt of attempts || []) {
    const existing = studentMap.get(attempt.student_user_id) || { total: 0, correct: 0, totalTime: 0 }
    existing.total += 1
    if (attempt.is_correct) existing.correct += 1
    existing.totalTime += attempt.time_spent_seconds || 0
    studentMap.set(attempt.student_user_id, existing)
  }
  
  const studentStats = members.map(member => {
    const stats = studentMap.get(member.user_id) || { total: 0, correct: 0, totalTime: 0 }
    const profiles = member.profiles as unknown as { full_name: string | null; email: string }[] | { full_name: string | null; email: string } | null
    const profile = Array.isArray(profiles) ? profiles[0] : profiles
    
    return {
      studentId: member.user_id,
      name: profile?.full_name || profile?.email || 'Unknown',
      totalAttempts: stats.total,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null,
      avgTimeSeconds: stats.total > 0 ? Math.round(stats.totalTime / stats.total) : null,
      lastActive: null, // Could add query for this
    }
  }).sort((a, b) => b.totalAttempts - a.totalAttempts)
  
  return { studentPerformance: studentStats }
}

async function getAIUsageStats(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  workspaceId: string,
  startDate: string
) {
  const { data: usageLogs } = await supabase
    .from('ai_usage_log')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })
  
  if (!usageLogs || usageLogs.length === 0) {
    return {
      aiUsage: {
        totalCalls: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        byOperation: {},
        byModel: {},
      }
    }
  }
  
  // Aggregate stats
  const byOperation: Record<string, { calls: number; tokens: number; cost: number }> = {}
  const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {}
  
  let totalTokens = 0
  let totalCost = 0
  
  for (const log of usageLogs) {
    const tokens = log.tokens_total || 0
    const cost = log.cost_usd || 0
    
    totalTokens += tokens
    totalCost += cost
    
    // By operation
    const op = log.operation_type
    if (!byOperation[op]) byOperation[op] = { calls: 0, tokens: 0, cost: 0 }
    byOperation[op].calls += 1
    byOperation[op].tokens += tokens
    byOperation[op].cost += cost
    
    // By model
    const model = log.model
    if (!byModel[model]) byModel[model] = { calls: 0, tokens: 0, cost: 0 }
    byModel[model].calls += 1
    byModel[model].tokens += tokens
    byModel[model].cost += cost
  }
  
  return {
    aiUsage: {
      totalCalls: usageLogs.length,
      totalTokens,
      totalCostUsd: Math.round(totalCost * 1000) / 1000,
      byOperation,
      byModel,
    }
  }
}

async function getQuestionStats(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  workspaceId: string
) {
  // Get question distribution by various dimensions
  const { data: questions } = await supabase
    .from('questions')
    .select('origin, status, difficulty, answer_type, times_served, quality_score')
    .eq('workspace_id', workspaceId)
  
  if (!questions || questions.length === 0) {
    return { questionStats: { total: 0, byOrigin: {}, byStatus: {}, byDifficulty: {}, byAnswerType: {} } }
  }
  
  const byOrigin: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byDifficulty: Record<number, number> = {}
  const byAnswerType: Record<string, number> = {}
  let neverServed = 0
  let lowQuality = 0
  
  for (const q of questions) {
    byOrigin[q.origin] = (byOrigin[q.origin] || 0) + 1
    byStatus[q.status] = (byStatus[q.status] || 0) + 1
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1
    byAnswerType[q.answer_type] = (byAnswerType[q.answer_type] || 0) + 1
    
    if (!q.times_served || q.times_served === 0) neverServed++
    if (q.quality_score && q.quality_score < 0.5) lowQuality++
  }
  
  return {
    questionStats: {
      total: questions.length,
      byOrigin,
      byStatus,
      byDifficulty,
      byAnswerType,
      neverServed,
      lowQuality,
    }
  }
}
