-- 0002: Shared question library with a review step.
-- Every question lives in a workspace bank (library = 'workspace'). A tutor can
-- propose one for the shared library (review_status = 'submitted'); a platform
-- owner approves it, which creates a read-only copy with library = 'global'
-- that every workspace can see and import. Idempotent.

BEGIN;

ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS library text NOT NULL DEFAULT 'workspace',
    ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS review_notes text,
    ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
    ADD COLUMN IF NOT EXISTS source_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS license text NOT NULL DEFAULT 'private',
    ADD COLUMN IF NOT EXISTS attribution text;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_library_check') THEN
        ALTER TABLE public.questions ADD CONSTRAINT questions_library_check CHECK (library IN ('workspace', 'global'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_review_status_check') THEN
        ALTER TABLE public.questions ADD CONSTRAINT questions_review_status_check CHECK (review_status IN ('none', 'submitted', 'approved', 'rejected'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_library ON public.questions(library) WHERE library = 'global';
CREATE INDEX IF NOT EXISTS idx_questions_review_status ON public.questions(review_status) WHERE review_status = 'submitted';
CREATE INDEX IF NOT EXISTS idx_questions_source ON public.questions(source_question_id);

-- Approved library questions are readable by every signed-in user, in addition
-- to the existing workspace-scoped policies. Writes stay workspace-scoped.
DROP POLICY IF EXISTS "Library questions are readable by all" ON public.questions;
CREATE POLICY "Library questions are readable by all" ON public.questions
    FOR SELECT USING (library = 'global' AND review_status = 'approved' AND auth.uid() IS NOT NULL);

COMMIT;
