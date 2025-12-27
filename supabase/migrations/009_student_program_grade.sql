-- Migration: Add study program and grade level to student profiles
-- Allows linking students directly to their curriculum/program

-- Add the new columns
ALTER TABLE student_profiles 
ADD COLUMN IF NOT EXISTS study_program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_profiles_program ON student_profiles(study_program_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_grade ON student_profiles(grade_level_id);

-- Optional: Comment on columns
COMMENT ON COLUMN student_profiles.study_program_id IS 'The study program this student follows (e.g., IB, GCSE, Common Core)';
COMMENT ON COLUMN student_profiles.grade_level_id IS 'The current grade level of the student within their program';
