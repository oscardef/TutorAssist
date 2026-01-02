-- Migration: Update IB DP Grade Levels to Course Codes
-- Changes DP1/DP2 to specific IB Math courses: AISL, AIHL, AASL, AAHL
-- This aligns with IB Diploma Programme Mathematics course structure

-- ============================================
-- UPDATE GRADE LEVELS FOR IB PROGRAMME
-- ============================================
-- IB DP Math has 4 course options:
-- - AI SL: Applications and Interpretation Standard Level
-- - AI HL: Applications and Interpretation Higher Level  
-- - AA SL: Analysis and Approaches Standard Level
-- - AA HL: Analysis and Approaches Higher Level

-- First, let's update the existing DP1/DP2 entries and add the IB Math courses
-- We need to do this for all workspaces

-- Create a function to update IB grade levels for a workspace
CREATE OR REPLACE FUNCTION update_ib_dp_to_courses(p_workspace_id UUID)
RETURNS void AS $$
DECLARE
    v_ib_program_id UUID;
    v_dp1_id UUID;
    v_dp2_id UUID;
BEGIN
    -- Get IB program ID for this workspace
    SELECT id INTO v_ib_program_id
    FROM study_programs
    WHERE workspace_id = p_workspace_id AND code = 'IB';
    
    IF v_ib_program_id IS NULL THEN
        RAISE NOTICE 'No IB program found for workspace %', p_workspace_id;
        RETURN;
    END IF;
    
    -- Get DP1 and DP2 IDs if they exist
    SELECT id INTO v_dp1_id FROM grade_levels 
    WHERE workspace_id = p_workspace_id AND program_id = v_ib_program_id AND code = 'DP1';
    
    SELECT id INTO v_dp2_id FROM grade_levels 
    WHERE workspace_id = p_workspace_id AND program_id = v_ib_program_id AND code = 'DP2';
    
    -- Remove old DP1/DP2 entries (they'll be replaced by course-specific entries)
    -- First update any topics/questions to NULL to avoid orphans
    UPDATE topics SET grade_level_id = NULL 
    WHERE grade_level_id IN (v_dp1_id, v_dp2_id);
    
    UPDATE questions SET primary_grade_level_id = NULL 
    WHERE primary_grade_level_id IN (v_dp1_id, v_dp2_id);
    
    UPDATE student_profiles SET grade_level_id = NULL 
    WHERE grade_level_id IN (v_dp1_id, v_dp2_id);
    
    DELETE FROM question_grade_levels 
    WHERE grade_level_id IN (v_dp1_id, v_dp2_id);
    
    -- Delete old DP1/DP2 entries
    DELETE FROM grade_levels 
    WHERE workspace_id = p_workspace_id 
    AND program_id = v_ib_program_id 
    AND code IN ('DP1', 'DP2');
    
    -- Insert new IB Math course codes
    INSERT INTO grade_levels (workspace_id, program_id, code, name, description, year_number, order_index) VALUES
        (p_workspace_id, v_ib_program_id, 'AISL', 'AI Standard Level', 'Applications and Interpretation SL - focuses on statistics, modeling, and real-world applications', 11, 6),
        (p_workspace_id, v_ib_program_id, 'AIHL', 'AI Higher Level', 'Applications and Interpretation HL - advanced statistics and mathematical modeling', 12, 7),
        (p_workspace_id, v_ib_program_id, 'AASL', 'AA Standard Level', 'Analysis and Approaches SL - focuses on calculus and algebraic methods', 11, 8),
        (p_workspace_id, v_ib_program_id, 'AAHL', 'AA Higher Level', 'Analysis and Approaches HL - advanced calculus and abstract mathematics', 12, 9)
    ON CONFLICT (workspace_id, program_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        year_number = EXCLUDED.year_number,
        order_index = EXCLUDED.order_index;
        
    RAISE NOTICE 'Updated IB DP grade levels to course codes for workspace %', p_workspace_id;
END;
$$ LANGUAGE plpgsql;

-- Update the seed function to use the new course codes
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
    
    -- IB Grade Levels - MYP Years and DP Courses
    INSERT INTO grade_levels (workspace_id, program_id, code, name, description, year_number, order_index) VALUES
        (p_workspace_id, v_ib_id, 'M6', 'MYP Year 6', 'Middle Years Programme Year 6', 6, 1),
        (p_workspace_id, v_ib_id, 'M7', 'MYP Year 7', 'Middle Years Programme Year 7', 7, 2),
        (p_workspace_id, v_ib_id, 'M8', 'MYP Year 8', 'Middle Years Programme Year 8', 8, 3),
        (p_workspace_id, v_ib_id, 'M9', 'MYP Year 9', 'Middle Years Programme Year 9', 9, 4),
        (p_workspace_id, v_ib_id, 'M10', 'MYP Year 10', 'Middle Years Programme Year 10', 10, 5),
        -- IB DP Math Courses (replacing DP1/DP2)
        (p_workspace_id, v_ib_id, 'AISL', 'AI Standard Level', 'Applications and Interpretation SL - focuses on statistics, modeling, and real-world applications', 11, 6),
        (p_workspace_id, v_ib_id, 'AIHL', 'AI Higher Level', 'Applications and Interpretation HL - advanced statistics and mathematical modeling', 12, 7),
        (p_workspace_id, v_ib_id, 'AASL', 'AA Standard Level', 'Analysis and Approaches SL - focuses on calculus and algebraic methods', 11, 8),
        (p_workspace_id, v_ib_id, 'AAHL', 'AA Higher Level', 'Analysis and Approaches HL - advanced calculus and abstract mathematics', 12, 9)
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
-- MIGRATE EXISTING WORKSPACES
-- ============================================
-- Apply the update to all existing workspaces

DO $$
DECLARE
    ws_record RECORD;
BEGIN
    FOR ws_record IN SELECT id FROM workspaces LOOP
        PERFORM update_ib_dp_to_courses(ws_record.id);
    END LOOP;
END $$;

-- ============================================
-- CLEANUP
-- ============================================
-- Drop the migration helper function (keep seed function as it's used by trigger)
DROP FUNCTION IF EXISTS update_ib_dp_to_courses(UUID);
