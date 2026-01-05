-- Migration 019: Add RLS policy for students to update their own assignments
-- This allows students to mark assignments as completed or redo them

-- Drop existing policy if it exists (to make migration idempotent)
DROP POLICY IF EXISTS "assignments_update_student" ON assignments;

-- Create policy allowing students to update assignments assigned to them
-- Students can only update status to 'completed' or 'active' (for redo)
-- The API layer enforces the specific status values allowed
CREATE POLICY "assignments_update_student" ON assignments
    FOR UPDATE USING (
        assigned_student_user_id = auth.uid()
    )
    WITH CHECK (
        assigned_student_user_id = auth.uid()
    );

-- Add comment explaining the policy
COMMENT ON POLICY "assignments_update_student" ON assignments IS 
    'Students can update assignments assigned to them (e.g., to mark as completed)';
