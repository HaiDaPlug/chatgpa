-- Migration: Generation Analytics Table
-- Purpose: Track AI quiz generation metrics (model usage, performance, quality)
-- Date: 2025-11-07

-- ============================================================================
-- Table: generation_analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generation_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,

  -- Model & routing context
  model_used text NOT NULL,
  model_family text NOT NULL CHECK (model_family IN ('reasoning', 'standard')),
  fallback_triggered boolean DEFAULT false,
  attempt_count int DEFAULT 1 CHECK (attempt_count >= 1 AND attempt_count <= 5),

  -- Performance metrics
  latency_ms int CHECK (latency_ms >= 0),
  tokens_prompt int CHECK (tokens_prompt >= 0),
  tokens_completion int CHECK (tokens_completion >= 0),
  tokens_total int CHECK (tokens_total >= 0),

  -- Content metrics
  question_count int CHECK (question_count >= 0),
  mcq_count int CHECK (mcq_count >= 0),
  short_count int CHECK (short_count >= 0),

  -- Quality metrics (flexible JSON structure)
  quality_metrics jsonb DEFAULT '{}'::jsonb,
  -- Expected shape: {
  --   "concept_coverage_ratio": 0.85,
  --   "question_diversity_score": 0.60,
  --   "duplicate_ratio": 0.0,
  --   "difficulty_balance": { "easy": 0.3, "medium": 0.5, "hard": 0.2 }
  -- }

  -- Source context
  source_type text CHECK (source_type IN ('class', 'paste', 'file')),
  note_size_chars int CHECK (note_size_chars >= 0),

  -- Error tracking (for failed attempts)
  error_occurred boolean DEFAULT false,
  error_code text,
  error_message text,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add helpful comment
COMMENT ON TABLE public.generation_analytics IS
  'Tracks AI quiz generation analytics: model usage, performance metrics, and content quality';

COMMENT ON COLUMN public.generation_analytics.model_family IS
  'Model family: reasoning (gpt-5*, o-series) or standard (gpt-4o*)';

COMMENT ON COLUMN public.generation_analytics.quality_metrics IS
  'Flexible JSONB field for quality metrics: concept_coverage_ratio, question_diversity_score, duplicate_ratio, difficulty_balance';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary query patterns: by user, by quiz, by date, by model
CREATE INDEX IF NOT EXISTS idx_generation_analytics_user_id
  ON public.generation_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_generation_analytics_quiz_id
  ON public.generation_analytics(quiz_id);

CREATE INDEX IF NOT EXISTS idx_generation_analytics_created_at
  ON public.generation_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_analytics_model_used
  ON public.generation_analytics(model_used);

-- Composite index for user + date queries (common in analytics)
CREATE INDEX IF NOT EXISTS idx_generation_analytics_user_date
  ON public.generation_analytics(user_id, created_at DESC);

-- Index for fallback analysis
CREATE INDEX IF NOT EXISTS idx_generation_analytics_fallback
  ON public.generation_analytics(fallback_triggered, created_at DESC)
  WHERE fallback_triggered = true;

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE public.generation_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own analytics
CREATE POLICY "generation_analytics_select_own"
  ON public.generation_analytics
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can INSERT their own analytics
CREATE POLICY "generation_analytics_insert_own"
  ON public.generation_analytics
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Note: No UPDATE or DELETE policies (analytics are immutable)
-- Admin access would use service role key (bypasses RLS)

-- ============================================================================
-- Helper Views (Optional - for common queries)
-- ============================================================================

-- View: Recent generation stats per user (last 24 hours)
CREATE OR REPLACE VIEW public.generation_analytics_recent AS
SELECT
  user_id,
  COUNT(*) as total_generations,
  AVG(latency_ms) as avg_latency_ms,
  SUM(tokens_total) as total_tokens,
  COUNT(*) FILTER (WHERE fallback_triggered = true) as fallback_count,
  COUNT(*) FILTER (WHERE error_occurred = true) as error_count,
  AVG((quality_metrics->>'concept_coverage_ratio')::numeric) as avg_concept_coverage,
  AVG((quality_metrics->>'question_diversity_score')::numeric) as avg_diversity_score
FROM public.generation_analytics
WHERE created_at > now() - interval '24 hours'
GROUP BY user_id;

-- RLS for view (inherits from base table)
ALTER VIEW public.generation_analytics_recent SET (security_invoker = on);

COMMENT ON VIEW public.generation_analytics_recent IS
  'Aggregated generation analytics per user (last 24 hours)';

-- ============================================================================
-- Validation: Test RLS Policies
-- ============================================================================

-- These queries should be run manually after deployment to verify RLS works:
--
-- 1. As authenticated user:
--    SELECT * FROM generation_analytics;  -- Should only see own rows
--
-- 2. As service role:
--    SELECT * FROM generation_analytics;  -- Should see all rows
--
-- 3. Test insert:
--    INSERT INTO generation_analytics (user_id, model_used, model_family, ...)
--    VALUES (auth.uid(), 'gpt-4o-mini', 'standard', ...);  -- Should succeed
--
-- 4. Test cross-user access:
--    SELECT * FROM generation_analytics WHERE user_id != auth.uid();  -- Should return 0 rows
