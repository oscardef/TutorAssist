-- Migration 007: Simplify question status and improve answer handling
-- Date: 2024-12-27
-- Description: Remove 'needs_review' status, simplify answer validation

-- 1. Update any existing questions with needs_review status to active
-- (Data was wiped, but this ensures consistency going forward)
UPDATE questions SET status = 'active' WHERE status = 'needs_review';

-- 2. Add index for faster flag lookups by question
CREATE INDEX IF NOT EXISTS idx_question_flags_question ON question_flags(question_id);

-- 3. Update question status constraint to remove needs_review
-- First drop the old constraint, then add the new one
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check 
  CHECK (status IN ('active', 'archived', 'draft'));

-- 4. Add function to update question quality score when flagged
CREATE OR REPLACE FUNCTION update_question_quality_on_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrease quality score when a new flag is created
  IF TG_OP = 'INSERT' THEN
    UPDATE questions 
    SET quality_score = GREATEST(0, COALESCE(quality_score, 1.0) - 0.1)
    WHERE id = NEW.question_id;
  END IF;
  
  -- Increase quality score when flag is resolved as dismissed (false positive)
  IF TG_OP = 'UPDATE' AND NEW.status = 'dismissed' AND OLD.status != 'dismissed' THEN
    UPDATE questions 
    SET quality_score = LEAST(1.0, COALESCE(quality_score, 1.0) + 0.05)
    WHERE id = NEW.question_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for flag-based quality updates
DROP TRIGGER IF EXISTS update_question_quality_trigger ON question_flags;
CREATE TRIGGER update_question_quality_trigger
  AFTER INSERT OR UPDATE ON question_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_question_quality_on_flag();

-- 6. Add function to update question attempt statistics
CREATE OR REPLACE FUNCTION update_question_stats_on_attempt()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE questions 
  SET 
    times_attempted = COALESCE(times_attempted, 0) + 1,
    times_correct = CASE WHEN NEW.is_correct THEN COALESCE(times_correct, 0) + 1 ELSE times_correct END,
    avg_time_seconds = CASE 
      WHEN times_attempted IS NULL OR times_attempted = 0 THEN NEW.time_spent_seconds
      ELSE ROUND((COALESCE(avg_time_seconds, 0) * times_attempted + COALESCE(NEW.time_spent_seconds, 0)) / (times_attempted + 1))
    END
  WHERE id = NEW.question_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger for attempt statistics
DROP TRIGGER IF EXISTS update_question_stats_trigger ON attempts;
CREATE TRIGGER update_question_stats_trigger
  AFTER INSERT ON attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_question_stats_on_attempt();

-- 8. Add index for faster topic-based question queries
CREATE INDEX IF NOT EXISTS idx_questions_topic_status ON questions(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_workspace_status ON questions(workspace_id, status);
