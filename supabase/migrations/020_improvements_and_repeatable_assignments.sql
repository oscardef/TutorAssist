-- Migration 020: Student Dashboard Improvements & Repeatable Assignments
-- Adds support for:
-- 1. Repeatable assignments (allow_repeat flag)
-- 2. AI flag analysis storage
-- 3. Activity days tracking (from attempts)

-- ============================================
-- REPEATABLE ASSIGNMENTS
-- ============================================

-- Add allow_repeat flag to assignments
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS allow_repeat BOOLEAN DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN assignments.allow_repeat IS 'Whether students can retake this assignment multiple times';

-- Add attempt_number to attempts to track which attempt this is for repeatable assignments
ALTER TABLE attempts 
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

COMMENT ON COLUMN attempts.attempt_number IS 'For repeatable assignments: which attempt number this is (1 = first, 2 = second, etc.)';

-- ============================================
-- AI FLAG ANALYSIS STORAGE
-- ============================================

-- Add AI analysis storage to question_flags
ALTER TABLE question_flags 
ADD COLUMN IF NOT EXISTS ai_analysis_json JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN question_flags.ai_analysis_json IS 'AI-generated analysis: {recommendation, confidence, reasoning, suggestedAction, suggestedFix, issueCategory, patternTags}';

-- Index for querying flags by AI-identified patterns
CREATE INDEX IF NOT EXISTS idx_question_flags_ai_analysis ON question_flags USING gin (ai_analysis_json);

-- ============================================
-- HELPER VIEWS FOR ANALYTICS
-- ============================================

-- View to get activity days per student (based on attempts in practice or assignments)
CREATE OR REPLACE VIEW student_activity_days AS
SELECT 
  student_user_id,
  workspace_id,
  DATE(submitted_at AT TIME ZONE 'UTC') as activity_date,
  COUNT(*) as attempt_count,
  COUNT(*) FILTER (WHERE is_correct = true) as correct_count
FROM attempts
WHERE submitted_at IS NOT NULL
GROUP BY student_user_id, workspace_id, DATE(submitted_at AT TIME ZONE 'UTC');

-- View to get recent wrong questions for a student (for weak areas fallback)
CREATE OR REPLACE VIEW student_recent_wrong_questions AS
SELECT DISTINCT ON (a.student_user_id, a.question_id)
  a.student_user_id,
  a.workspace_id,
  a.question_id,
  q.topic_id,
  t.name as topic_name,
  a.submitted_at,
  q.prompt_text,
  q.prompt_latex,
  q.difficulty
FROM attempts a
JOIN questions q ON a.question_id = q.id
LEFT JOIN topics t ON q.topic_id = t.id
WHERE a.is_correct = false
  AND a.submitted_at > NOW() - INTERVAL '30 days'
ORDER BY a.student_user_id, a.question_id, a.submitted_at DESC;

-- ============================================
-- FLAG PATTERN ANALYSIS TABLE
-- ============================================

-- Store aggregated flag patterns for tutor review
CREATE TABLE IF NOT EXISTS flag_pattern_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Pattern identification
  pattern_category TEXT NOT NULL, -- e.g., 'ambiguous_wording', 'multiple_valid', 'calculation_error'
  pattern_description TEXT,
  
  -- Affected items
  question_ids UUID[] DEFAULT '{}',
  flag_ids UUID[] DEFAULT '{}',
  
  -- AI-generated summary
  ai_summary TEXT,
  suggested_fixes JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flag_patterns_workspace ON flag_pattern_summaries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_flag_patterns_status ON flag_pattern_summaries(status);

-- Trigger for updated_at
CREATE TRIGGER update_flag_patterns_updated_at BEFORE UPDATE ON flag_pattern_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on new table
ALTER TABLE flag_pattern_summaries ENABLE ROW LEVEL SECURITY;

-- Tutors and platform owners can manage patterns
CREATE POLICY "Tutors can view flag patterns"
  ON flag_pattern_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = flag_pattern_summaries.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('tutor', 'platform_owner')
    )
  );

CREATE POLICY "Tutors can manage flag patterns"
  ON flag_pattern_summaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = flag_pattern_summaries.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('tutor', 'platform_owner')
    )
  );
