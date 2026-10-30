-- 0004: Spec-driven figures on questions (rendered client-side with JSXGraph).
-- Images continue to use prompt_image_r2_key (a storage key, any backend).
BEGIN;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS figure_json jsonb;
COMMENT ON COLUMN public.questions.figure_json IS 'Figure spec: { type: "graph", xRange, yRange, elements: [...] }. See src/lib/figures.ts';
COMMIT;
