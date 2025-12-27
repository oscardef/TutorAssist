-- Migration: Add Study Programs and Grade Levels
-- This restructures topics and questions to support multiple curricula (IB, AP, etc.)
-- and grade levels (MYP, DP, etc.)

-- ============================================
-- STUDY PROGRAMS TABLE
-- ============================================
-- Represents curricula like IB, AP, A-Level, Common Core, etc.

CREATE TABLE IF NOT EXISTS study_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Short code: 'IB', 'AP', 'GCSE', 'ALEVEL', etc.
    name TEXT NOT NULL, -- Full name: 'International Baccalaureate', 'Advanced Placement'
    description TEXT,
    color TEXT DEFAULT '#3B82F6', -- For UI display
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, code)
);

CREATE INDEX idx_study_programs_workspace ON study_programs(workspace_id);

-- ============================================
-- GRADE LEVELS TABLE
-- ============================================
-- Represents grade levels within programs (M8, M9, DP1, DP2, etc.)

CREATE TABLE IF NOT EXISTS grade_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    program_id UUID REFERENCES study_programs(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Short code: 'M8', 'M9', 'DP1', 'DP2', 'AP1', etc.
    name TEXT NOT NULL, -- Full name: 'MYP Year 8', 'Diploma Programme Year 1'
    description TEXT,
    year_number INTEGER, -- Numeric year for sorting (8, 9, 11, 12, etc.)
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, program_id, code)
);

CREATE INDEX idx_grade_levels_workspace ON grade_levels(workspace_id);
CREATE INDEX idx_grade_levels_program ON grade_levels(program_id);

-- ============================================
-- UPDATE TOPICS TABLE
-- ============================================
-- Add program and grade level to topics

ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_core BOOLEAN DEFAULT false, -- Core curriculum topic
ADD COLUMN IF NOT EXISTS curriculum_code TEXT; -- e.g., 'IB.DP.AA.HL' for IB DP Analysis & Approaches HL

CREATE INDEX IF NOT EXISTS idx_topics_program ON topics(program_id);
CREATE INDEX IF NOT EXISTS idx_topics_grade_level ON topics(grade_level_id);

-- ============================================
-- QUESTION-PROGRAM JUNCTION TABLE
-- ============================================
-- Questions can belong to multiple programs (e.g., a question valid for both IB and AP)

CREATE TABLE IF NOT EXISTS question_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES study_programs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(question_id, program_id)
);

CREATE INDEX idx_question_programs_question ON question_programs(question_id);
CREATE INDEX idx_question_programs_program ON question_programs(program_id);

-- ============================================
-- QUESTION-GRADE JUNCTION TABLE
-- ============================================
-- Questions can be appropriate for multiple grade levels

CREATE TABLE IF NOT EXISTS question_grade_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(question_id, grade_level_id)
);

CREATE INDEX idx_question_grade_levels_question ON question_grade_levels(question_id);
CREATE INDEX idx_question_grade_levels_grade ON question_grade_levels(grade_level_id);

-- ============================================
-- UPDATE QUESTIONS TABLE
-- ============================================
-- Add primary program/grade for backwards compatibility and filtering

ALTER TABLE questions
ADD COLUMN IF NOT EXISTS primary_program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS primary_grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_primary_program ON questions(primary_program_id);
CREATE INDEX IF NOT EXISTS idx_questions_primary_grade ON questions(primary_grade_level_id);

-- ============================================
-- SEED DEFAULT PROGRAMS AND GRADES
-- ============================================
-- This function seeds default programs for a workspace

CREATE OR REPLACE FUNCTION seed_default_programs_and_grades(p_workspace_id UUID)
RETURNS void AS $$
DECLARE
    v_ib_id UUID;
    v_ap_id UUID;
    v_gcse_id UUID;
    v_alevel_id UUID;
    v_common_id UUID;
BEGIN
    -- Insert IB Program
    INSERT INTO study_programs (workspace_id, code, name, description, color, order_index)
    VALUES (p_workspace_id, 'IB', 'International Baccalaureate', 'IB MYP and Diploma Programme', '#1E40AF', 1)
    ON CONFLICT (workspace_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_ib_id;
    
    -- IB Grade Levels
    INSERT INTO grade_levels (workspace_id, program_id, code, name, year_number, order_index) VALUES
        (p_workspace_id, v_ib_id, 'M6', 'MYP Year 6', 6, 1),
        (p_workspace_id, v_ib_id, 'M7', 'MYP Year 7', 7, 2),
        (p_workspace_id, v_ib_id, 'M8', 'MYP Year 8', 8, 3),
        (p_workspace_id, v_ib_id, 'M9', 'MYP Year 9', 9, 4),
        (p_workspace_id, v_ib_id, 'M10', 'MYP Year 10', 10, 5),
        (p_workspace_id, v_ib_id, 'DP1', 'DP Year 1', 11, 6),
        (p_workspace_id, v_ib_id, 'DP2', 'DP Year 2', 12, 7)
    ON CONFLICT (workspace_id, program_id, code) DO NOTHING;
    
    -- Insert AP Program
    INSERT INTO study_programs (workspace_id, code, name, description, color, order_index)
    VALUES (p_workspace_id, 'AP', 'Advanced Placement', 'College Board AP Courses', '#DC2626', 2)
    ON CONFLICT (workspace_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_ap_id;
    
    -- AP Grade Levels  
    INSERT INTO grade_levels (workspace_id, program_id, code, name, year_number, order_index) VALUES
        (p_workspace_id, v_ap_id, 'AP-PRE', 'Pre-AP', 10, 1),
        (p_workspace_id, v_ap_id, 'AP1', 'AP Year 1', 11, 2),
        (p_workspace_id, v_ap_id, 'AP2', 'AP Year 2', 12, 3)
    ON CONFLICT (workspace_id, program_id, code) DO NOTHING;
    
    -- Insert GCSE Program
    INSERT INTO study_programs (workspace_id, code, name, description, color, order_index)
    VALUES (p_workspace_id, 'GCSE', 'GCSE', 'UK General Certificate of Secondary Education', '#059669', 3)
    ON CONFLICT (workspace_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_gcse_id;
    
    -- GCSE Grade Levels
    INSERT INTO grade_levels (workspace_id, program_id, code, name, year_number, order_index) VALUES
        (p_workspace_id, v_gcse_id, 'Y9', 'Year 9', 9, 1),
        (p_workspace_id, v_gcse_id, 'Y10', 'Year 10', 10, 2),
        (p_workspace_id, v_gcse_id, 'Y11', 'Year 11', 11, 3)
    ON CONFLICT (workspace_id, program_id, code) DO NOTHING;
    
    -- Insert A-Level Program
    INSERT INTO study_programs (workspace_id, code, name, description, color, order_index)
    VALUES (p_workspace_id, 'ALEVEL', 'A-Level', 'UK Advanced Level', '#7C3AED', 4)
    ON CONFLICT (workspace_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_alevel_id;
    
    -- A-Level Grade Levels
    INSERT INTO grade_levels (workspace_id, program_id, code, name, year_number, order_index) VALUES
        (p_workspace_id, v_alevel_id, 'AS', 'AS Level (Year 12)', 12, 1),
        (p_workspace_id, v_alevel_id, 'A2', 'A2 Level (Year 13)', 13, 2)
    ON CONFLICT (workspace_id, program_id, code) DO NOTHING;
    
    -- Insert Common Core / General Program
    INSERT INTO study_programs (workspace_id, code, name, description, color, order_index)
    VALUES (p_workspace_id, 'GENERAL', 'General', 'General Mathematics (no specific curriculum)', '#6B7280', 10)
    ON CONFLICT (workspace_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_common_id;
    
    -- General Grade Levels (US style)
    INSERT INTO grade_levels (workspace_id, program_id, code, name, year_number, order_index) VALUES
        (p_workspace_id, v_common_id, 'G6', 'Grade 6', 6, 1),
        (p_workspace_id, v_common_id, 'G7', 'Grade 7', 7, 2),
        (p_workspace_id, v_common_id, 'G8', 'Grade 8', 8, 3),
        (p_workspace_id, v_common_id, 'G9', 'Grade 9 / Freshman', 9, 4),
        (p_workspace_id, v_common_id, 'G10', 'Grade 10 / Sophomore', 10, 5),
        (p_workspace_id, v_common_id, 'G11', 'Grade 11 / Junior', 11, 6),
        (p_workspace_id, v_common_id, 'G12', 'Grade 12 / Senior', 12, 7),
        (p_workspace_id, v_common_id, 'UNI', 'University', 13, 8)
    ON CONFLICT (workspace_id, program_id, code) DO NOTHING;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View for topics with program and grade info
CREATE OR REPLACE VIEW topics_with_curriculum AS
SELECT 
    t.*,
    sp.code as program_code,
    sp.name as program_name,
    sp.color as program_color,
    gl.code as grade_code,
    gl.name as grade_name,
    gl.year_number
FROM topics t
LEFT JOIN study_programs sp ON t.program_id = sp.id
LEFT JOIN grade_levels gl ON t.grade_level_id = gl.id;

-- View for questions with all programs and grades
CREATE OR REPLACE VIEW questions_with_curriculum AS
SELECT 
    q.*,
    sp.code as primary_program_code,
    sp.name as primary_program_name,
    gl.code as primary_grade_code,
    gl.name as primary_grade_name,
    COALESCE(
        (SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name))
         FROM question_programs qp
         JOIN study_programs p ON qp.program_id = p.id
         WHERE qp.question_id = q.id),
        '[]'::json
    ) as all_programs,
    COALESCE(
        (SELECT json_agg(json_build_object('id', g.id, 'code', g.code, 'name', g.name))
         FROM question_grade_levels qgl
         JOIN grade_levels g ON qgl.grade_level_id = g.id
         WHERE qgl.question_id = q.id),
        '[]'::json
    ) as all_grades
FROM questions q
LEFT JOIN study_programs sp ON q.primary_program_id = sp.id
LEFT JOIN grade_levels gl ON q.primary_grade_level_id = gl.id;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE study_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_grade_levels ENABLE ROW LEVEL SECURITY;

-- Study Programs policies
CREATE POLICY "Users can view programs in their workspace" ON study_programs
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Tutors can manage programs" ON study_programs
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('tutor', 'platform_owner')
        )
    );

-- Grade Levels policies
CREATE POLICY "Users can view grade levels in their workspace" ON grade_levels
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Tutors can manage grade levels" ON grade_levels
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('tutor', 'platform_owner')
        )
    );

-- Question Programs policies
CREATE POLICY "Users can view question programs" ON question_programs
    FOR SELECT USING (
        question_id IN (
            SELECT q.id FROM questions q
            JOIN workspace_members wm ON q.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Tutors can manage question programs" ON question_programs
    FOR ALL USING (
        question_id IN (
            SELECT q.id FROM questions q
            JOIN workspace_members wm ON q.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('tutor', 'platform_owner')
        )
    );

-- Question Grade Levels policies
CREATE POLICY "Users can view question grade levels" ON question_grade_levels
    FOR SELECT USING (
        question_id IN (
            SELECT q.id FROM questions q
            JOIN workspace_members wm ON q.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Tutors can manage question grade levels" ON question_grade_levels
    FOR ALL USING (
        question_id IN (
            SELECT q.id FROM questions q
            JOIN workspace_members wm ON q.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role IN ('tutor', 'platform_owner')
        )
    );

-- ============================================
-- TRIGGER: Auto-seed programs for new workspaces
-- ============================================

CREATE OR REPLACE FUNCTION trigger_seed_programs_on_workspace()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM seed_default_programs_and_grades(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seed_programs_on_workspace_create ON workspaces;
CREATE TRIGGER seed_programs_on_workspace_create
    AFTER INSERT ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION trigger_seed_programs_on_workspace();

-- ============================================
-- SEED EXISTING WORKSPACES
-- ============================================
-- Run the seed function for all existing workspaces

DO $$
DECLARE
    ws_record RECORD;
BEGIN
    FOR ws_record IN SELECT id FROM workspaces LOOP
        PERFORM seed_default_programs_and_grades(ws_record.id);
    END LOOP;
END $$;
