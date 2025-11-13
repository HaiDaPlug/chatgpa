-- Migration: Results Page Schema (Section 3)
-- Purpose: Add status tracking, metadata, and autosave support to quiz_attempts
-- Date: 2025-11-08
-- Dependencies: 20251108_unified_analytics.sql

-- ============================================================================
-- Helper Function: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS
  'Trigger function to automatically set updated_at to current timestamp on row update';

-- ============================================================================
-- Table: quiz_attempts (add Section 3 fields)
-- ============================================================================

-- Add status field for in_progress vs submitted distinction
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS status TEXT
  CHECK (status IN ('in_progress', 'submitted'))
  DEFAULT 'in_progress' NOT NULL;

-- Add editable title and subject fields
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add class relationship for breadcrumbs
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS class_id uuid
  REFERENCES public.classes(id) ON DELETE SET NULL;

-- Add detailed timestamps
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Add grading metadata
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS grading_model TEXT;

-- Add metrics JSONB for router/grading data
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS metrics jsonb DEFAULT '{}'::jsonb NOT NULL;

-- Add autosave version counter
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS autosave_version INT DEFAULT 0 NOT NULL;

-- Add duration tracking (computed on submit)
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS duration_ms INT;

COMMENT ON COLUMN public.quiz_attempts.status IS
  'Attempt status: in_progress (user is taking quiz) or submitted (graded and finalized)';

COMMENT ON COLUMN public.quiz_attempts.title IS
  'User-editable attempt title, initially copied from quiz.title';

COMMENT ON COLUMN public.quiz_attempts.subject IS
  'User-editable subject tag, initially copied from quiz.subject';

COMMENT ON COLUMN public.quiz_attempts.class_id IS
  'Optional class association for breadcrumbs and filtering';

COMMENT ON COLUMN public.quiz_attempts.started_at IS
  'When user first started this attempt';

COMMENT ON COLUMN public.quiz_attempts.updated_at IS
  'Last autosave or edit timestamp, auto-updated by trigger';

COMMENT ON COLUMN public.quiz_attempts.submitted_at IS
  'When user submitted for grading (null if still in_progress)';

COMMENT ON COLUMN public.quiz_attempts.grading_model IS
  'AI model used for grading (e.g., gpt-4o-mini, gpt-5-mini)';

COMMENT ON COLUMN public.quiz_attempts.metrics IS
  'JSONB metrics: { tokens_in, tokens_out, latency_ms, fallback_happened }';

COMMENT ON COLUMN public.quiz_attempts.autosave_version IS
  'Incremented on each autosave or meta edit for conflict resolution';

COMMENT ON COLUMN public.quiz_attempts.duration_ms IS
  'Time spent from started_at to submitted_at in milliseconds';

-- ============================================================================
-- Backfill: Set status='submitted' for existing attempts
-- ============================================================================

UPDATE public.quiz_attempts
SET status = 'submitted'
WHERE status IS NULL;

-- Backfill started_at from created_at if missing
UPDATE public.quiz_attempts
SET started_at = created_at
WHERE started_at IS NULL;

-- Backfill submitted_at from created_at for existing submitted attempts
UPDATE public.quiz_attempts
SET submitted_at = created_at
WHERE submitted_at IS NULL AND status = 'submitted';

-- ============================================================================
-- Table: quizzes (add title and subject fields)
-- ============================================================================

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS subject TEXT;

COMMENT ON COLUMN public.quizzes.title IS
  'Auto-generated quiz title based on class metadata and content';

COMMENT ON COLUMN public.quizzes.subject IS
  'Auto-detected subject tag (e.g., "Biology", "Computer Science")';

-- ============================================================================
-- Indexes for Performance (Section 3 Results Page)
-- ============================================================================

-- Ongoing column: sort by updated_at DESC
CREATE INDEX IF NOT EXISTS idx_attempts_user_status_updated
  ON public.quiz_attempts(user_id, status, updated_at DESC);

-- Results column: sort by submitted_at DESC
CREATE INDEX IF NOT EXISTS idx_attempts_user_status_submitted
  ON public.quiz_attempts(user_id, status, submitted_at DESC);

-- "One active attempt per quiz/user" enforcement check
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_status
  ON public.quiz_attempts(quiz_id, status);

-- Class filter for Results page
CREATE INDEX IF NOT EXISTS idx_attempts_class
  ON public.quiz_attempts(class_id)
  WHERE class_id IS NOT NULL;

-- Partial unique index: only one in_progress attempt per quiz/user
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_unique_in_progress
  ON public.quiz_attempts(quiz_id, user_id)
  WHERE status = 'in_progress';

COMMENT ON INDEX idx_attempts_unique_in_progress IS
  'Enforces one active (in_progress) attempt per quiz per user';

-- ============================================================================
-- Trigger: Auto-update updated_at on any quiz_attempts change
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_quiz_attempts_updated_at ON public.quiz_attempts;

CREATE TRIGGER trigger_quiz_attempts_updated_at
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trigger_quiz_attempts_updated_at ON public.quiz_attempts IS
  'Automatically sets updated_at to current timestamp on any row update';

-- ============================================================================
-- RLS Policies: Protect autosave and meta edit routes
-- ============================================================================

-- Drop existing policies if they exist (to recreate with new fields)
DROP POLICY IF EXISTS "quiz_attempts_select_own" ON public.quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts_insert_own" ON public.quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts_update_own" ON public.quiz_attempts;

-- Policy: Users can SELECT their own attempts
CREATE POLICY "quiz_attempts_select_own"
  ON public.quiz_attempts
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can INSERT their own attempts
CREATE POLICY "quiz_attempts_insert_own"
  ON public.quiz_attempts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can UPDATE only their own attempts
-- Prevents updating other users' attempts via /autosave or /meta routes
CREATE POLICY "quiz_attempts_update_own"
  ON public.quiz_attempts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Note: No DELETE policy (users cannot delete attempts)
-- Admin access uses service role key (bypasses RLS)

-- ============================================================================
-- Analytics Table: Add Section 3 event types (documentation)
-- ============================================================================

-- This migration doesn't modify the analytics table structure (already flexible JSONB)
-- But documents the new event types for Section 3:
--
-- Section 3 Events:
--   - results_page_viewed
--   - attempt_card_viewed
--   - attempt_resume_clicked
--   - attempt_title_edited
--   - attempt_subject_edited
--   - attempt_autosave_success
--   - attempt_autosave_fail
--   - result_opened
--   - grade_summary_viewed
--   - attempt_submit_clicked
--   - attempt_submit_success
--   - attempt_submit_fail
--
-- Required keys in data JSONB (all Section 3 events):
--   - request_id: uuid
--   - route: text (e.g., '/results', '/attempts/:id')
--   - user_id: uuid (redundant with table column, but useful for JSONB queries)
--   - client_ts: timestamptz (client timestamp for clock drift analysis)
--   - attempt_id: uuid (when relevant)
--
-- Example insertion:
--   INSERT INTO analytics (event, user_id, data)
--   VALUES (
--     'attempt_resume_clicked',
--     auth.uid(),
--     jsonb_build_object(
--       'request_id', gen_random_uuid(),
--       'route', '/results',
--       'client_ts', now(),
--       'attempt_id', '<attempt_uuid>'
--     )
--   );

-- ============================================================================
-- Down Migration (Rollback)
-- ============================================================================

-- To rollback this migration (if needed):
--
-- DROP TRIGGER IF EXISTS trigger_quiz_attempts_updated_at ON public.quiz_attempts;
-- DROP INDEX IF EXISTS idx_attempts_unique_in_progress;
-- DROP INDEX IF EXISTS idx_attempts_class;
-- DROP INDEX IF EXISTS idx_attempts_quiz_status;
-- DROP INDEX IF EXISTS idx_attempts_user_status_submitted;
-- DROP INDEX IF EXISTS idx_attempts_user_status_updated;
--
-- ALTER TABLE public.quiz_attempts
--   DROP COLUMN IF EXISTS duration_ms,
--   DROP COLUMN IF EXISTS autosave_version,
--   DROP COLUMN IF EXISTS metrics,
--   DROP COLUMN IF EXISTS grading_model,
--   DROP COLUMN IF EXISTS submitted_at,
--   DROP COLUMN IF EXISTS updated_at,
--   DROP COLUMN IF EXISTS started_at,
--   DROP COLUMN IF EXISTS class_id,
--   DROP COLUMN IF EXISTS subject,
--   DROP COLUMN IF EXISTS title,
--   DROP COLUMN IF EXISTS status;
--
-- ALTER TABLE public.quizzes
--   DROP COLUMN IF EXISTS subject,
--   DROP COLUMN IF EXISTS title;
--
-- DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- ============================================================================
-- Validation Queries (run manually after deployment)
-- ============================================================================

-- 1. Verify status backfill:
--    SELECT status, COUNT(*) FROM quiz_attempts GROUP BY status;
--    -- Should show all existing rows as 'submitted'
--
-- 2. Verify unique index works:
--    -- Try to insert two in_progress attempts for same quiz/user
--    -- Should fail with unique constraint violation
--
-- 3. Verify updated_at trigger:
--    UPDATE quiz_attempts SET title = 'Test' WHERE id = '<some_id>';
--    SELECT id, title, updated_at FROM quiz_attempts WHERE id = '<some_id>';
--    -- updated_at should be current timestamp
--
-- 4. Test RLS policies:
--    -- As authenticated user:
--    SELECT * FROM quiz_attempts;  -- Should only see own rows
--    UPDATE quiz_attempts SET title = 'Hacked' WHERE user_id != auth.uid();  -- Should affect 0 rows
--
-- 5. Verify indexes:
--    EXPLAIN ANALYZE
--    SELECT * FROM quiz_attempts
--    WHERE user_id = '<user_id>' AND status = 'in_progress'
--    ORDER BY updated_at DESC LIMIT 20;
--    -- Should use idx_attempts_user_status_updated
