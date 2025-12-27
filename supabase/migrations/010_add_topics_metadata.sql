-- Migration 010: Add metadata column to topics table
-- This enables storing subtopics, learning objectives, difficulty, and generation metadata

-- Add metadata JSONB column to topics
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_topics_metadata ON topics USING gin(metadata);

-- Add comment for documentation
COMMENT ON COLUMN topics.metadata IS 'Stores subtopics, learning_objectives, difficulty, generated_from, source_program_id, source_grade_level_id';

-- Example metadata structure:
-- {
--   "difficulty": 3,
--   "subtopics": ["Differentiation Rules", "Chain Rule", "Product Rule"],
--   "learning_objectives": ["Understand basic derivatives", "Apply differentiation rules"],
--   "generated_from": "ai",
--   "source_program_id": null,
--   "source_grade_level_id": null
-- }
