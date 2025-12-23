-- TutorAssist Helper Functions for RLS
-- Run this BEFORE rls.sql

-- Drop existing functions if they exist (CASCADE removes dependent policies)
DROP FUNCTION IF EXISTS is_platform_owner(uuid) CASCADE;
DROP FUNCTION IF EXISTS user_workspace_role(uuid, uuid) CASCADE;

-- Function to check if user is platform owner (first tutor in system)
CREATE FUNCTION is_platform_owner(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_members.user_id = $1
    AND workspace_members.role = 'tutor'
    ORDER BY workspace_members.created_at ASC
    LIMIT 1
  );
$$;

-- Function to get user's role in a workspace
CREATE FUNCTION user_workspace_role(user_id uuid, workspace_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text
  FROM workspace_members
  WHERE workspace_members.user_id = $1
  AND workspace_members.workspace_id = $2
  LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_platform_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_workspace_role(uuid, uuid) TO authenticated;

-- Grant service role permission to bypass RLS for administrative operations
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
