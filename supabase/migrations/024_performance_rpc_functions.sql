-- Performance RPC Functions for Dashboard Data
-- These functions aggregate multiple queries into single calls to reduce network round-trips

-- Tutor Dashboard Summary RPC
-- Returns all key metrics in a single call: flags count, students needing attention, assignments overview
CREATE OR REPLACE FUNCTION rpc_tutor_dashboard_summary(p_workspace_id uuid, p_tutor_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
  v_flag_count integer;
  v_student_count integer;
  v_overdue_count integer;
  v_due_soon_count integer;
  v_struggling_count integer;
BEGIN
  -- Verify user has tutor access to this workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE user_id = p_tutor_user_id 
    AND workspace_id = p_workspace_id 
    AND role = 'tutor'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Count pending flags
  SELECT COUNT(*) INTO v_flag_count
  FROM question_flags
  WHERE workspace_id = p_workspace_id AND status = 'pending';
  
  -- Count students
  SELECT COUNT(*) INTO v_student_count
  FROM student_profiles
  WHERE workspace_id = p_workspace_id;
  
  -- Count overdue assignments
  SELECT COUNT(*) INTO v_overdue_count
  FROM assignments
  WHERE workspace_id = p_workspace_id 
    AND status = 'active'
    AND due_at < NOW();
  
  -- Count assignments due in next 3 days
  SELECT COUNT(*) INTO v_due_soon_count
  FROM assignments
  WHERE workspace_id = p_workspace_id 
    AND status = 'active'
    AND due_at >= NOW()
    AND due_at <= NOW() + INTERVAL '3 days';
  
  -- Count struggling students (accuracy < 50% in last 2 weeks with >= 5 attempts)
  SELECT COUNT(DISTINCT student_user_id) INTO v_struggling_count
  FROM (
    SELECT 
      student_user_id,
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
    FROM attempts
    WHERE workspace_id = p_workspace_id
      AND created_at >= NOW() - INTERVAL '14 days'
    GROUP BY student_user_id
    HAVING COUNT(*) >= 5
      AND SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::float / COUNT(*) < 0.5
  ) stats;
  
  RETURN jsonb_build_object(
    'flagCount', v_flag_count,
    'studentCount', v_student_count,
    'overdueAssignments', v_overdue_count,
    'dueSoonAssignments', v_due_soon_count,
    'strugglingStudents', v_struggling_count,
    'fetchedAt', NOW()
  );
END;
$$;

-- Student Dashboard Summary RPC
-- Returns stats, streak, and key metrics in a single call
CREATE OR REPLACE FUNCTION rpc_student_dashboard_summary(p_student_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
  v_total_attempts bigint;
  v_correct_attempts bigint;
  v_streak integer;
  v_due_items integer;
  v_active_assignments integer;
  v_dates_array date[];
  v_check_date date;
  v_today date;
  v_yesterday date;
BEGIN
  -- Count total attempts
  SELECT COUNT(*) INTO v_total_attempts
  FROM attempts
  WHERE student_user_id = p_student_user_id;
  
  -- Count correct attempts
  SELECT COUNT(*) INTO v_correct_attempts
  FROM attempts
  WHERE student_user_id = p_student_user_id AND is_correct = true;
  
  -- Calculate streak
  v_today := CURRENT_DATE;
  v_yesterday := CURRENT_DATE - 1;
  v_streak := 0;
  
  SELECT ARRAY_AGG(DISTINCT DATE(submitted_at) ORDER BY DATE(submitted_at) DESC)
  INTO v_dates_array
  FROM attempts
  WHERE student_user_id = p_student_user_id
    AND submitted_at >= NOW() - INTERVAL '100 days';
  
  IF v_dates_array IS NOT NULL AND array_length(v_dates_array, 1) > 0 THEN
    -- Check if practiced today or yesterday
    IF v_today = ANY(v_dates_array) OR v_yesterday = ANY(v_dates_array) THEN
      v_check_date := CASE WHEN v_today = ANY(v_dates_array) THEN v_today ELSE v_yesterday END;
      
      WHILE v_check_date = ANY(v_dates_array) LOOP
        v_streak := v_streak + 1;
        v_check_date := v_check_date - 1;
      END LOOP;
    END IF;
  END IF;
  
  -- Count due spaced repetition items
  SELECT COUNT(*) INTO v_due_items
  FROM spaced_repetition
  WHERE student_user_id = p_student_user_id
    AND next_due <= NOW();
  
  -- Count active assignments
  SELECT COUNT(*) INTO v_active_assignments
  FROM assignments
  WHERE assigned_student_user_id = p_student_user_id
    AND status = 'active';
  
  RETURN jsonb_build_object(
    'totalAttempts', v_total_attempts,
    'correctAttempts', v_correct_attempts,
    'accuracy', CASE WHEN v_total_attempts > 0 
      THEN ROUND((v_correct_attempts::float / v_total_attempts) * 100)
      ELSE 0 END,
    'streak', v_streak,
    'dueItems', v_due_items,
    'activeAssignments', v_active_assignments,
    'fetchedAt', NOW()
  );
END;
$$;

-- Student Assignment Progress RPC
-- Returns progress for all student assignments in a single call (eliminates N+1)
CREATE OR REPLACE FUNCTION rpc_student_assignment_progress(p_student_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(progress_data)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'assignment_id', a.id,
      'total_questions', COALESCE(items.total, 0),
      'completed_questions', COALESCE(attempts.completed, 0),
      'correct_questions', COALESCE(attempts.correct, 0)
    ) as progress_data
    FROM assignments a
    LEFT JOIN (
      SELECT assignment_id, COUNT(*) as total
      FROM assignment_items
      GROUP BY assignment_id
    ) items ON items.assignment_id = a.id
    LEFT JOIN (
      SELECT 
        assignment_id,
        COUNT(DISTINCT question_id) as completed,
        COUNT(DISTINCT CASE WHEN is_correct THEN question_id END) as correct
      FROM attempts
      WHERE student_user_id = p_student_user_id
        AND assignment_id IS NOT NULL
      GROUP BY assignment_id
    ) attempts ON attempts.assignment_id = a.id
    WHERE a.assigned_student_user_id = p_student_user_id
  ) subq;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rpc_tutor_dashboard_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_student_dashboard_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_student_assignment_progress(uuid) TO authenticated;
