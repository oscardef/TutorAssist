-- TutorAssist Seed Data
-- Demo workspace with sample topics and questions

-- Note: Run this AFTER schema.sql and rls.sql
-- You must first create a user through Supabase Auth, then update the UUIDs below

-- ============================================
-- PLACEHOLDER UUIDs (replace with real user IDs after creating accounts)
-- ============================================

-- To use this seed file:
-- 1. Create a tutor account through the app
-- 2. Note the user ID from Supabase Auth dashboard
-- 3. Replace 'TUTOR_USER_ID' below with the actual UUID
-- 4. Run this script

-- For demo purposes, we use a function to insert if IDs exist
-- In production, replace these with actual UUIDs

DO $$
DECLARE
    demo_workspace_id UUID;
    demo_tutor_id UUID;
    topic_algebra UUID;
    topic_geometry UUID;
    topic_arithmetic UUID;
    topic_fractions UUID;
    topic_percentages UUID;
BEGIN
    -- Check if we already have seed data
    IF EXISTS (SELECT 1 FROM workspaces WHERE slug = 'demo-tutoring') THEN
        RAISE NOTICE 'Seed data already exists, skipping...';
        RETURN;
    END IF;
    
    -- Create demo workspace
    INSERT INTO workspaces (id, name, slug, settings_json)
    VALUES (
        uuid_generate_v4(),
        'Demo Tutoring',
        'demo-tutoring',
        '{
            "allowStudentPractice": true,
            "practiceRateLimit": 20,
            "defaultDifficulty": 3,
            "enableSpacedRepetition": true,
            "questionGenerationEnabled": true
        }'::jsonb
    )
    RETURNING id INTO demo_workspace_id;
    
    RAISE NOTICE 'Created workspace: %', demo_workspace_id;
    
    -- Create topics
    INSERT INTO topics (id, workspace_id, name, description, tags, order_index)
    VALUES 
        (uuid_generate_v4(), demo_workspace_id, 'Algebra', 'Algebraic expressions, equations, and functions', '["algebra", "equations"]'::jsonb, 1)
    RETURNING id INTO topic_algebra;
    
    INSERT INTO topics (id, workspace_id, name, description, tags, order_index)
    VALUES 
        (uuid_generate_v4(), demo_workspace_id, 'Geometry', 'Shapes, areas, volumes, and angles', '["geometry", "shapes"]'::jsonb, 2)
    RETURNING id INTO topic_geometry;
    
    INSERT INTO topics (id, workspace_id, name, description, tags, order_index)
    VALUES 
        (uuid_generate_v4(), demo_workspace_id, 'Arithmetic', 'Basic operations and number sense', '["arithmetic", "basics"]'::jsonb, 3)
    RETURNING id INTO topic_arithmetic;
    
    INSERT INTO topics (id, workspace_id, name, description, tags, order_index)
    VALUES 
        (uuid_generate_v4(), demo_workspace_id, 'Fractions', 'Fraction operations and conversions', '["fractions", "rational"]'::jsonb, 4)
    RETURNING id INTO topic_fractions;
    
    INSERT INTO topics (id, workspace_id, name, description, tags, order_index)
    VALUES 
        (uuid_generate_v4(), demo_workspace_id, 'Percentages', 'Percent calculations and applications', '["percentages", "applications"]'::jsonb, 5)
    RETURNING id INTO topic_percentages;
    
    -- Create sample questions
    
    -- Algebra questions
    INSERT INTO questions (workspace_id, topic_id, origin, status, prompt_text, prompt_latex, answer_type, correct_answer_json, solution_steps_json, hints_json, difficulty, calculator_allowed, quality_score)
    VALUES
    (demo_workspace_id, topic_algebra, 'manual', 'active',
     'Solve for x: 2x + 5 = 13',
     '\\text{Solve for } x: 2x + 5 = 13',
     'exact',
     '{"value": "4"}'::jsonb,
     '[{"step": "Subtract 5 from both sides", "result": "2x = 8"}, {"step": "Divide both sides by 2", "result": "x = 4"}]'::jsonb,
     '["Start by isolating the term with x", "What operation undoes addition?", "After subtracting 5, you have 2x = 8"]'::jsonb,
     2, true, 0.95),
     
    (demo_workspace_id, topic_algebra, 'manual', 'active',
     'Simplify: 3(x + 4) - 2x',
     '\\text{Simplify: } 3(x + 4) - 2x',
     'expression',
     '{"value": "x + 12", "alternatives": ["x+12", "12+x"]}'::jsonb,
     '[{"step": "Distribute 3", "result": "3x + 12 - 2x"}, {"step": "Combine like terms", "result": "x + 12"}]'::jsonb,
     '["First, distribute the 3 to both terms inside the parentheses", "Remember: 3 times x is 3x, and 3 times 4 is 12", "Now combine the x terms: 3x - 2x"]'::jsonb,
     2, true, 0.92),
     
    (demo_workspace_id, topic_algebra, 'manual', 'active',
     'If y = 3x - 7 and x = 5, what is y?',
     '\\text{If } y = 3x - 7 \\text{ and } x = 5\\text{, what is } y?',
     'numeric',
     '{"value": 8}'::jsonb,
     '[{"step": "Substitute x = 5", "result": "y = 3(5) - 7"}, {"step": "Multiply", "result": "y = 15 - 7"}, {"step": "Subtract", "result": "y = 8"}]'::jsonb,
     '["Replace x with 5 in the equation", "Calculate 3 times 5 first", "Then subtract 7"]'::jsonb,
     1, true, 0.98),
     
    -- Geometry questions
    (demo_workspace_id, topic_geometry, 'manual', 'active',
     'What is the area of a rectangle with length 8 cm and width 5 cm?',
     '\\text{What is the area of a rectangle with length } 8 \\text{ cm and width } 5 \\text{ cm?}',
     'numeric',
     '{"value": 40, "unit": "cm²"}'::jsonb,
     '[{"step": "Use the formula: Area = length × width", "result": "Area = 8 × 5"}, {"step": "Multiply", "result": "Area = 40 cm²"}]'::jsonb,
     '["The formula for area of a rectangle is length times width", "Multiply 8 by 5"]'::jsonb,
     1, true, 0.97),
     
    (demo_workspace_id, topic_geometry, 'manual', 'active',
     'A triangle has angles of 45° and 65°. What is the third angle?',
     '\\text{A triangle has angles of } 45° \\text{ and } 65°\\text{. What is the third angle?}',
     'numeric',
     '{"value": 70, "unit": "degrees"}'::jsonb,
     '[{"step": "Sum of angles in a triangle = 180°", "result": "45° + 65° + x = 180°"}, {"step": "Add known angles", "result": "110° + x = 180°"}, {"step": "Solve for x", "result": "x = 70°"}]'::jsonb,
     '["All angles in a triangle add up to 180 degrees", "First add 45 and 65", "Subtract from 180"]'::jsonb,
     2, true, 0.96),
     
    (demo_workspace_id, topic_geometry, 'manual', 'active',
     'What is the circumference of a circle with radius 7 cm? (Use π ≈ 3.14)',
     '\\text{What is the circumference of a circle with radius } 7 \\text{ cm? (Use } \\pi \\approx 3.14\\text{)}',
     'numeric',
     '{"value": 43.96, "tolerance": 0.1, "unit": "cm"}'::jsonb,
     '[{"step": "Use the formula: C = 2πr", "result": "C = 2 × 3.14 × 7"}, {"step": "Calculate", "result": "C = 43.96 cm"}]'::jsonb,
     '["The formula for circumference is 2πr or πd", "Substitute r = 7 and π = 3.14", "Multiply: 2 × 3.14 × 7"]'::jsonb,
     2, true, 0.94),
     
    -- Arithmetic questions
    (demo_workspace_id, topic_arithmetic, 'manual', 'active',
     'Calculate: 156 + 287',
     '156 + 287',
     'numeric',
     '{"value": 443}'::jsonb,
     '[{"step": "Add ones: 6 + 7 = 13, write 3 carry 1", "result": "..."}, {"step": "Add tens: 5 + 8 + 1 = 14, write 4 carry 1", "result": "..."}, {"step": "Add hundreds: 1 + 2 + 1 = 4", "result": "443"}]'::jsonb,
     '["Start from the ones place", "Remember to carry when the sum is 10 or more"]'::jsonb,
     1, false, 0.99),
     
    (demo_workspace_id, topic_arithmetic, 'manual', 'active',
     'What is 24 × 15?',
     '24 \\times 15',
     'numeric',
     '{"value": 360}'::jsonb,
     '[{"step": "24 × 15 = 24 × (10 + 5)", "result": "..."}, {"step": "= 24 × 10 + 24 × 5", "result": "= 240 + 120"}, {"step": "= 360", "result": "360"}]'::jsonb,
     '["You can break 15 into 10 + 5", "Calculate 24 × 10 and 24 × 5 separately", "Then add the results"]'::jsonb,
     2, false, 0.95),
     
    -- Fraction questions
    (demo_workspace_id, topic_fractions, 'manual', 'active',
     'Add: 1/4 + 2/4',
     '\\frac{1}{4} + \\frac{2}{4}',
     'exact',
     '{"value": "3/4", "alternatives": ["3/4", "0.75"]}'::jsonb,
     '[{"step": "Same denominator, so add numerators", "result": "(1 + 2)/4"}, {"step": "Simplify", "result": "3/4"}]'::jsonb,
     '["When denominators are the same, just add the numerators", "Keep the denominator the same"]'::jsonb,
     1, true, 0.97),
     
    (demo_workspace_id, topic_fractions, 'manual', 'active',
     'Simplify: 12/18',
     '\\text{Simplify: } \\frac{12}{18}',
     'exact',
     '{"value": "2/3", "alternatives": ["2/3"]}'::jsonb,
     '[{"step": "Find GCD of 12 and 18", "result": "GCD = 6"}, {"step": "Divide both by 6", "result": "12÷6 / 18÷6 = 2/3"}]'::jsonb,
     '["Find a number that divides both 12 and 18", "6 is the largest such number", "Divide both numerator and denominator by 6"]'::jsonb,
     2, true, 0.96),
     
    (demo_workspace_id, topic_fractions, 'manual', 'active',
     'Convert 3/5 to a decimal',
     '\\text{Convert } \\frac{3}{5} \\text{ to a decimal}',
     'numeric',
     '{"value": 0.6}'::jsonb,
     '[{"step": "Divide numerator by denominator", "result": "3 ÷ 5 = 0.6"}]'::jsonb,
     '["To convert a fraction to decimal, divide the top by the bottom", "3 divided by 5"]'::jsonb,
     1, true, 0.98),
     
    -- Percentage questions
    (demo_workspace_id, topic_percentages, 'manual', 'active',
     'What is 25% of 80?',
     '\\text{What is } 25\\% \\text{ of } 80?',
     'numeric',
     '{"value": 20}'::jsonb,
     '[{"step": "Convert 25% to decimal", "result": "25% = 0.25"}, {"step": "Multiply", "result": "0.25 × 80 = 20"}]'::jsonb,
     '["25% means 25 out of 100, or 0.25", "Multiply 0.25 by 80", "Or think: 25% = 1/4, so find 1/4 of 80"]'::jsonb,
     1, true, 0.97),
     
    (demo_workspace_id, topic_percentages, 'manual', 'active',
     'A shirt costs $40. It is on sale for 20% off. What is the sale price?',
     '\\text{A shirt costs } \\$40\\text{. It is on sale for } 20\\% \\text{ off. What is the sale price?}',
     'numeric',
     '{"value": 32, "unit": "dollars"}'::jsonb,
     '[{"step": "Calculate discount", "result": "20% of $40 = 0.20 × 40 = $8"}, {"step": "Subtract discount from original", "result": "$40 - $8 = $32"}]'::jsonb,
     '["First find 20% of $40", "Then subtract that amount from $40", "Or multiply $40 by 0.80 (which is 100% - 20%)"]'::jsonb,
     2, true, 0.95),
     
    (demo_workspace_id, topic_percentages, 'manual', 'active',
     'If you scored 18 out of 20 on a test, what is your percentage score?',
     '\\text{If you scored } 18 \\text{ out of } 20 \\text{ on a test, what is your percentage score?}',
     'numeric',
     '{"value": 90, "unit": "percent"}'::jsonb,
     '[{"step": "Divide score by total", "result": "18 ÷ 20 = 0.9"}, {"step": "Convert to percentage", "result": "0.9 × 100 = 90%"}]'::jsonb,
     '["Divide 18 by 20", "Multiply by 100 to get the percentage", "Or set up: 18/20 = x/100"]'::jsonb,
     2, true, 0.96);
    
    RAISE NOTICE 'Seed data created successfully!';
    RAISE NOTICE 'Workspace ID: %', demo_workspace_id;
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Create a tutor account through the app';
    RAISE NOTICE '2. Run this SQL to link the tutor to the demo workspace:';
    RAISE NOTICE '   INSERT INTO workspace_members (workspace_id, user_id, role)';
    RAISE NOTICE '   VALUES (''%'', ''YOUR_USER_ID'', ''tutor'');', demo_workspace_id;
    
END $$;
