-- TutorAssist Row Level Security Policies
-- Enforces workspace isolation and role-based access

-- Drop all existing policies first (idempotent)
DROP POLICY IF EXISTS "workspace_select_member" ON workspaces;
DROP POLICY IF EXISTS "workspace_update_tutor" ON workspaces;
DROP POLICY IF EXISTS "workspace_insert_auth" ON workspaces;
DROP POLICY IF EXISTS "members_select_workspace" ON workspace_members;
DROP POLICY IF EXISTS "members_insert_tutor" ON workspace_members;
DROP POLICY IF EXISTS "members_update_tutor" ON workspace_members;
DROP POLICY IF EXISTS "members_delete_tutor" ON workspace_members;
DROP POLICY IF EXISTS "invites_select_tutor" ON invite_tokens;
DROP POLICY IF EXISTS "invites_insert_tutor" ON invite_tokens;
DROP POLICY IF EXISTS "invites_update_tutor" ON invite_tokens;
DROP POLICY IF EXISTS "invites_delete_tutor" ON invite_tokens;
DROP POLICY IF EXISTS "profiles_select" ON student_profiles;
DROP POLICY IF EXISTS "profiles_insert_tutor" ON student_profiles;
DROP POLICY IF EXISTS "profiles_update_tutor" ON student_profiles;
DROP POLICY IF EXISTS "topics_select_member" ON topics;
DROP POLICY IF EXISTS "topics_insert_tutor" ON topics;
DROP POLICY IF EXISTS "topics_update_tutor" ON topics;
DROP POLICY IF EXISTS "topics_delete_tutor" ON topics;
DROP POLICY IF EXISTS "materials_select_tutor" ON source_materials;
DROP POLICY IF EXISTS "materials_insert_tutor" ON source_materials;
DROP POLICY IF EXISTS "materials_update_tutor" ON source_materials;
DROP POLICY IF EXISTS "materials_delete_tutor" ON source_materials;
DROP POLICY IF EXISTS "questions_select_member" ON questions;
DROP POLICY IF EXISTS "questions_insert_tutor" ON questions;
DROP POLICY IF EXISTS "questions_update_tutor" ON questions;
DROP POLICY IF EXISTS "questions_delete_tutor" ON questions;
DROP POLICY IF EXISTS "assignments_select" ON assignments;
DROP POLICY IF EXISTS "assignments_insert_tutor" ON assignments;
DROP POLICY IF EXISTS "assignments_update_tutor" ON assignments;
DROP POLICY IF EXISTS "assignments_delete_tutor" ON assignments;
DROP POLICY IF EXISTS "assignment_items_select" ON assignment_items;
DROP POLICY IF EXISTS "assignment_items_insert_tutor" ON assignment_items;
DROP POLICY IF EXISTS "assignment_items_update_tutor" ON assignment_items;
DROP POLICY IF EXISTS "assignment_items_delete_tutor" ON assignment_items;
DROP POLICY IF EXISTS "attempts_select" ON attempts;
DROP POLICY IF EXISTS "attempts_insert_student" ON attempts;
DROP POLICY IF EXISTS "attempts_update_own" ON attempts;
DROP POLICY IF EXISTS "spaced_rep_select" ON spaced_repetition;
DROP POLICY IF EXISTS "spaced_rep_insert" ON spaced_repetition;
DROP POLICY IF EXISTS "spaced_rep_update" ON spaced_repetition;
DROP POLICY IF EXISTS "flags_select" ON question_flags;
DROP POLICY IF EXISTS "flags_insert_student" ON question_flags;
DROP POLICY IF EXISTS "flags_update_tutor" ON question_flags;
DROP POLICY IF EXISTS "feedback_select" ON tutor_feedback;
DROP POLICY IF EXISTS "feedback_insert_tutor" ON tutor_feedback;
DROP POLICY IF EXISTS "feedback_update_tutor" ON tutor_feedback;
DROP POLICY IF EXISTS "feedback_delete_tutor" ON tutor_feedback;
DROP POLICY IF EXISTS "sessions_select" ON sessions;
DROP POLICY IF EXISTS "sessions_insert_tutor" ON sessions;
DROP POLICY IF EXISTS "sessions_update_tutor" ON sessions;
DROP POLICY IF EXISTS "sessions_delete_tutor" ON sessions;
DROP POLICY IF EXISTS "oauth_select_own" ON oauth_connections;
DROP POLICY IF EXISTS "oauth_insert_own" ON oauth_connections;
DROP POLICY IF EXISTS "oauth_update_own" ON oauth_connections;
DROP POLICY IF EXISTS "oauth_delete_own" ON oauth_connections;
DROP POLICY IF EXISTS "audit_select_tutor" ON audit_log;
DROP POLICY IF EXISTS "audit_insert" ON audit_log;
DROP POLICY IF EXISTS "jobs_select" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_update" ON jobs;
DROP POLICY IF EXISTS "exports_select" ON pdf_exports;
DROP POLICY IF EXISTS "exports_insert" ON pdf_exports;
DROP POLICY IF EXISTS "exports_update" ON pdf_exports;
DROP POLICY IF EXISTS "exports_delete" ON pdf_exports;

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_exports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- WORKSPACES
-- ============================================

-- Users can view workspaces they belong to
CREATE POLICY "workspace_select_member" ON workspaces
    FOR SELECT USING (
        id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
        OR is_platform_owner(auth.uid())
    );

-- Tutors can update their workspace
CREATE POLICY "workspace_update_tutor" ON workspaces
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- Authenticated users can create workspaces (for new tutors)
CREATE POLICY "workspace_insert_auth" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- WORKSPACE MEMBERS
-- ============================================

-- Members can see other members in their workspace
CREATE POLICY "members_select_workspace" ON workspace_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR is_platform_owner(auth.uid())
    );

-- Tutors and platform owners can add members
CREATE POLICY "members_insert_tutor" ON workspace_members
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
        -- Allow self-insert when joining via invite
        OR user_id = auth.uid()
    );

-- Tutors can update members (but not platform owners)
CREATE POLICY "members_update_tutor" ON workspace_members
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- Tutors can remove members
CREATE POLICY "members_delete_tutor" ON workspace_members
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- ============================================
-- INVITE TOKENS
-- ============================================

-- Tutors can view their workspace invites
CREATE POLICY "invites_select_tutor" ON invite_tokens
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- Tutors can create invites
CREATE POLICY "invites_insert_tutor" ON invite_tokens
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- Tutors can delete/update invites
CREATE POLICY "invites_update_tutor" ON invite_tokens
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "invites_delete_tutor" ON invite_tokens
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- STUDENT PROFILES
-- ============================================

-- Tutors see all profiles in workspace, students see their own
CREATE POLICY "profiles_select" ON student_profiles
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR user_id = auth.uid()
        OR is_platform_owner(auth.uid())
    );

-- Tutors can create/update profiles
CREATE POLICY "profiles_insert_tutor" ON student_profiles
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

CREATE POLICY "profiles_update_tutor" ON student_profiles
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- ============================================
-- TOPICS
-- ============================================

-- Workspace members can view topics
CREATE POLICY "topics_select_member" ON topics
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

-- Tutors can manage topics
CREATE POLICY "topics_insert_tutor" ON topics
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "topics_update_tutor" ON topics
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "topics_delete_tutor" ON topics
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- SOURCE MATERIALS
-- ============================================

-- Tutors can view materials
CREATE POLICY "materials_select_tutor" ON source_materials
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

CREATE POLICY "materials_insert_tutor" ON source_materials
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "materials_update_tutor" ON source_materials
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "materials_delete_tutor" ON source_materials
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- QUESTIONS
-- ============================================

-- Workspace members can view active questions
CREATE POLICY "questions_select_member" ON questions
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

-- Tutors can manage questions
CREATE POLICY "questions_insert_tutor" ON questions
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

CREATE POLICY "questions_update_tutor" ON questions
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

CREATE POLICY "questions_delete_tutor" ON questions
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- ASSIGNMENTS
-- ============================================

-- Tutors see all assignments, students see their own
CREATE POLICY "assignments_select" ON assignments
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR assigned_student_user_id = auth.uid()
        OR assigned_student_user_id IS NULL -- Assigned to all
        OR is_platform_owner(auth.uid())
    );

-- Tutors can manage assignments
CREATE POLICY "assignments_insert_tutor" ON assignments
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "assignments_update_tutor" ON assignments
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "assignments_delete_tutor" ON assignments
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- ASSIGNMENT ITEMS
-- ============================================

-- Users can view items for assignments they can see
CREATE POLICY "assignment_items_select" ON assignment_items
    FOR SELECT USING (
        assignment_id IN (SELECT id FROM assignments)
    );

-- Tutors can manage items
CREATE POLICY "assignment_items_insert_tutor" ON assignment_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM assignments a
            WHERE a.id = assignment_id
            AND user_workspace_role(auth.uid(), a.workspace_id) = 'tutor'
        )
    );

CREATE POLICY "assignment_items_update_tutor" ON assignment_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM assignments a
            WHERE a.id = assignment_id
            AND user_workspace_role(auth.uid(), a.workspace_id) = 'tutor'
        )
    );

CREATE POLICY "assignment_items_delete_tutor" ON assignment_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM assignments a
            WHERE a.id = assignment_id
            AND user_workspace_role(auth.uid(), a.workspace_id) = 'tutor'
        )
    );

-- ============================================
-- ATTEMPTS
-- ============================================

-- Tutors see all attempts, students see their own
CREATE POLICY "attempts_select" ON attempts
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR student_user_id = auth.uid()
        OR is_platform_owner(auth.uid())
    );

-- Students can submit attempts
CREATE POLICY "attempts_insert_student" ON attempts
    FOR INSERT WITH CHECK (
        student_user_id = auth.uid()
        AND workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

-- Students can update their own attempts (e.g., reflection)
CREATE POLICY "attempts_update_own" ON attempts
    FOR UPDATE USING (
        student_user_id = auth.uid()
        OR user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- SPACED REPETITION
-- ============================================

-- Students see their own, tutors see all in workspace
CREATE POLICY "spaced_rep_select" ON spaced_repetition
    FOR SELECT USING (
        student_user_id = auth.uid()
        OR user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- System can manage spaced repetition (via service role)
CREATE POLICY "spaced_rep_insert" ON spaced_repetition
    FOR INSERT WITH CHECK (
        student_user_id = auth.uid()
        OR user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "spaced_rep_update" ON spaced_repetition
    FOR UPDATE USING (
        student_user_id = auth.uid()
        OR user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- QUESTION FLAGS
-- ============================================

-- Tutors see all flags, students see their own
CREATE POLICY "flags_select" ON question_flags
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR student_user_id = auth.uid()
        OR is_platform_owner(auth.uid())
    );

-- Students can create flags
CREATE POLICY "flags_insert_student" ON question_flags
    FOR INSERT WITH CHECK (
        student_user_id = auth.uid()
        AND workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

-- Tutors can update flags (review)
CREATE POLICY "flags_update_tutor" ON question_flags
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- TUTOR FEEDBACK
-- ============================================

-- Students see non-private feedback on their attempts, tutors see all
CREATE POLICY "feedback_select" ON tutor_feedback
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR (student_user_id = auth.uid() AND is_private = false)
        OR is_platform_owner(auth.uid())
    );

-- Tutors can manage feedback
CREATE POLICY "feedback_insert_tutor" ON tutor_feedback
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "feedback_update_tutor" ON tutor_feedback
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "feedback_delete_tutor" ON tutor_feedback
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- SESSIONS
-- ============================================

-- Tutors see all sessions, students see their own
CREATE POLICY "sessions_select" ON sessions
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR student_user_id = auth.uid()
        OR is_platform_owner(auth.uid())
    );

-- Tutors can manage sessions
CREATE POLICY "sessions_insert_tutor" ON sessions
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "sessions_update_tutor" ON sessions
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        -- Students can request changes
        OR student_user_id = auth.uid()
    );

CREATE POLICY "sessions_delete_tutor" ON sessions
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

-- ============================================
-- OAUTH CONNECTIONS
-- ============================================

-- Users can only see their own OAuth connections
CREATE POLICY "oauth_select_own" ON oauth_connections
    FOR SELECT USING (
        user_id = auth.uid()
        OR is_platform_owner(auth.uid())
    );

CREATE POLICY "oauth_insert_own" ON oauth_connections
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

CREATE POLICY "oauth_update_own" ON oauth_connections
    FOR UPDATE USING (
        user_id = auth.uid()
    );

CREATE POLICY "oauth_delete_own" ON oauth_connections
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- ============================================
-- AUDIT LOG
-- ============================================

-- Tutors can view audit logs for their workspace
CREATE POLICY "audit_select_tutor" ON audit_log
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- Anyone authenticated can create audit entries (system creates them)
CREATE POLICY "audit_insert" ON audit_log
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- ============================================
-- JOBS
-- ============================================

-- Tutors can see jobs in their workspace
CREATE POLICY "jobs_select" ON jobs
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR created_by_user_id = auth.uid()
        OR is_platform_owner(auth.uid())
    );

-- Tutors can create jobs
CREATE POLICY "jobs_insert" ON jobs
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- Only platform owners or job system can update jobs
CREATE POLICY "jobs_update" ON jobs
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

-- ============================================
-- PDF EXPORTS
-- ============================================

-- Tutors can view exports
CREATE POLICY "exports_select" ON pdf_exports
    FOR SELECT USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
        OR is_platform_owner(auth.uid())
    );

CREATE POLICY "exports_insert" ON pdf_exports
    FOR INSERT WITH CHECK (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "exports_update" ON pdf_exports
    FOR UPDATE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );

CREATE POLICY "exports_delete" ON pdf_exports
    FOR DELETE USING (
        user_workspace_role(auth.uid(), workspace_id) = 'tutor'
    );
