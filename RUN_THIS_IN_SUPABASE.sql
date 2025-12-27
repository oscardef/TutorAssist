-- ============================================
-- ANSWER TYPES EXPANSION MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop old constraint
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_answer_type_check;

-- Step 2: Add new constraint with all answer types
ALTER TABLE questions 
ADD CONSTRAINT questions_answer_type_check 
CHECK (answer_type IN (
  'short_answer',    -- Short text answer (replaces 'exact')
  'long_answer',     -- Essay/paragraph answer
  'numeric',         -- Number answer
  'expression',      -- Math expression
  'multiple_choice', -- Multiple choice with options
  'true_false',      -- True/False question
  'fill_blank',      -- Fill in the blank
  'matching',        -- Matching pairs
  'exact'            -- Legacy - being phased out
));

-- Step 3: Migrate old 'exact' types to 'short_answer'
-- (Uncomment the line below if you want to migrate existing data)
-- UPDATE questions SET answer_type = 'short_answer' WHERE answer_type = 'exact';

-- Step 4: Add helpful comment
COMMENT ON COLUMN questions.answer_type IS 
'Question answer type: short_answer, long_answer, numeric, expression, multiple_choice, true_false, fill_blank, matching';

-- Done! You should see "Success. No rows returned"
