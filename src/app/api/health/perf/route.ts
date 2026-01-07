import { NextResponse } from 'next/server'
import { requireTutor } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

interface QueryTiming {
  name: string
  duration: number
  status: 'ok' | 'slow' | 'error'
}

/**
 * Performance Health Check Endpoint
 * 
 * Runs representative queries and reports timings.
 * Auth-protected: requires tutor role.
 * 
 * Use this to verify query performance after migrations/index changes.
 */
export async function GET() {
  const startTotal = performance.now()
  
  try {
    // Verify tutor access
    const context = await requireTutor()
    const supabase = await createServerClient()
    
    const timings: QueryTiming[] = []
    
    // Helper to time a query
    async function timeQuery<T>(
      name: string, 
      queryFn: () => Promise<T>,
      slowThreshold = 200 // ms
    ): Promise<T> {
      const start = performance.now()
      try {
        const result = await queryFn()
        const duration = performance.now() - start
        timings.push({
          name,
          duration: Math.round(duration),
          status: duration > slowThreshold ? 'slow' : 'ok'
        })
        return result
      } catch (error) {
        const duration = performance.now() - start
        timings.push({
          name,
          duration: Math.round(duration),
          status: 'error'
        })
        throw error
      }
    }
    
    // Representative queries that mirror dashboard usage
    
    // 1. Flags count (tutor dashboard)
    await timeQuery('flags_count_pending', async () => {
      return supabase
        .from('question_flags')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', context.workspaceId)
        .eq('status', 'pending')
    })
    
    // 2. Students list (tutor dashboard)
    await timeQuery('students_list', async () => {
      return supabase
        .from('student_profiles')
        .select('id, name, user_id')
        .eq('workspace_id', context.workspaceId)
        .limit(50)
    })
    
    // 3. Active assignments (tutor dashboard)
    await timeQuery('assignments_active', async () => {
      return supabase
        .from('assignments')
        .select('id, title, due_at, status')
        .eq('workspace_id', context.workspaceId)
        .eq('status', 'active')
        .order('due_at')
        .limit(20)
    })
    
    // 4. Recent attempts (analytics)
    await timeQuery('attempts_recent_2weeks', async () => {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      return supabase
        .from('attempts')
        .select('student_user_id, is_correct')
        .eq('workspace_id', context.workspaceId)
        .gte('created_at', twoWeeksAgo.toISOString())
        .limit(1000)
    })
    
    // 5. Sessions upcoming (tutor dashboard)
    await timeQuery('sessions_upcoming', async () => {
      return supabase
        .from('sessions')
        .select('id, scheduled_at, student_id')
        .eq('workspace_id', context.workspaceId)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(10)
    })
    
    // 6. Topics list (question generation)
    await timeQuery('topics_list', async () => {
      return supabase
        .from('topics')
        .select('id, name, parent_id')
        .eq('workspace_id', context.workspaceId)
        .limit(100)
    })
    
    // 7. Questions with joins (practice page)
    await timeQuery('questions_with_topic', async () => {
      return supabase
        .from('questions')
        .select('id, prompt_text, difficulty, topics(name)')
        .eq('workspace_id', context.workspaceId)
        .limit(20)
    })
    
    // 8. Spaced repetition due items (student dashboard pattern)
    await timeQuery('spaced_rep_sample', async () => {
      return supabase
        .from('spaced_repetition')
        .select('id, next_due, ease_factor')
        .lte('next_due', new Date().toISOString())
        .limit(10)
    })
    
    const totalDuration = Math.round(performance.now() - startTotal)
    
    // Calculate summary stats
    const slowQueries = timings.filter(t => t.status === 'slow')
    const errorQueries = timings.filter(t => t.status === 'error')
    const avgDuration = Math.round(
      timings.reduce((sum, t) => sum + t.duration, 0) / timings.length
    )
    
    return NextResponse.json({
      status: errorQueries.length > 0 ? 'error' : slowQueries.length > 0 ? 'degraded' : 'healthy',
      summary: {
        totalQueries: timings.length,
        totalDuration,
        avgQueryDuration: avgDuration,
        slowQueries: slowQueries.length,
        errorQueries: errorQueries.length,
      },
      timings,
      timestamp: new Date().toISOString(),
      workspaceId: context.workspaceId,
    })
    
  } catch (error) {
    const totalDuration = Math.round(performance.now() - startTotal)
    
    // Don't expose internal errors
    const isAuthError = error instanceof Error && 
      (error.message.includes('Unauthorized') || error.message.includes('redirect'))
    
    return NextResponse.json(
      {
        status: 'error',
        error: isAuthError ? 'Authentication required' : 'Internal error',
        totalDuration,
        timestamp: new Date().toISOString(),
      },
      { status: isAuthError ? 401 : 500 }
    )
  }
}
