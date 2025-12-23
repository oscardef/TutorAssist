-- Migration: Allow public access to invite tokens for unauthenticated users
-- This allows students to view invite details before signing up/logging in

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "invites_select_public" ON invite_tokens;

-- Create policy to allow anyone to read invite tokens
CREATE POLICY "invites_select_public" ON invite_tokens
    FOR SELECT USING (true);
