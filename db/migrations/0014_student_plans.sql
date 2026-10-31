-- 0014: Students without a tutor (decision 2026-10-31).
-- A solo student gets their own workspace (kind 'solo') that is filled from
-- the approved shared library. Their plan lives in entitlements: no row, or
-- a lapsed one, means Free. Students under 16 need a parent or guardian to
-- confirm by email before they can practise (parental_consents). Sponsor
-- messages are the only advertising: written and switched on by a platform
-- owner, shown to Free students, counted in aggregate, never per person.
-- All three tables are read and written by the server only.
BEGIN;

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'tutor';
DO $$ BEGIN
  ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_kind_check CHECK (kind IN ('tutor', 'solo', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.workspaces SET kind = 'system' WHERE slug = 'mathium-archive' AND kind <> 'system';

CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  source text NOT NULL DEFAULT 'grant' CHECK (source IN ('stripe', 'grant')),
  billing_interval text CHECK (billing_interval IN ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  granted_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.entitlements TO service_role;

CREATE TABLE IF NOT EXISTS public.parental_consents (
  student_user_id uuid PRIMARY KEY REFERENCES identity.users(id) ON DELETE CASCADE,
  parent_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.parental_consents TO service_role;

CREATE TABLE IF NOT EXISTS public.sponsor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor text NOT NULL,
  headline text NOT NULL,
  body text,
  link_url text NOT NULL CHECK (link_url ~ '^https://'),
  link_label text NOT NULL DEFAULT 'Find out more',
  active boolean NOT NULL DEFAULT false,
  weight integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 10),
  starts_on date,
  ends_on date,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsor_messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sponsor_messages TO service_role;

-- Counters without a read-modify-write race
CREATE OR REPLACE FUNCTION public.count_sponsor_event(p_id uuid, p_click boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
  UPDATE sponsor_messages
     SET impressions = impressions + CASE WHEN p_click THEN 0 ELSE 1 END,
         clicks = clicks + CASE WHEN p_click THEN 1 ELSE 0 END
   WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.count_sponsor_event(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_sponsor_event(uuid, boolean) TO service_role;

COMMIT;
