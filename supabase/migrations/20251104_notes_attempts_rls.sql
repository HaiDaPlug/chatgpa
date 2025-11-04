-- SAFER NOTES + QUIZ_ATTEMPTS WITH PARENT-OWNERSHIP CHECKS

-- NOTES ----------------------------------------------------------------
-- Update schema to match expected structure (raw_text → content)
DO $$
BEGIN
  -- Rename raw_text to content if raw_text exists and content doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notes' AND column_name='raw_text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notes' AND column_name='content'
  ) THEN
    ALTER TABLE public.notes RENAME COLUMN raw_text TO content;
  END IF;

  -- Add content column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notes' AND column_name='content'
  ) THEN
    ALTER TABLE public.notes ADD COLUMN content text;
  END IF;

  -- Ensure user_id has default
  ALTER TABLE public.notes ALTER COLUMN user_id SET DEFAULT auth.uid();

  -- Ensure class_id is NOT NULL (required for parent ownership)
  ALTER TABLE public.notes ALTER COLUMN class_id SET NOT NULL;
END $$;

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS notes_user_id_idx     ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS notes_class_id_idx    ON public.notes(class_id);
CREATE INDEX IF NOT EXISTS notes_user_class_idx  ON public.notes(user_id, class_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx  ON public.notes(created_at);

-- Enable RLS (idempotent)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Drop existing generic policy
DROP POLICY IF EXISTS "own rows" ON public.notes;

-- Create parent-ownership policies for notes
DROP POLICY IF EXISTS "notes_select_own" ON public.notes;
CREATE POLICY "notes_select_own"
  ON public.notes FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = notes.class_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "notes_insert_own" ON public.notes;
CREATE POLICY "notes_insert_own"
  ON public.notes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "notes_update_own" ON public.notes;
CREATE POLICY "notes_update_own"
  ON public.notes FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = notes.class_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "notes_delete_own" ON public.notes;
CREATE POLICY "notes_delete_own"
  ON public.notes FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = notes.class_id
      AND c.user_id = auth.uid()
    )
  );

-- QUIZ_ATTEMPTS --------------------------------------------------------
-- Ensure user_id has default
ALTER TABLE public.quiz_attempts ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS quiz_attempts_user_id_idx    ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_id_idx     ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_user_quiz_idx   ON public.quiz_attempts(user_id, quiz_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_created_at_idx  ON public.quiz_attempts(created_at);

-- Enable RLS (idempotent)
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing generic policy
DROP POLICY IF EXISTS "own rows" ON public.quiz_attempts;

-- Create parent-ownership policies for quiz_attempts
DROP POLICY IF EXISTS "attempts_select_own" ON public.quiz_attempts;
CREATE POLICY "attempts_select_own"
  ON public.quiz_attempts FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
      AND q.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attempts_insert_own" ON public.quiz_attempts;
CREATE POLICY "attempts_insert_own"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id
      AND q.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attempts_update_own" ON public.quiz_attempts;
CREATE POLICY "attempts_update_own"
  ON public.quiz_attempts FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
      AND q.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id
      AND q.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attempts_delete_own" ON public.quiz_attempts;
CREATE POLICY "attempts_delete_own"
  ON public.quiz_attempts FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
      AND q.user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE public.notes IS 'Study notes for classes - RLS enforced with parent class ownership validation';
COMMENT ON TABLE public.quiz_attempts IS 'Quiz attempt records - RLS enforced with parent quiz ownership validation';
COMMENT ON COLUMN public.notes.content IS 'Note content text (renamed from raw_text for clarity)';
COMMENT ON COLUMN public.quiz_attempts.responses IS 'User responses to quiz questions (JSONB)';
COMMENT ON COLUMN public.quiz_attempts.score IS 'Final score (0.0 to 1.0)';
