-- Migration: Fix schema mismatches between database and application code
-- Clean version since there's no existing data to preserve

-- ============================================
-- FIX oauth_connections TABLE
-- ============================================

-- Make the old encrypted column nullable
ALTER TABLE oauth_connections 
ALTER COLUMN encrypted_refresh_token DROP NOT NULL;

-- Add the columns the application code expects
ALTER TABLE oauth_connections
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS provider_user_id TEXT;

-- ============================================
-- FIX sessions TABLE  
-- ============================================

-- Drop old columns we don't need
ALTER TABLE sessions
DROP COLUMN IF EXISTS title,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS starts_at,
DROP COLUMN IF EXISTS ends_at,
DROP COLUMN IF EXISTS change_request_text,
DROP COLUMN IF EXISTS change_request_at;

-- Rename columns to match application code
ALTER TABLE sessions
RENAME COLUMN student_user_id TO student_id;

ALTER TABLE sessions
RENAME COLUMN tutor_user_id TO tutor_id;

-- Add new columns the code expects
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS location TEXT;

-- Drop and recreate indexes with correct column names
DROP INDEX IF EXISTS idx_sessions_tutor;
DROP INDEX IF EXISTS idx_sessions_student;
DROP INDEX IF EXISTS idx_sessions_starts;

CREATE INDEX idx_sessions_tutor ON sessions(tutor_id);
CREATE INDEX idx_sessions_student ON sessions(student_id);
CREATE INDEX idx_sessions_scheduled ON sessions(scheduled_at);
