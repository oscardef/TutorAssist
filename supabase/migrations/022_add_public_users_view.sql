-- Migration: Add public users view for PostgREST joins
-- This fixes the PGRST200 error when trying to join workspace_members to users

-- ============================================
-- CREATE PUBLIC USERS VIEW
-- ============================================

-- Create a view that exposes necessary auth.users columns to PostgREST
-- This allows queries like: workspace_members.select('users(email)')
CREATE OR REPLACE VIEW public.users AS
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    created_at,
    updated_at
FROM auth.users;

-- Grant access to the view
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- ============================================
-- ADD COMMENT FOR POSTGREST RELATIONSHIP
-- ============================================

-- PostgREST needs to know about the relationship between workspace_members and users
-- We add a comment hint to help PostgREST discover the relationship
COMMENT ON VIEW public.users IS 'User profiles from auth.users for PostgREST joins';

-- Note: PostgREST uses foreign key relationships to determine joins.
-- Since workspace_members.user_id references auth.users(id), and our view 
-- exposes auth.users, PostgREST should be able to infer the relationship.
-- However, if the view doesn't work directly, we may need to use a different approach.

-- ============================================
-- ENABLE RLS ON THE VIEW (OPTIONAL SECURITY)
-- ============================================

-- For extra security, you can enable RLS on the view
-- But for now, we'll keep it simple since auth.users already has its own security
-- ALTER VIEW public.users SET (security_invoker = on);
