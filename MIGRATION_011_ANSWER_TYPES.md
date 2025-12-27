# Answer Types Migration - 011

**Date**: December 27, 2025

## What Changed

This migration expands the available answer types for questions to support a wider variety of question formats beyond just multiple choice and exact answers.

## New Answer Types

The system now supports the following answer types:

1. **short_answer** - Short text answers (replaces legacy 'exact')
2. **long_answer** - Essay or paragraph answers
3. **numeric** - Number answers with optional tolerance
4. **expression** - Mathematical expressions
5. **multiple_choice** - Multiple choice with options
6. **true_false** - True/False questions
7. **fill_blank** - Fill in the blank questions
8. **matching** - Matching pairs

## Migration Required

You need to run the SQL migration to update your database schema:

```bash
# Using psql
psql $DATABASE_URL -f supabase/migrations/011_answer_types_expansion.sql

# Or using Supabase CLI (if installed)
supabase db push

# Or manually execute the SQL in your Supabase SQL editor
```

## What the Migration Does

1. Drops the old `questions_answer_type_check` constraint
2. Adds a new constraint that includes all the new answer types
3. Migrates any existing 'exact' answer types to 'short_answer'
4. Adds a comment explaining the available types

## Code Changes

### Files Updated

- **Schema**: `supabase/migrations/011_answer_types_expansion.sql`
- **Types**: `src/lib/types.ts` - Updated AnswerType
- **Prompts**: `src/lib/prompts/question-generation.ts` - Updated AI prompts with new answer formats
- **Handler**: `src/lib/jobs/handlers/generate-questions.ts` - Improved answer type normalization
- **Display**: `src/components/answer-display.tsx` - New component for rendering answers
- **Question Bank**: `src/app/tutor/questions/QuestionBankClient.tsx` - Uses new display components

### New Components

**AnswerDisplay** - Renders answers appropriately based on type:
- Multiple choice shows the correct option
- Numeric/expression shows value with optional unit
- True/False shows True or False
- Fill-in-blank shows each blank
- Matching shows pairs
- Long answer shows rubric and key points

**AnswerTypeBadge** - Shows color-coded badge for each answer type

## Testing

After running the migration:

1. Try generating new questions - should work with any answer type
2. Check the question bank - answer types should display with colored badges
3. View existing questions - should display correctly with the new components

## Backward Compatibility

- Legacy 'exact' type is automatically converted to 'short_answer'
- Existing questions will continue to work
- The system normalizes various AI-returned answer types to valid ones

## Rollback

If needed, you can rollback by:

```sql
-- Revert to old types
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_answer_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_answer_type_check 
CHECK (answer_type IN ('exact', 'numeric', 'multiple_choice', 'expression'));

-- Convert short_answer back to exact
UPDATE questions SET answer_type = 'exact' WHERE answer_type = 'short_answer';
```

## Next Steps

The system is now ready to generate and display questions in multiple formats. The AI will automatically select appropriate question types based on the topic and context.
