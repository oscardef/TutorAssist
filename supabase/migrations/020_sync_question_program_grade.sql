-- Migration: Sync question program/grade from their topics
-- This ensures questions inherit their topic's program and grade level
-- Run this after migration 008 (programs_and_grade_levels)

-- Update questions to have primary_program_id from their topic
UPDATE questions q
SET primary_program_id = t.program_id
FROM topics t
WHERE q.topic_id = t.id
  AND q.primary_program_id IS NULL
  AND t.program_id IS NOT NULL;

-- Update questions to have primary_grade_level_id from their topic
UPDATE questions q
SET primary_grade_level_id = t.grade_level_id
FROM topics t
WHERE q.topic_id = t.id
  AND q.primary_grade_level_id IS NULL
  AND t.grade_level_id IS NOT NULL;

-- Add a comment explaining the relationship
COMMENT ON COLUMN questions.primary_program_id IS 'The primary study program this question belongs to. If NULL, falls back to topic''s program_id.';
COMMENT ON COLUMN questions.primary_grade_level_id IS 'The primary grade level for this question. If NULL, falls back to topic''s grade_level_id.';
