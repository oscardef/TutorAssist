-- Migration 017: Add numeric and expression answer types back to database
-- This aligns the database constraint with the TypeScript AnswerType enum

-- Update the answer_type constraint to include 'numeric' and 'expression' types
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_answer_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_answer_type_check 
  CHECK (answer_type IN (
    'multiple_choice',
    'short_answer', 
    'long_answer', 
    'true_false', 
    'fill_blank', 
    'matching',
    'numeric',     -- Added: for pure numeric answers with tolerance
    'expression'   -- Added: for math expressions (algebraic)
  ));

-- Add comment explaining answer types
COMMENT ON COLUMN questions.answer_type IS 'Type of answer expected:
- multiple_choice: Select from options
- short_answer: Text/math answer (general)
- long_answer: Essay/paragraph response
- true_false: Boolean answer
- fill_blank: Fill in missing parts
- matching: Match pairs
- numeric: Pure number with tolerance checking
- expression: Algebraic expression with symbolic equivalence';

-- Note: The enhanced math-utils.ts now handles all answer type validation
-- with improved equivalence checking including:
-- - Fraction to decimal conversion (1/2 = 0.5)
-- - Mixed numbers (1 1/2 = 1.5)
-- - Scientific notation (3.14e2 = 314)
-- - Percentage conversion (50% = 0.5)
-- - Symbolic algebra (2x+1 = 1+2x)
-- - Smart tolerance based on magnitude
