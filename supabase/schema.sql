-- TutorAssist Database Schema
-- Multi-tenant math tutoring platform with workspace isolation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE TABLES
-- ============================================

-- Workspaces: Tenant boundary for tutors
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Members: Links users to workspaces with roles
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('platform_owner', 'tutor', 'student')),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);

-- Invite Tokens: For student onboarding
CREATE TABLE invite_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    student_profile_id UUID, -- Links to pre-created student profile
    email TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);

-- Student Profiles: Extended student data (can exist before user joins)
CREATE TABLE student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL until student joins
    name TEXT NOT NULL,
    email TEXT,
    age INTEGER,
    school TEXT,
    grade_current TEXT,
    grade_rollover_month INTEGER DEFAULT 9, -- September default
    private_notes TEXT, -- Tutor-only notes
    tags JSONB DEFAULT '[]'::jsonb,
    settings_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_profiles_workspace ON student_profiles(workspace_id);
CREATE INDEX idx_student_profiles_user ON student_profiles(user_id);

-- ============================================
-- CONTENT TABLES
-- ============================================

-- Topics: Categories for questions
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);

CREATE INDEX idx_topics_workspace ON topics(workspace_id);

-- Source Materials: Uploaded content for question generation
CREATE TABLE source_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    r2_key TEXT NOT NULL, -- Cloudflare R2 object key (workspace-scoped)
    original_filename TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('pdf', 'image', 'text')),
    mime_type TEXT,
    size_bytes INTEGER,
    extracted_text TEXT,
    extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_source_materials_workspace ON source_materials(workspace_id);

-- Questions: Core question bank
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    source_material_id UUID REFERENCES source_materials(id) ON DELETE SET NULL,
    origin TEXT NOT NULL CHECK (origin IN ('manual', 'ai_generated', 'imported', 'variant')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'needs_review', 'archived', 'draft')),
    
    -- Question content
    prompt_text TEXT NOT NULL,
    prompt_latex TEXT, -- LaTeX version for rendering
    prompt_image_r2_key TEXT, -- Optional image
    
    -- Answer configuration
    answer_type TEXT NOT NULL CHECK (answer_type IN ('multiple_choice', 'short_answer', 'long_answer', 'true_false', 'fill_blank', 'matching')),
    correct_answer_json JSONB NOT NULL, -- Flexible: {"value": "42"} or {"choices": [...], "correct": 0}
    tolerance DECIMAL, -- For numeric answers
    
    -- Help content
    solution_steps_json JSONB DEFAULT '[]'::jsonb, -- Array of step objects
    hints_json JSONB DEFAULT '[]'::jsonb, -- Array of hint strings
    
    -- Metadata
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
    calculator_allowed BOOLEAN DEFAULT true,
    estimated_minutes INTEGER DEFAULT 3,
    tags_json JSONB DEFAULT '[]'::jsonb,
    curriculum_json JSONB DEFAULT '{}'::jsonb, -- Standard alignment info
    
    -- Quality tracking
    quality_score DECIMAL, -- AI self-assessment score
    times_attempted INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    avg_time_seconds INTEGER,
    
    -- Variant tracking
    parent_question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
    variant_seed TEXT, -- For reproducible variants
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_workspace ON questions(workspace_id);
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);

-- ============================================
-- ASSIGNMENT TABLES
-- ============================================

-- Assignments: Collections of questions assigned to students
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_student_user_id UUID REFERENCES auth.users(id), -- NULL = all students
    student_profile_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    due_at TIMESTAMPTZ,
    
    -- Settings
    settings_json JSONB DEFAULT '{}'::jsonb, -- shuffle, time_limit, show_hints, etc.
    
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_workspace ON assignments(workspace_id);
CREATE INDEX idx_assignments_student ON assignments(assigned_student_user_id);
CREATE INDEX idx_assignments_due ON assignments(due_at);

-- Assignment Items: Questions in an assignment
CREATE TABLE assignment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    
    -- Item-specific overrides
    points DECIMAL DEFAULT 1,
    settings_json JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, question_id)
);

CREATE INDEX idx_assignment_items_assignment ON assignment_items(assignment_id);

-- ============================================
-- ATTEMPT & PROGRESS TABLES
-- ============================================

-- Attempts: Student answers to questions
CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES auth.users(id),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
    assignment_item_id UUID REFERENCES assignment_items(id) ON DELETE SET NULL,
    
    -- Answer data
    answer_raw TEXT, -- Student's raw input
    answer_parsed JSONB, -- Parsed/normalized answer
    is_correct BOOLEAN,
    partial_credit DECIMAL, -- 0-1 for partial credit
    
    -- Timing
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    time_spent_seconds INTEGER,
    
    -- Help used
    hints_viewed INTEGER DEFAULT 0,
    solution_viewed BOOLEAN DEFAULT false,
    
    -- Feedback
    feedback_json JSONB DEFAULT '{}'::jsonb, -- AI-generated feedback
    error_taxonomy_json JSONB DEFAULT '[]'::jsonb, -- Error categories
    
    -- Post-attempt
    reflection_text TEXT, -- Student's reflection after assignment
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attempts_workspace ON attempts(workspace_id);
CREATE INDEX idx_attempts_student ON attempts(student_user_id);
CREATE INDEX idx_attempts_question ON attempts(question_id);
CREATE INDEX idx_attempts_assignment ON attempts(assignment_id);
CREATE INDEX idx_attempts_created ON attempts(created_at);

-- Spaced Repetition: SM-2 based scheduling
CREATE TABLE spaced_repetition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES auth.users(id),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    
    -- SM-2 parameters
    ease DECIMAL DEFAULT 2.5, -- Easiness factor
    interval_days INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0, -- Consecutive correct
    
    -- Scheduling
    last_seen TIMESTAMPTZ,
    next_due TIMESTAMPTZ DEFAULT NOW(),
    last_outcome TEXT CHECK (last_outcome IN ('correct', 'incorrect', 'skipped')),
    
    -- Stats
    total_reviews INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, student_user_id, question_id)
);

CREATE INDEX idx_spaced_rep_student ON spaced_repetition(student_user_id);
CREATE INDEX idx_spaced_rep_due ON spaced_repetition(next_due);

-- ============================================
-- FEEDBACK & FLAG TABLES
-- ============================================

-- Question Flags: Student reports on questions
CREATE TABLE question_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES auth.users(id),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    
    flag_type TEXT NOT NULL CHECK (flag_type IN ('incorrect_answer', 'unclear', 'typo', 'too_hard', 'claim_correct', 'missing_content', 'multiple_valid', 'other')),
    comment TEXT,
    student_answer TEXT,
    attempt_id UUID REFERENCES attempts(id) ON DELETE SET NULL,
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'fixed', 'dismissed', 'accepted')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_flags_workspace ON question_flags(workspace_id);
CREATE INDEX idx_question_flags_status ON question_flags(status);

-- Tutor Feedback: Tutor comments on student attempts
CREATE TABLE tutor_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tutor_user_id UUID NOT NULL REFERENCES auth.users(id),
    student_user_id UUID NOT NULL REFERENCES auth.users(id),
    attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
    
    comment TEXT NOT NULL,
    error_tags JSONB DEFAULT '[]'::jsonb, -- Taxonomy tags
    is_private BOOLEAN DEFAULT false, -- Private = tutor-only
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tutor_feedback_workspace ON tutor_feedback(workspace_id);
CREATE INDEX idx_tutor_feedback_student ON tutor_feedback(student_user_id);

-- ============================================
-- SESSION & OAUTH TABLES
-- ============================================

-- Sessions: Tutoring sessions (Google Calendar integration)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tutor_user_id UUID NOT NULL REFERENCES auth.users(id),
    student_user_id UUID REFERENCES auth.users(id),
    student_profile_id UUID REFERENCES student_profiles(id),
    
    title TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    
    -- Google Calendar integration
    google_event_id TEXT,
    meet_link TEXT,
    calendar_html_link TEXT,
    
    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
    
    -- Change requests from students
    change_request_text TEXT,
    change_request_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX idx_sessions_tutor ON sessions(tutor_user_id);
CREATE INDEX idx_sessions_student ON sessions(student_user_id);
CREATE INDEX idx_sessions_starts ON sessions(starts_at);

-- OAuth Connections: Stored OAuth tokens (encrypted)
CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    provider TEXT NOT NULL CHECK (provider IN ('google')),
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[], -- Array of granted scopes
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_user ON oauth_connections(user_id);

-- ============================================
-- AUDIT & JOBS TABLES
-- ============================================

-- Audit Log: Track important actions
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    action TEXT NOT NULL,
    target_type TEXT, -- 'question', 'assignment', 'attempt', etc.
    target_id UUID,
    
    metadata_json JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_workspace ON audit_log(workspace_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_action ON audit_log(action);

-- Jobs: Background job queue
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    type TEXT NOT NULL CHECK (type IN (
        'EXTRACT_MATERIAL',
        'GENERATE_QUESTIONS', 
        'GENERATE_QUESTIONS_BATCH',
        'GENERATE_PDF',
        'REGEN_VARIANT',
        'DAILY_SPACED_REP_REFRESH',
        'PROCESS_BATCH_RESULT'
    )),
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'batch_pending')),
    priority INTEGER DEFAULT 0, -- Higher = more urgent
    
    -- Job data
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_json JSONB,
    error_text TEXT,
    
    -- Retry handling
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Scheduling
    run_after TIMESTAMPTZ DEFAULT NOW(),
    
    -- Locking (for distributed workers)
    locked_at TIMESTAMPTZ,
    locked_by TEXT, -- Worker identifier
    
    -- Batch API tracking
    openai_batch_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_workspace ON jobs(workspace_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_run_after ON jobs(run_after);
CREATE INDEX idx_jobs_batch ON jobs(openai_batch_id);

-- ============================================
-- EXPORTED ARTIFACTS
-- ============================================

-- PDF Exports: Track generated PDFs
CREATE TABLE pdf_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    
    title TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    
    -- Content
    assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
    question_ids UUID[] DEFAULT '{}',
    
    -- Settings used
    include_hints BOOLEAN DEFAULT false,
    include_solutions BOOLEAN DEFAULT false,
    
    -- Metadata
    page_count INTEGER,
    size_bytes INTEGER,
    
    expires_at TIMESTAMPTZ, -- For temporary downloads
    download_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pdf_exports_workspace ON pdf_exports(workspace_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON student_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spaced_repetition_updated_at BEFORE UPDATE ON spaced_repetition
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_connections_updated_at BEFORE UPDATE ON oauth_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate URL-safe slugs
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ language 'plpgsql';

-- Function to check workspace membership
CREATE OR REPLACE FUNCTION user_workspace_role(check_user_id UUID, check_workspace_id UUID)
RETURNS TEXT AS $$
DECLARE
    member_role TEXT;
BEGIN
    SELECT role INTO member_role
    FROM workspace_members
    WHERE user_id = check_user_id AND workspace_id = check_workspace_id;
    RETURN member_role;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Function to check if user is platform owner
CREATE OR REPLACE FUNCTION is_platform_owner(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_members
        WHERE user_id = check_user_id AND role = 'platform_owner'
    );
END;
$$ language 'plpgsql' SECURITY DEFINER;
