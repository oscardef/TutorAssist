-- Add parent assignment grouping for sub-assignments
-- This allows sub-assignments to be grouped under a parent assignment

-- Add parent_assignment_id column to assignments
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS parent_assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_assignments_parent ON assignments(parent_assignment_id);

-- Comment explaining the column
COMMENT ON COLUMN assignments.parent_assignment_id IS 'For sub-assignments, references the parent assignment. NULL for top-level assignments.';
