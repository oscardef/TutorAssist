-- Add grade level to questions for better targeting
-- Grade levels: 1-12 for primary/secondary, 13+ for advanced/university

-- Add grade_level column to questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS grade_level INTEGER;

-- Add check constraint for valid grade levels (1-16, where 13-16 is post-secondary)
ALTER TABLE questions ADD CONSTRAINT check_grade_level 
  CHECK (grade_level IS NULL OR (grade_level >= 1 AND grade_level <= 16));

-- Create index for grade level filtering
CREATE INDEX IF NOT EXISTS idx_questions_grade_level ON questions(grade_level);

-- Add grade_level to topics as well for topic-level grade targeting
ALTER TABLE topics ADD COLUMN IF NOT EXISTS grade_level_min INTEGER;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS grade_level_max INTEGER;

-- Comments for documentation
COMMENT ON COLUMN questions.grade_level IS 'Target grade level: 1-12 for K-12, 13-16 for post-secondary';
COMMENT ON COLUMN topics.grade_level_min IS 'Minimum grade level for this topic';
COMMENT ON COLUMN topics.grade_level_max IS 'Maximum grade level for this topic';
