-- Migration: Add additional emails to student profiles for calendar sync
-- Run this after the initial schema.sql

-- Add additional_emails array to student_profiles
ALTER TABLE student_profiles 
ADD COLUMN IF NOT EXISTS additional_emails TEXT[] DEFAULT '{}';

-- Add parent_email column for convenience
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS parent_email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_student_profiles_email ON student_profiles(email);
CREATE INDEX IF NOT EXISTS idx_student_profiles_parent_email ON student_profiles(parent_email);

-- Add full text search on emails for matching calendar attendees
CREATE OR REPLACE FUNCTION get_student_by_email(lookup_email TEXT, workspace UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  parent_email TEXT,
  additional_emails TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    sp.email,
    sp.parent_email,
    sp.additional_emails
  FROM student_profiles sp
  WHERE sp.workspace_id = workspace
    AND (
      sp.email = lookup_email 
      OR sp.parent_email = lookup_email
      OR lookup_email = ANY(sp.additional_emails)
    );
END;
$$ LANGUAGE plpgsql;

-- Add question content hash for duplicate detection
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create function to generate content hash
CREATE OR REPLACE FUNCTION generate_question_hash() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_hash = md5(lower(trim(NEW.prompt_text)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate hash
DROP TRIGGER IF EXISTS question_hash_trigger ON questions;
CREATE TRIGGER question_hash_trigger 
BEFORE INSERT OR UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION generate_question_hash();

-- Create index on content hash for fast duplicate lookups
CREATE INDEX IF NOT EXISTS idx_questions_content_hash ON questions(workspace_id, content_hash);
