-- 0011: Account deletion and inactivity (privacy policy, 2026-10-30).
-- delete_user_account removes a person and their personal data. Content a
-- tutor made in a workspace other people still use stays, without the author.
-- A tutor who is the only tutor of a workspace that has other members is
-- blocked unless p_delete_sole_workspaces is true, which deletes that
-- workspace and everything in it. Callable by the service role only.
BEGIN;

ALTER TABLE public.assignments ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.pdf_exports ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.source_materials ALTER COLUMN uploaded_by DROP NOT NULL;

-- Inactivity warnings (accounts unused for 24 months are deleted after one)
CREATE TABLE IF NOT EXISTS public.account_lifecycle (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  inactivity_warned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_lifecycle ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.account_lifecycle TO service_role;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user uuid, p_delete_sole_workspaces boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  ws record;
  blocked jsonb := '[]'::jsonb;
  deleted uuid[] := '{}';
BEGIN
  -- Workspaces where this person is the only tutor
  FOR ws IN
    SELECT wm.workspace_id,
           (SELECT count(*) FROM workspace_members m2 WHERE m2.workspace_id = wm.workspace_id AND m2.user_id <> p_user) AS others
      FROM workspace_members wm
     WHERE wm.user_id = p_user AND wm.role IN ('tutor', 'platform_owner')
       AND NOT EXISTS (SELECT 1 FROM workspace_members t WHERE t.workspace_id = wm.workspace_id AND t.user_id <> p_user AND t.role IN ('tutor', 'platform_owner'))
  LOOP
    IF ws.others > 0 AND NOT p_delete_sole_workspaces THEN
      blocked := blocked || jsonb_build_object('workspace_id', ws.workspace_id, 'members', ws.others);
    ELSE
      deleted := deleted || ws.workspace_id;
    END IF;
  END LOOP;
  IF jsonb_array_length(blocked) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'blocked', blocked);
  END IF;
  IF array_length(deleted, 1) > 0 THEN
    DELETE FROM workspaces WHERE id = ANY(deleted);
  END IF;

  -- Their learning data, sessions and notes about them
  DELETE FROM tutor_feedback WHERE student_user_id = p_user OR tutor_user_id = p_user;
  DELETE FROM spaced_repetition WHERE student_user_id = p_user;
  DELETE FROM question_flags WHERE student_user_id = p_user;
  DELETE FROM attempts WHERE student_user_id = p_user;
  DELETE FROM sessions WHERE student_id = p_user OR tutor_id = p_user
     OR student_profile_id IN (SELECT id FROM student_profiles WHERE user_id = p_user);
  DELETE FROM assignments WHERE assigned_student_user_id = p_user;
  DELETE FROM student_profiles WHERE user_id = p_user;

  -- Shared content they made stays, without their name
  UPDATE questions SET created_by = NULL WHERE created_by = p_user;
  UPDATE assignments SET created_by = NULL WHERE created_by = p_user;
  UPDATE pdf_exports SET created_by = NULL WHERE created_by = p_user;
  UPDATE source_materials SET uploaded_by = NULL WHERE uploaded_by = p_user;
  UPDATE question_flags SET reviewed_by = NULL WHERE reviewed_by = p_user;
  UPDATE flag_pattern_summaries SET resolved_by = NULL WHERE resolved_by = p_user;
  DELETE FROM invite_tokens WHERE created_by = p_user;

  -- Identity last: cascades to sign-in accounts, sessions, memberships,
  -- calendar connection, booking settings and calendar feed
  DELETE FROM identity.users WHERE id = p_user;
  RETURN jsonb_build_object('ok', true, 'deleted_workspaces', to_jsonb(deleted));
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid, boolean) TO service_role;

COMMIT;
