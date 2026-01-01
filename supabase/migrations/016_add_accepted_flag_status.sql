-- Add 'accepted' status to question_flags status check constraint
-- Migration: 016_add_accepted_flag_status.sql

-- Drop old status constraint and add new one with 'accepted'
ALTER TABLE question_flags 
  DROP CONSTRAINT IF EXISTS question_flags_status_check;

ALTER TABLE question_flags 
  ADD CONSTRAINT question_flags_status_check 
  CHECK (status IN ('pending', 'reviewed', 'fixed', 'dismissed', 'accepted'));

-- Add comment explaining the statuses
COMMENT ON COLUMN question_flags.status IS 'Flag status: pending (awaiting review), reviewed (looked at), fixed (issue resolved), dismissed (not an issue), accepted (student answer was correct)';
