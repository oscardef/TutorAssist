-- Migration: Update answer types to support more question formats
-- Date: 2025-12-27

-- Drop old constraint and add new one
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_answer_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_answer_type_check 
  CHECK (answer_type IN ('multiple_choice', 'short_answer', 'long_answer', 'true_false', 'fill_blank', 'matching'));

-- Migrate existing data to new answer types
UPDATE questions SET answer_type = 'short_answer' WHERE answer_type IN ('exact', 'numeric', 'expression');

-- Add comment for documentation
COMMENT ON COLUMN questions.answer_type IS 'Question answer type: multiple_choice, short_answer, long_answer, true_false, fill_blank, matching';
