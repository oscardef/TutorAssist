-- Performance Optimization Migration
-- Adds indexes for common query patterns to improve dashboard and assignment loading times

-- Index for tutor dashboard: flags by workspace + status (partial index for pending)
CREATE INDEX IF NOT EXISTS idx_question_flags_workspace_pending 
  ON question_flags(workspace_id) 
  WHERE status = 'pending';

-- Index for student assignments: assigned_student_user_id + status combo
CREATE INDEX IF NOT EXISTS idx_assignments_student_status 
  ON assignments(assigned_student_user_id, status);

-- Index for student dashboard: spaced_repetition due items lookup
CREATE INDEX IF NOT EXISTS idx_spaced_rep_student_due 
  ON spaced_repetition(student_user_id, next_due);

-- Index for attempts by assignment (used in assignment progress calculation)
CREATE INDEX IF NOT EXISTS idx_attempts_assignment_student 
  ON attempts(assignment_id, student_user_id) 
  WHERE assignment_id IS NOT NULL;

-- Index for attempts analytics queries (streak calculation, recent activity)
CREATE INDEX IF NOT EXISTS idx_attempts_student_submitted 
  ON attempts(student_user_id, submitted_at DESC);

-- Index for sessions by workspace and scheduled time (tutor dashboard)
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_scheduled 
  ON sessions(workspace_id, scheduled_at);

-- Index for sessions by student (student dashboard)
CREATE INDEX IF NOT EXISTS idx_sessions_student_scheduled 
  ON sessions(student_id, scheduled_at);

-- Composite index for assignments due soon query
CREATE INDEX IF NOT EXISTS idx_assignments_workspace_status_due 
  ON assignments(workspace_id, status, due_at) 
  WHERE status = 'active';

-- Index for assignment items by assignment (used when loading assignment details)
CREATE INDEX IF NOT EXISTS idx_assignment_items_assignment 
  ON assignment_items(assignment_id);

-- Analyze tables to update statistics for query planner
ANALYZE question_flags;
ANALYZE assignments;
ANALYZE spaced_repetition;
ANALYZE attempts;
ANALYZE sessions;
ANALYZE assignment_items;

-- Add comment explaining the migration
COMMENT ON INDEX idx_question_flags_workspace_pending IS 'Partial index for pending flags count on tutor dashboard';
COMMENT ON INDEX idx_assignments_student_status IS 'Speeds up student assignment list queries';
COMMENT ON INDEX idx_spaced_rep_student_due IS 'Speeds up due items lookup for spaced repetition';
COMMENT ON INDEX idx_attempts_assignment_student IS 'Speeds up assignment progress calculation';
COMMENT ON INDEX idx_attempts_student_submitted IS 'Speeds up recent activity and streak calculation';
