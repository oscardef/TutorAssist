# Database Migration Instructions

## Migration 011: Update Answer Types

This migration updates the `questions` table to support more flexible answer types.

### New Answer Types
- `multiple_choice` - Multiple choice questions with 2-5 options
- `short_answer` - Short answer (single word/number/expression)
- `long_answer` - Essay/explanation style answers  
- `true_false` - True/False questions
- `fill_blank` - Fill in the blank questions
- `matching` - Matching pairs questions

### Running the Migration

**Option 1: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/011_update_answer_types.sql`
4. Click "Run"

**Option 2: Using psql (if you have direct database access)**
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/011_update_answer_types.sql
```

**Option 3: Using Supabase CLI**
```bash
supabase db push
```

### What This Migration Does
1. Drops the old answer_type constraint
2. Adds a new constraint with the updated answer types
3. Migrates existing data:
   - `exact` → `short_answer`
   - `numeric` → `short_answer`
   - `expression` → `short_answer`
   - `multiple_choice` → `multiple_choice` (unchanged)

### After Migration
- Existing questions will continue to work
- New questions can use any of the 6 answer types
- The question generation system will use the new types
- Display components automatically handle all types

### Rollback (if needed)
```sql
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_answer_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_answer_type_check 
  CHECK (answer_type IN ('exact', 'numeric', 'multiple_choice', 'expression'));
UPDATE questions SET answer_type = 'exact' WHERE answer_type IN ('short_answer', 'long_answer', 'true_false', 'fill_blank', 'matching');
```
