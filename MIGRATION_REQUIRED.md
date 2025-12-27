# ⚠️ IMPORTANT: Database Migration Required

## Migration 009 - Student Program & Grade Level

Before the new student program/grade level features will work, you **MUST** run the following SQL in your Supabase dashboard:

### SQL to Run:

```sql
-- Add study_program_id and grade_level_id to student_profiles
ALTER TABLE student_profiles 
ADD COLUMN IF NOT EXISTS study_program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_student_profiles_program ON student_profiles(study_program_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_grade ON student_profiles(grade_level_id);
```

### How to Apply:

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Paste the SQL above
5. Click **Run**

### What This Enables:

- Students can be assigned to specific study programs (IB, GCSE, etc.)
- Students can be assigned to specific grade levels
- Better filtering and organization of content by student level
- Enhanced student creation page with program/grade selection

### Migration File Location:

The full migration is saved in:
```
supabase/migrations/009_student_program_grade.sql
```

---

## ✅ Verification

After running the migration, verify it worked:

```sql
-- Check that columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'student_profiles' 
  AND column_name IN ('study_program_id', 'grade_level_id');
```

You should see both columns listed.

---

**Status**: ⚠️ **PENDING** - Run this migration now!
