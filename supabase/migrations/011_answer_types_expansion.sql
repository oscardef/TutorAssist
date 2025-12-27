-- Migration: Expand answer types to support more question formats
-- Date: 2025-12-27

-- Drop the old constraint and add the new one
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_answer_type_check;

ALTER TABLE questions 
ADD CONSTRAINT questions_answer_type_check 
CHECK (answer_type IN (
  'exact',           -- Short text answer (legacy)
  'numeric',         -- Number answer (legacy)
  'expression',      -- Math expression (legacy)
  'multiple_choice', -- Multiple choice (legacy)
  'short_answer',    -- Short text answer (new)
  'long_answer',     -- Long text answer/essay
  'true_false',      -- True/False question
  'fill_blank',      -- Fill in the blank
  'matching'         -- Matching pairs
));

-- Update any old 'exact' types to 'short_answer' for clarity
UPDATE questions 
SET answer_type = 'short_answer' 
WHERE answer_type = 'exact';

-- Add comment explaining the types
COMMENT ON COLUMN questions.answer_type IS 
'Question answer type: short_answer, long_answer, numeric, expression, multiple_choice, true_false, fill_blank, matching';
