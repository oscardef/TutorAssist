-- 0008: Whiteboard per tutoring session. The live board is held in the web
-- process and saved here every few seconds; the saved scene is the session's
-- artefact. Access follows the session itself (its tutor's workspace or the
-- session's student), through the sessions RLS policies.
BEGIN;
CREATE TABLE IF NOT EXISTS public.session_boards (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scene_json jsonb NOT NULL DEFAULT '{"elements": []}'::jsonb,
  shown_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Session boards follow their session" ON public.session_boards;
CREATE POLICY "Session boards follow their session" ON public.session_boards
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id));
GRANT SELECT ON public.session_boards TO authenticated;
GRANT ALL ON public.session_boards TO service_role;
COMMIT;
