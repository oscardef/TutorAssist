-- Migration: Add DELETE policy for student_profiles
-- This allows tutors to delete student profiles from their workspace

-- Drop the old policy if it exists (for idempotency)
DROP POLICY IF EXISTS "profiles_delete_tutor" ON student_profiles;

-- Create the DELETE policy for student_profiles
CREATE POLICY "profiles_delete_tutor" ON student_profiles
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );
