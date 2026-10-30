-- 0005: Any question anyone makes is proposed for the shared library
-- (decision 2026-10-30, widened). Only untouched copies imported from the
-- library stay out of the queue; they become submissions once edited.
BEGIN;
UPDATE public.questions
   SET review_status = 'submitted', submitted_at = COALESCE(submitted_at, created_at, now())
 WHERE library = 'workspace' AND review_status = 'none' AND source_question_id IS NULL;
COMMIT;
