-- 0007: Platform curriculum trees (IB DP first). Global, versioned, read by
-- everyone, written only by the server (service_role, via the seed script
-- scripts/seed-curricula.ts which db:migrate runs after migrations).
-- Questions and workspace topics can point at a syllabus point.
BEGIN;

CREATE TABLE IF NOT EXISTS public.curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,              -- e.g. IBDP-AA-2021
  framework text NOT NULL,                -- e.g. IB DP
  name text NOT NULL,                     -- e.g. Mathematics: analysis and approaches
  short_name text NOT NULL,               -- e.g. Math AA
  version text NOT NULL,                  -- e.g. first assessment 2021
  levels text[] NOT NULL DEFAULT '{}',    -- e.g. {SL,HL}
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','verified','retired')),
  source_note text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.curriculum_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
  code text NOT NULL,                     -- e.g. 1, SL1.2, AHL5.16
  title text NOT NULL,
  level text,                             -- SL (everyone) or AHL (HL only); null for topic headings
  depth integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curriculum_id, code)
);
CREATE INDEX IF NOT EXISTS curriculum_nodes_curriculum_idx ON public.curriculum_nodes (curriculum_id, order_index);

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS curriculum_node_id uuid REFERENCES public.curriculum_nodes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS questions_curriculum_node_idx ON public.questions (curriculum_node_id) WHERE curriculum_node_id IS NOT NULL;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS curriculum_node_id uuid REFERENCES public.curriculum_nodes(id) ON DELETE SET NULL;

ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Curricula are readable by everyone" ON public.curricula;
CREATE POLICY "Curricula are readable by everyone" ON public.curricula FOR SELECT USING (true);
DROP POLICY IF EXISTS "Curriculum nodes are readable by everyone" ON public.curriculum_nodes;
CREATE POLICY "Curriculum nodes are readable by everyone" ON public.curriculum_nodes FOR SELECT USING (true);
GRANT SELECT ON public.curricula, public.curriculum_nodes TO anon, authenticated;
GRANT ALL ON public.curricula, public.curriculum_nodes TO service_role;

COMMIT;
