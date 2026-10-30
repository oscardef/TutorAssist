-- 0009: Self-service booking. Each tutor has booking settings per workspace
-- with weekly availability windows (minutes from local midnight in their
-- timezone). Students of the workspace can read them to see free slots.
-- Sessions record who booked and cancellations. Calendar feeds give every
-- user a private ICS URL.
BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_settings (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tutor_user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Europe/Zurich',
  slot_minutes integer NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 240),
  buffer_minutes integer NOT NULL DEFAULT 15 CHECK (buffer_minutes BETWEEN 0 AND 120),
  min_notice_hours integer NOT NULL DEFAULT 24 CHECK (min_notice_hours BETWEEN 0 AND 336),
  max_days_ahead integer NOT NULL DEFAULT 28 CHECK (max_days_ahead BETWEEN 1 AND 120),
  cancel_notice_hours integer NOT NULL DEFAULT 24 CHECK (cancel_notice_hours BETWEEN 0 AND 336),
  windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, tutor_user_id)
);
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Booking settings readable by workspace members" ON public.booking_settings;
CREATE POLICY "Booking settings readable by workspace members" ON public.booking_settings
  FOR SELECT USING (public.user_workspace_role(auth.uid(), workspace_id) IS NOT NULL);
DROP POLICY IF EXISTS "Tutors manage their own booking settings" ON public.booking_settings;
CREATE POLICY "Tutors manage their own booking settings" ON public.booking_settings
  FOR ALL USING (tutor_user_id = auth.uid() AND public.user_workspace_role(auth.uid(), workspace_id) IN ('tutor', 'platform_owner'))
  WITH CHECK (tutor_user_id = auth.uid() AND public.user_workspace_role(auth.uid(), workspace_id) IN ('tutor', 'platform_owner'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_settings TO authenticated;
GRANT ALL ON public.booking_settings TO service_role;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS booked_by uuid REFERENCES identity.users(id) ON DELETE SET NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES identity.users(id) ON DELETE SET NULL;
-- One live session per tutor per start time: stops two students taking the same slot
CREATE UNIQUE INDEX IF NOT EXISTS sessions_tutor_slot_unique ON public.sessions (tutor_id, scheduled_at) WHERE status IN ('scheduled', 'confirmed');

CREATE TABLE IF NOT EXISTS public.calendar_feeds (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own calendar feed" ON public.calendar_feeds;
CREATE POLICY "Users manage their own calendar feed" ON public.calendar_feeds
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feeds TO authenticated;
GRANT ALL ON public.calendar_feeds TO service_role;

COMMIT;
