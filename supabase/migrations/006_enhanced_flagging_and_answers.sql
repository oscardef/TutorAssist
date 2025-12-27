-- Enhanced Flagging System and Multiple Answers Support
-- Migration: 006_enhanced_flagging_and_answers.sql

-- ============================================
-- 1. ENHANCED FLAG TYPES
-- ============================================

-- Drop old constraint and add new flag types including 'claim_correct'
ALTER TABLE question_flags 
  DROP CONSTRAINT IF EXISTS question_flags_flag_type_check;

ALTER TABLE question_flags 
  ADD CONSTRAINT question_flags_flag_type_check 
  CHECK (flag_type IN (
    'incorrect_answer',    -- Original answer is wrong
    'unclear',             -- Question is confusing
    'typo',                -- Typo in question/answer
    'too_hard',            -- Difficulty mismatch
    'claim_correct',       -- Student claims their answer was correct
    'missing_content',     -- Missing information
    'multiple_valid',      -- Multiple valid answers exist
    'other'                -- Other issues
  ));

-- Add column to store student's answer when claiming correctness
ALTER TABLE question_flags 
  ADD COLUMN IF NOT EXISTS student_answer TEXT,
  ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES attempts(id) ON DELETE SET NULL;

-- Create index for attempt lookups
CREATE INDEX IF NOT EXISTS idx_question_flags_attempt ON question_flags(attempt_id);

-- ============================================
-- 2. MULTIPLE CORRECT ANSWERS SUPPORT
-- ============================================

-- The correct_answer_json column already supports flexible JSON structure
-- We'll use this format:
-- Single answer: {"value": "5m"}
-- Multiple answers: {"value": "5m", "alternates": ["5 meters", "5 metres", "five meters"]}
-- With normalization hints: {"value": "5m", "alternates": [...], "normalize_rules": ["strip_units", "lowercase"]}

-- Add a column for easy lookup of all valid answers (denormalized for search)
ALTER TABLE questions 
  ADD COLUMN IF NOT EXISTS alternate_answers_json JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN questions.alternate_answers_json IS 'Array of alternate acceptable answers: ["5 meters", "5 metres", "five meters"]';

-- ============================================
-- 3. UPDATE ATTEMPTS TABLE
-- ============================================

-- Track if student overrode the marking
ALTER TABLE attempts 
  ADD COLUMN IF NOT EXISTS override_correct BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_is_correct BOOLEAN;

COMMENT ON COLUMN attempts.override_correct IS 'True if student claimed their answer was correct';
COMMENT ON COLUMN attempts.original_is_correct IS 'The original automated marking before any override';

-- ============================================
-- 4. PRESELECTED FLAG REASONS TABLE
-- ============================================

-- Create table for preselected flag reasons (workspace-configurable)
CREATE TABLE IF NOT EXISTS flag_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL,
    reason_text TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flag_reasons_workspace ON flag_reasons(workspace_id);

-- Insert default flag reasons
INSERT INTO flag_reasons (workspace_id, flag_type, reason_text, order_index) 
SELECT w.id, 'incorrect_answer', 'The correct answer shown is wrong', 1 FROM workspaces w
ON CONFLICT DO NOTHING;

INSERT INTO flag_reasons (workspace_id, flag_type, reason_text, order_index) 
SELECT w.id, 'unclear', 'The question is confusing or unclear', 2 FROM workspaces w
ON CONFLICT DO NOTHING;

INSERT INTO flag_reasons (workspace_id, flag_type, reason_text, order_index) 
SELECT w.id, 'typo', 'There is a typo in the question or answer', 3 FROM workspaces w
ON CONFLICT DO NOTHING;

INSERT INTO flag_reasons (workspace_id, flag_type, reason_text, order_index) 
SELECT w.id, 'too_hard', 'This question is too difficult for its assigned level', 4 FROM workspaces w
ON CONFLICT DO NOTHING;

INSERT INTO flag_reasons (workspace_id, flag_type, reason_text, order_index) 
SELECT w.id, 'claim_correct', 'I believe my answer is correct', 5 FROM workspaces w
ON CONFLICT DO NOTHING;

-- RLS for flag_reasons
ALTER TABLE flag_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flag_reasons_select" ON flag_reasons;
CREATE POLICY "flag_reasons_select" ON flag_reasons
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "flag_reasons_manage" ON flag_reasons;
CREATE POLICY "flag_reasons_manage" ON flag_reasons
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('tutor', 'platform_owner')
        )
    );

-- ============================================
-- 5. ANSWER NORMALIZATION HELPERS
-- ============================================

-- Create a function to check if an answer matches any acceptable answers
CREATE OR REPLACE FUNCTION check_answer_match(
    user_answer TEXT,
    correct_answer_json JSONB,
    alternate_answers JSONB DEFAULT '[]'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
    normalized_user TEXT;
    correct_value TEXT;
    alt_answer TEXT;
BEGIN
    -- Normalize user answer
    normalized_user := lower(trim(regexp_replace(user_answer, '\s+', '', 'g')));
    
    -- Check main correct answer
    correct_value := lower(trim(regexp_replace(correct_answer_json->>'value', '\s+', '', 'g')));
    IF normalized_user = correct_value THEN
        RETURN true;
    END IF;
    
    -- Check alternates in correct_answer_json
    IF correct_answer_json ? 'alternates' THEN
        FOR alt_answer IN SELECT jsonb_array_elements_text(correct_answer_json->'alternates')
        LOOP
            IF normalized_user = lower(trim(regexp_replace(alt_answer, '\s+', '', 'g'))) THEN
                RETURN true;
            END IF;
        END LOOP;
    END IF;
    
    -- Check separate alternates array
    FOR alt_answer IN SELECT jsonb_array_elements_text(alternate_answers)
    LOOP
        IF normalized_user = lower(trim(regexp_replace(alt_answer, '\s+', '', 'g'))) THEN
            RETURN true;
        END IF;
    END LOOP;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION check_answer_match IS 'Check if user answer matches any acceptable answer (normalized comparison)';

-- ============================================
-- 6. DATA CLEANUP HELPER FUNCTION
-- ============================================

-- Function to migrate correct_answer_json to support alternates
CREATE OR REPLACE FUNCTION add_alternate_answer(
    question_id_param UUID,
    alternate_answer TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    current_json JSONB;
    alternates JSONB;
BEGIN
    -- Get current answer JSON
    SELECT correct_answer_json INTO current_json
    FROM questions WHERE id = question_id_param;
    
    IF current_json IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get or create alternates array
    alternates := COALESCE(current_json->'alternates', '[]'::jsonb);
    
    -- Add new alternate if not already present
    IF NOT alternates @> to_jsonb(alternate_answer) THEN
        alternates := alternates || to_jsonb(alternate_answer);
        
        -- Update the question
        UPDATE questions 
        SET correct_answer_json = current_json || jsonb_build_object('alternates', alternates),
            updated_at = NOW()
        WHERE id = question_id_param;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_alternate_answer IS 'Add an alternate acceptable answer to a question';
