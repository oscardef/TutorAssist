# Migration 010 - Topics Metadata Support

## Problem
When generating topics/syllabus, the API was trying to insert a `metadata` column that didn't exist in the `topics` table, causing a 500 error:
```
"Could not find the 'metadata' column of 'topics' in the schema cache"
```

## Solution
Added `metadata` JSONB column to store subtopics, learning objectives, difficulty, and generation metadata.

## SQL to Run (REQUIRED!)

**Run this in Supabase SQL Editor NOW:**

```sql
-- Add metadata JSONB column to topics
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_topics_metadata ON topics USING gin(metadata);

-- Add comment for documentation
COMMENT ON COLUMN topics.metadata IS 'Stores subtopics, learning_objectives, difficulty, generated_from, source_program_id, source_grade_level_id';
```

## What's Stored in Metadata

```json
{
  "difficulty": 3,
  "subtopics": [
    "Differentiation Rules",
    "Chain Rule", 
    "Product Rule"
  ],
  "learning_objectives": [
    "Understand basic derivatives",
    "Apply differentiation rules"
  ],
  "generated_from": "ai",
  "source_program_id": null,
  "source_grade_level_id": null
}
```

## UI Enhancements

### Topics Page
Now displays:
- **Subtopics**: Shows as a bullet-separated list below topic name
- **Learning Objectives**: Shows first 2 objectives with "+X more" if there are more
- Clean, compact display that doesn't clutter the UI

### Example Display:
```
📘 Calculus I - Derivatives
    IB Math HL • Year 1 • Introduction to derivatives and applications
    Subtopics: Differentiation Rules • Chain Rule • Product Rule
    Objectives: Understand basic derivatives • Apply differentiation rules
```

## Files Changed

1. ✅ `supabase/migrations/010_add_topics_metadata.sql` - Migration file (for reference)
2. ✅ `src/app/tutor/topics/page.tsx` - Updated to display subtopics and objectives
3. ✅ `src/app/api/syllabus/generate/route.ts` - Already inserting metadata (no change needed)

## Testing After Migration

1. Run the SQL above in Supabase
2. Go to Generate → Topics/Syllabus
3. Create a new topic set (leave count blank to test AI)
4. Go to Topics page
5. Verify subtopics and learning objectives are displayed

## Status
⚠️ **ACTION REQUIRED**: Run the SQL migration above before generating topics!
