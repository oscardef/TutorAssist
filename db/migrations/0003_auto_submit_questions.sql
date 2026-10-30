-- 0003: Every workspace question is automatically proposed for the shared
-- library (decision 2026-10-30). Imports from the library and global copies
-- set their own status explicitly in code. Idempotent.
BEGIN;
ALTER TABLE public.questions ALTER COLUMN review_status SET DEFAULT 'submitted';
ALTER TABLE public.questions ALTER COLUMN submitted_at SET DEFAULT now();
UPDATE public.questions
   SET review_status = 'submitted', submitted_at = COALESCE(submitted_at, created_at, now())
 WHERE library = 'workspace' AND review_status = 'none' AND origin <> 'imported';
COMMIT;
