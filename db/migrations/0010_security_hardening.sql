-- 0010: Hardening before public exposure (security review 2026-10-30).
-- PostgREST is internal-only and the app issues fixed, workspace-filtered
-- queries, so none of this was reachable from outside; it closes the gaps a
-- direct API caller could have used.
BEGIN;

-- Views ran with their owner's rights and skipped RLS. Run them as the caller.
ALTER VIEW public.questions_with_curriculum SET (security_invoker = true);
ALTER VIEW public.topics_with_curriculum SET (security_invoker = true);
ALTER VIEW public.student_activity_days SET (security_invoker = true);
ALTER VIEW public.student_recent_wrong_questions SET (security_invoker = true);
ALTER VIEW public.vw_topic_performance SET (security_invoker = true);

-- Objects the app never reads through the API: every user's email (users
-- view), cross-workspace performance (materialized view), migration log.
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.mv_student_performance FROM anon, authenticated;
REVOKE ALL ON public.schema_migrations FROM anon, authenticated;

-- Elevated functions that accept arbitrary ids and that the app doesn't call
REVOKE EXECUTE ON FUNCTION public.rpc_student_assignment_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_student_dashboard_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_tutor_dashboard_summary(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_question_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_student_assignment_progress(uuid), public.rpc_student_dashboard_summary(uuid),
  public.rpc_tutor_dashboard_summary(uuid, uuid), public.log_audit_event(uuid, uuid, text, text, uuid, jsonb),
  public.reconcile_question_stats() TO service_role;

-- Only count an attempt on a question in a workspace the caller belongs to
CREATE OR REPLACE FUNCTION public.update_question_stats(question_id_param uuid, is_correct_param boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE questions q
  SET
    times_attempted = COALESCE(q.times_attempted, 0) + 1,
    times_correct = COALESCE(q.times_correct, 0) + CASE WHEN is_correct_param THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE q.id = question_id_param
    AND (auth.role() = 'service_role' OR public.user_workspace_role(auth.uid(), q.workspace_id) IS NOT NULL);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_question_stats(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_question_stats(uuid, boolean) TO authenticated, service_role;

-- Fixed search_path on every elevated function
ALTER FUNCTION public.is_platform_owner(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.user_workspace_role(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_audit_event(uuid, uuid, text, text, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.reconcile_question_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.rpc_student_assignment_progress(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.rpc_student_dashboard_summary(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.rpc_tutor_dashboard_summary(uuid, uuid) SET search_path = public, pg_temp;

COMMIT;
