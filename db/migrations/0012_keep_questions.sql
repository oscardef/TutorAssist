-- 0012: Questions outlive the people who wrote them (decision 2026-10-30).
-- When a workspace is deleted with an account, its questions move to the
-- platform archive workspace instead of being deleted: same content, topic
-- (re-created there by name), syllabus point and review status, no author.
-- They stay in the library review queue. Callable by the service role only.
BEGIN;

INSERT INTO public.workspaces (name, slug, settings_json)
SELECT 'Mathium archive', 'mathium-archive', '{"system": "archive"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces WHERE slug = 'mathium-archive');

CREATE OR REPLACE FUNCTION public.archive_workspace_questions(p_workspace uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  archive uuid := (SELECT id FROM workspaces WHERE slug = 'mathium-archive');
  t record;
  images jsonb;
BEGIN
  IF archive IS NULL OR archive = p_workspace THEN
    RETURN jsonb_build_object('archive', archive, 'moved', 0, 'images', '[]'::jsonb);
  END IF;
  -- One archive topic per topic name (reused across deleted workspaces)
  FOR t IN SELECT DISTINCT tp.name, tp.curriculum_node_id FROM topics tp
            WHERE tp.workspace_id = p_workspace AND EXISTS (SELECT 1 FROM questions q WHERE q.topic_id = tp.id)
  LOOP
    INSERT INTO topics (workspace_id, name, curriculum_node_id)
    SELECT archive, t.name, t.curriculum_node_id
    WHERE NOT EXISTS (SELECT 1 FROM topics x WHERE x.workspace_id = archive AND x.name = t.name);
  END LOOP;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'key', q.prompt_image_r2_key)), '[]'::jsonb) INTO images
    FROM questions q WHERE q.workspace_id = p_workspace AND q.prompt_image_r2_key IS NOT NULL;

  UPDATE questions q SET
    workspace_id = archive,
    topic_id = (SELECT x.id FROM topics x JOIN topics old ON old.id = q.topic_id WHERE x.workspace_id = archive AND x.name = old.name LIMIT 1),
    created_by = NULL,
    primary_program_id = NULL,
    primary_grade_level_id = NULL,
    source_material_id = NULL,
    batch_id = NULL,
    updated_at = now()
  WHERE q.workspace_id = p_workspace;

  RETURN jsonb_build_object('archive', archive, 'moved', (SELECT count(*) FROM questions WHERE workspace_id = archive), 'images', images);
END;
$function$;
REVOKE ALL ON FUNCTION public.archive_workspace_questions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_workspace_questions(uuid) TO service_role;

-- Account deletion archives a workspace's questions before deleting it
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
  w uuid;
  archived jsonb := '[]'::jsonb;
BEGIN
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
  FOREACH w IN ARRAY deleted LOOP
    archived := archived || public.archive_workspace_questions(w);
  END LOOP;
  IF array_length(deleted, 1) > 0 THEN
    DELETE FROM workspaces WHERE id = ANY(deleted);
  END IF;

  DELETE FROM tutor_feedback WHERE student_user_id = p_user OR tutor_user_id = p_user;
  DELETE FROM spaced_repetition WHERE student_user_id = p_user;
  DELETE FROM question_flags WHERE student_user_id = p_user;
  DELETE FROM attempts WHERE student_user_id = p_user;
  DELETE FROM sessions WHERE student_id = p_user OR tutor_id = p_user
     OR student_profile_id IN (SELECT id FROM student_profiles WHERE user_id = p_user);
  DELETE FROM assignments WHERE assigned_student_user_id = p_user;
  DELETE FROM student_profiles WHERE user_id = p_user;

  UPDATE questions SET created_by = NULL WHERE created_by = p_user;
  UPDATE assignments SET created_by = NULL WHERE created_by = p_user;
  UPDATE pdf_exports SET created_by = NULL WHERE created_by = p_user;
  UPDATE source_materials SET uploaded_by = NULL WHERE uploaded_by = p_user;
  UPDATE question_flags SET reviewed_by = NULL WHERE reviewed_by = p_user;
  UPDATE flag_pattern_summaries SET resolved_by = NULL WHERE resolved_by = p_user;
  DELETE FROM invite_tokens WHERE created_by = p_user;

  DELETE FROM identity.users WHERE id = p_user;
  RETURN jsonb_build_object('ok', true, 'deleted_workspaces', to_jsonb(deleted), 'archived', archived);
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid, boolean) TO service_role;

COMMIT;
