-- 0013: AI usage limits, configurable per platform, role, workspace and person.
-- Usage is measured from ai_usage_log (every OpenAI call is logged there).
--   global (subject NULL): kill switch (ai_enabled) and platform-wide caps
--   role (subject 'tutor' | 'student'): defaults for each person with that role
--   workspace (subject = workspace id): on/off and caps on the workspace total
--   user (subject = user id): overrides for one person
-- NULL in a field means "inherit". Read and written by the server only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'role', 'workspace', 'user')),
  subject text,
  ai_enabled boolean,
  daily_requests integer CHECK (daily_requests >= 0),
  monthly_requests integer CHECK (monthly_requests >= 0),
  monthly_cost_usd numeric(10, 2) CHECK (monthly_cost_usd >= 0),
  note text,
  updated_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_limits_scope_subject ON public.ai_limits (scope, coalesce(subject, ''));
ALTER TABLE public.ai_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_limits TO service_role;

CREATE INDEX IF NOT EXISTS ai_usage_log_user_time ON public.ai_usage_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_log_workspace_time ON public.ai_usage_log (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_log_time ON public.ai_usage_log (created_at);

-- Starting values: AI on for the platform with a $20/month budget; off by
-- default for new tutors and students until switched on per person or
-- workspace; per-person caps once on.
INSERT INTO public.ai_limits (scope, subject, ai_enabled, daily_requests, monthly_requests, monthly_cost_usd, note)
SELECT * FROM (VALUES
  ('global', NULL::text, true, NULL::int, NULL::int, 20.00::numeric, 'Platform budget'),
  ('role', 'tutor', false, 100, 1500, 5.00, 'Default for tutors'),
  ('role', 'student', false, 20, 300, 1.00, 'Default for students')
) v(scope, subject, ai_enabled, daily_requests, monthly_requests, monthly_cost_usd, note)
WHERE NOT EXISTS (SELECT 1 FROM public.ai_limits l WHERE l.scope = v.scope AND coalesce(l.subject, '') = coalesce(v.subject, ''));

COMMIT;
