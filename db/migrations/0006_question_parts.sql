-- 0006: Multi-part questions (IB style). parts_json is an ordered list of
-- parts, each with its own prompt, answer and marks. A question with parts is
-- answered as a whole: one attempt stores every part's answer and the server
-- records the marks earned as partial_credit (0..1). Additive and idempotent.
BEGIN;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS parts_json jsonb;
COMMENT ON COLUMN public.questions.parts_json IS 'Ordered parts: [{ label, prompt, answer_type, correct_answer_json, marks, hints? }]. See src/lib/parts.ts';
COMMIT;
