-- ============================================
-- Migration 013: Database Cleanup and Analytics Enhancement
-- Date: 2025-12-31
-- Purpose: Fix issues identified in database audit, add analytics support
-- ============================================

-- ============================================
-- SECTION 1: CREATE MISSING update_question_stats FUNCTION
-- This was referenced in code but never created
-- ============================================

CREATE OR REPLACE FUNCTION update_question_stats(
  question_id_param UUID,
  is_correct_param BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_attempted INTEGER;
  current_correct INTEGER;
  current_avg_time INTEGER;
BEGIN
  -- Get current values
  SELECT times_attempted, times_correct, avg_time_seconds
  INTO current_attempted, current_correct, current_avg_time
  FROM questions
  WHERE id = question_id_param;
  
  -- Update stats
  UPDATE questions
  SET 
    times_attempted = COALESCE(current_attempted, 0) + 1,
    times_correct = COALESCE(current_correct, 0) + CASE WHEN is_correct_param THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = question_id_param;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_question_stats(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION update_question_stats(UUID, BOOLEAN) TO service_role;

COMMENT ON FUNCTION update_question_stats IS 
'Updates question attempt statistics (times_attempted, times_correct) after each student attempt. Called from attempts API.';


-- ============================================
-- SECTION 2: ADD generation_metadata TO questions
-- For tracking AI generation context, costs, and quality
-- ============================================

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS generation_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questions_generation_metadata 
  ON questions USING gin(generation_metadata);

COMMENT ON COLUMN questions.generation_metadata IS 
'AI generation context including: model, model_version, prompt_version, temperature, generated_at, batch_id, job_id, tokens_used, generation_time_ms, validation_passed, auto_fixes_applied, source_context, pedagogical metadata';


-- ============================================
-- SECTION 3: ADD context_json TO attempts
-- For tracking attempt context for analytics
-- ============================================

ALTER TABLE attempts 
ADD COLUMN IF NOT EXISTS context_json JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_attempts_context 
  ON attempts USING gin(context_json);

COMMENT ON COLUMN attempts.context_json IS 
'Attempt context for analytics: device_type, input_method, answer_changes_count, hints_viewed_at timestamps, session_id, question_difficulty_at_attempt';


-- ============================================
-- SECTION 4: ADD ANALYTICS INDEXES
-- Optimize common query patterns for student performance analytics
-- ============================================

-- Index for student attempt history (time-series queries)
CREATE INDEX IF NOT EXISTS idx_attempts_student_date 
  ON attempts(student_user_id, submitted_at DESC);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_attempts_analytics 
  ON attempts(student_user_id, question_id, is_correct, submitted_at)
  WHERE is_correct IS NOT NULL;

-- Index for correctness filtering
CREATE INDEX IF NOT EXISTS idx_attempts_correct 
  ON attempts(is_correct, submitted_at) 
  WHERE is_correct IS NOT NULL;

-- Index for question filtering (tutor views)
CREATE INDEX IF NOT EXISTS idx_questions_filters 
  ON questions(workspace_id, status, origin, difficulty)
  WHERE status = 'active';

-- Index for question stats queries
CREATE INDEX IF NOT EXISTS idx_questions_stats 
  ON questions(times_attempted DESC, times_correct DESC)
  WHERE times_attempted > 0;

-- Index for flags analytics
CREATE INDEX IF NOT EXISTS idx_question_flags_analytics 
  ON question_flags(question_id, status, created_at);


-- ============================================
-- SECTION 5: CREATE ai_usage_log TABLE
-- Track AI API usage for cost analytics and optimization
-- ============================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Operation details
  operation_type TEXT NOT NULL, -- 'generate_questions', 'generate_embedding', 'generate_assignment', etc.
  model TEXT NOT NULL, -- 'gpt-4o-mini', 'gpt-4o', 'text-embedding-3-small', etc.
  
  -- Token usage
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_total INTEGER,
  
  -- Cost tracking (USD)
  cost_usd DECIMAL(10, 6),
  
  -- Performance
  duration_ms INTEGER,
  
  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Context
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ai_usage_log
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace ON ai_usage_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_operation ON ai_usage_log(operation_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage_log(model, created_at DESC);

COMMENT ON TABLE ai_usage_log IS 
'Tracks all AI API calls for cost analytics, usage patterns, and optimization. Includes token counts, costs, timing, and success/failure status.';


-- ============================================
-- SECTION 6: CREATE question_batches TABLE
-- Track bulk question generation batches
-- ============================================

CREATE TABLE IF NOT EXISTS question_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- External IDs
  openai_batch_id TEXT,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Request details
  total_requested INTEGER NOT NULL,
  topics_requested UUID[],
  difficulty_distribution JSONB,
  generation_options JSONB DEFAULT '{}'::jsonb,
  
  -- Results
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  total_generated INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  questions_generated UUID[],
  
  -- Cost tracking
  total_tokens INTEGER,
  total_cost_usd DECIMAL(10, 6),
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT
);

-- Add batch_id reference to questions
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES question_batches(id) ON DELETE SET NULL;

-- Indexes for question_batches
CREATE INDEX IF NOT EXISTS idx_question_batches_workspace ON question_batches(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_batches_status ON question_batches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_batch ON questions(batch_id) WHERE batch_id IS NOT NULL;

COMMENT ON TABLE question_batches IS 
'Tracks bulk question generation operations. Links to generated questions and tracks costs, timing, and success rates.';


-- ============================================
-- SECTION 7: ENHANCE question_embeddings TABLE
-- Add metadata for better tracking
-- ============================================

ALTER TABLE question_embeddings
ADD COLUMN IF NOT EXISTS model_version TEXT,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER;


-- ============================================
-- SECTION 8: ADD SESSION TRACKING COLUMNS
-- For session outcome analytics
-- ============================================

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS topics_covered UUID[],
ADD COLUMN IF NOT EXISTS questions_reviewed UUID[],
ADD COLUMN IF NOT EXISTS session_notes TEXT,
ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sessions.session_metadata IS 
'Session outcome data: actual_duration_minutes, student_preparation, student_engagement, student_understanding, homework_assigned, goals_for_next_session';


-- ============================================
-- SECTION 9: ADD STUDENT COHORT TRACKING
-- For cohort-based analytics
-- ============================================

ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS academic_year INTEGER,
ADD COLUMN IF NOT EXISTS cohort_id TEXT,
ADD COLUMN IF NOT EXISTS cohort_name TEXT;

CREATE INDEX IF NOT EXISTS idx_student_profiles_cohort 
  ON student_profiles(workspace_id, cohort_id, academic_year);


-- ============================================
-- SECTION 10: ADD audit_log INSERTION FUNCTION
-- Make it easy to log audit events
-- ============================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_workspace_id UUID,
  p_actor_user_id UUID,
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO audit_log (
    workspace_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata_json,
    created_at
  ) VALUES (
    p_workspace_id,
    p_actor_user_id,
    p_action,
    p_target_type,
    p_target_id,
    p_metadata,
    NOW()
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit_event(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO service_role;

COMMENT ON FUNCTION log_audit_event IS 
'Helper function to insert audit log entries. Use for tracking important actions like question creation, assignment completion, etc.';


-- ============================================
-- SECTION 11: CREATE MATERIALIZED VIEW FOR STUDENT PERFORMANCE
-- Pre-computed stats for dashboard performance
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_student_performance AS
SELECT 
  a.student_user_id,
  a.workspace_id,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE a.is_correct = true) as correct_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct = true) / NULLIF(COUNT(*), 0), 2) as accuracy_pct,
  AVG(a.time_spent_seconds) FILTER (WHERE a.time_spent_seconds IS NOT NULL) as avg_time_seconds,
  COUNT(DISTINCT a.question_id) as unique_questions,
  COUNT(DISTINCT DATE(a.submitted_at)) as days_active,
  MAX(a.submitted_at) as last_attempt_at,
  MIN(a.submitted_at) as first_attempt_at
FROM attempts a
WHERE a.is_correct IS NOT NULL
GROUP BY a.student_user_id, a.workspace_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_student_performance 
  ON mv_student_performance(student_user_id, workspace_id);

COMMENT ON MATERIALIZED VIEW mv_student_performance IS 
'Pre-computed student performance metrics. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_performance;';


-- ============================================
-- SECTION 12: CREATE VIEW FOR TOPIC PERFORMANCE
-- Topic-level performance analytics
-- ============================================

CREATE OR REPLACE VIEW vw_topic_performance AS
SELECT 
  q.workspace_id,
  q.topic_id,
  t.name as topic_name,
  COUNT(DISTINCT a.id) as total_attempts,
  COUNT(DISTINCT a.id) FILTER (WHERE a.is_correct = true) as correct_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct = true) / NULLIF(COUNT(*), 0), 2) as accuracy_pct,
  COUNT(DISTINCT a.student_user_id) as students_attempted,
  COUNT(DISTINCT q.id) as questions_in_topic,
  AVG(a.time_spent_seconds) FILTER (WHERE a.time_spent_seconds IS NOT NULL) as avg_time_seconds
FROM questions q
LEFT JOIN attempts a ON q.id = a.question_id
LEFT JOIN topics t ON q.topic_id = t.id
WHERE q.status = 'active'
GROUP BY q.workspace_id, q.topic_id, t.name;

COMMENT ON VIEW vw_topic_performance IS 
'Aggregated performance metrics by topic. Useful for identifying weak areas and curriculum gaps.';


-- ============================================
-- SECTION 13: CREATE question_stats_reconcile FUNCTION
-- Periodically reconcile question stats with actual attempts
-- ============================================

CREATE OR REPLACE FUNCTION reconcile_question_stats()
RETURNS TABLE(question_id UUID, old_attempted INTEGER, new_attempted INTEGER, old_correct INTEGER, new_correct INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH calculated_stats AS (
    SELECT 
      a.question_id,
      COUNT(*)::INTEGER as total_attempts,
      COUNT(*) FILTER (WHERE a.is_correct = true)::INTEGER as correct_attempts
    FROM attempts a
    GROUP BY a.question_id
  ),
  updates AS (
    UPDATE questions q
    SET 
      times_attempted = COALESCE(cs.total_attempts, 0),
      times_correct = COALESCE(cs.correct_attempts, 0),
      updated_at = NOW()
    FROM calculated_stats cs
    WHERE q.id = cs.question_id
    AND (q.times_attempted != cs.total_attempts OR q.times_correct != cs.correct_attempts)
    RETURNING q.id, q.times_attempted as old_attempted, cs.total_attempts as new_attempted,
              q.times_correct as old_correct, cs.correct_attempts as new_correct
  )
  SELECT * FROM updates;
END;
$$;

GRANT EXECUTE ON FUNCTION reconcile_question_stats() TO service_role;

COMMENT ON FUNCTION reconcile_question_stats IS 
'Reconciles question statistics (times_attempted, times_correct) with actual attempt counts. Run periodically to fix any drift. Returns rows that were updated.';


-- ============================================
-- SECTION 14: RLS POLICIES FOR NEW TABLES
-- ============================================

-- Enable RLS on ai_usage_log
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Tutors can view their workspace usage
CREATE POLICY "Tutors can view workspace AI usage" ON ai_usage_log
  FOR SELECT
  USING (
    workspace_id IS NULL OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = ai_usage_log.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('platform_owner', 'tutor')
    )
  );

-- Service role can insert (from job handlers)
CREATE POLICY "Service role can insert AI usage" ON ai_usage_log
  FOR INSERT
  WITH CHECK (true);

-- Enable RLS on question_batches
ALTER TABLE question_batches ENABLE ROW LEVEL SECURITY;

-- Tutors can view their workspace batches
CREATE POLICY "Tutors can view workspace batches" ON question_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = question_batches.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('platform_owner', 'tutor')
    )
  );

-- Tutors can create batches
CREATE POLICY "Tutors can create batches" ON question_batches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = question_batches.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('platform_owner', 'tutor')
    )
  );

-- Tutors can update their batches
CREATE POLICY "Tutors can update workspace batches" ON question_batches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = question_batches.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('platform_owner', 'tutor')
    )
  );


-- ============================================
-- SECTION 15: UPDATE jobs TABLE WITH NEW JOB TYPES
-- ============================================

-- Update the jobs type constraint to include new types
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_type_check;

ALTER TABLE jobs ADD CONSTRAINT jobs_type_check 
  CHECK (type IN (
    'EXTRACT_MATERIAL',
    'GENERATE_QUESTIONS', 
    'GENERATE_QUESTIONS_BATCH',
    'BATCH_GENERATE',
    'GENERATE_PDF',
    'REGEN_VARIANT',
    'DAILY_SPACED_REP_REFRESH',
    'PROCESS_BATCH_RESULT',
    'GENERATE_EMBEDDINGS',
    'RECONCILE_STATS',
    'REFRESH_MATERIALIZED_VIEWS'
  ));


-- ============================================
-- SECTION 16: CREATE HELPER FUNCTION FOR AI COST CALCULATION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_ai_cost(
  p_model TEXT,
  p_tokens_input INTEGER,
  p_tokens_output INTEGER
)
RETURNS DECIMAL(10, 6)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  input_cost DECIMAL(10, 8);
  output_cost DECIMAL(10, 8);
BEGIN
  -- Costs per 1M tokens (as of Dec 2024)
  CASE p_model
    WHEN 'gpt-4o' THEN
      input_cost := 2.50 / 1000000;  -- $2.50 per 1M input
      output_cost := 10.00 / 1000000; -- $10 per 1M output
    WHEN 'gpt-4o-mini' THEN
      input_cost := 0.15 / 1000000;  -- $0.15 per 1M input
      output_cost := 0.60 / 1000000;  -- $0.60 per 1M output
    WHEN 'text-embedding-3-small' THEN
      input_cost := 0.02 / 1000000;  -- $0.02 per 1M tokens
      output_cost := 0;
    WHEN 'text-embedding-3-large' THEN
      input_cost := 0.13 / 1000000;  -- $0.13 per 1M tokens
      output_cost := 0;
    ELSE
      -- Default fallback (gpt-4o-mini rates)
      input_cost := 0.15 / 1000000;
      output_cost := 0.60 / 1000000;
  END CASE;
  
  RETURN (COALESCE(p_tokens_input, 0) * input_cost) + (COALESCE(p_tokens_output, 0) * output_cost);
END;
$$;

COMMENT ON FUNCTION calculate_ai_cost IS 
'Calculates estimated AI API cost in USD based on model and token counts. Uses Dec 2024 pricing.';


-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Add migration record comment
COMMENT ON SCHEMA public IS 
'TutorAssist database schema. Last migration: 013_database_cleanup_and_analytics (2025-12-31)';
