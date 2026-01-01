-- Add assigned tutor to student profiles
-- This allows tutors to be assigned to specific students

ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS assigned_tutor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add grade rollover month (1-12, default September which is 9)
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS grade_rollover_month INTEGER DEFAULT 9 CHECK (grade_rollover_month BETWEEN 1 AND 12);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_profiles_tutor ON student_profiles(assigned_tutor_id);

-- Comment explaining the columns
COMMENT ON COLUMN student_profiles.assigned_tutor_id IS 'The tutor assigned to this student. Used for displaying tutor info on student dashboard.';
COMMENT ON COLUMN student_profiles.grade_rollover_month IS 'Month (1-12) when the student grade auto-advances. Default is September (9).';

-- Auto-grade rollover function
-- This function updates student grade levels at the start of each academic year
CREATE OR REPLACE FUNCTION auto_rollover_grades()
RETURNS void AS $$
DECLARE
    student RECORD;
    next_grade RECORD;
BEGIN
    -- Find students due for grade rollover this month
    FOR student IN 
        SELECT sp.id, sp.grade_level_id, sp.grade_rollover_month, gl.study_program_id, gl.year_number, gl.order_index
        FROM student_profiles sp
        JOIN grade_levels gl ON sp.grade_level_id = gl.id
        WHERE sp.grade_rollover_month = EXTRACT(MONTH FROM CURRENT_DATE)
        AND sp.grade_level_id IS NOT NULL
    LOOP
        -- Find the next grade level in the same program
        SELECT * INTO next_grade
        FROM grade_levels
        WHERE study_program_id = student.study_program_id
        AND order_index > student.order_index
        ORDER BY order_index ASC
        LIMIT 1;
        
        -- Update if next grade exists
        IF next_grade.id IS NOT NULL THEN
            UPDATE student_profiles
            SET grade_level_id = next_grade.id,
                updated_at = NOW()
            WHERE id = student.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Comment on function
COMMENT ON FUNCTION auto_rollover_grades() IS 'Automatically advances students to the next grade level when their rollover month arrives';
