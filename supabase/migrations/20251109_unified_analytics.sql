-- Migration: Unified Analytics Table
-- Purpose: Single table for all AI operations (generation, grading, future features)
-- Date: 2025-11-08
-- Replaces: generation_analytics table (kept for backward compatibility)

-- ============================================================================
-- Table: analytics (unified event tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL, -- 'generation_success', 'generation_fail', 'grade_success', 'grade_fail', etc.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Flexible JSONB data field for event-specific metrics
  data jsonb DEFAULT '{}'::jsonb

  -- Expected keys in data (all events):
  --   request_id: uuid
  --   model_used: text
  --   model_family: 'reasoning' | 'standard'
  --   fallback_triggered: boolean
  --   attempt_count: int
  --   latency_ms: int
  --   tokens_prompt: int (optional, may be null for non-AI events)
  --   tokens_completion: int (optional)
  --   tokens_total: int (optional)

  -- Generation-specific keys:
  --   quiz_id: uuid
  --   question_count: int
  --   mcq_count: int
  --   short_count: int
  --   quality_metrics: { concept_coverage_ratio, question_diversity_score, duplicate_ratio }
  --   source_type: 'class' | 'paste' | 'file'
  --   note_size_chars: int
  --   error_code: text (if fail)
  --   error_message: text (if fail)

  -- Grading-specific keys:
  --   attempt_id: uuid
  --   quiz_id: uuid
  --   rubric_version: text
  --   question_type_breakdown: { mcq, short, long }
  --   criteria_summaries: { coverage_avg, accuracy_avg, clarity_avg, conciseness_avg }
  --   concept_stats: { total_concepts_detected, total_concepts_hit, concept_coverage_ratio }
  --   error_code: text (if fail)
  --   error_message: text (if fail)
);

-- Add helpful comments
COMMENT ON TABLE public.analytics IS
  'Unified analytics for all AI operations: generation, grading, and future features. Event-specific data stored in JSONB field.';

COMMENT ON COLUMN public.analytics.event IS
  'Event type: generation_success, generation_fail, grade_success, grade_fail, etc.';

COMMENT ON COLUMN public.analytics.data IS
  'Flexible JSONB field containing event-specific metrics. All events include: request_id, model_used, model_family, fallback_triggered, tokens, latency.';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary query patterns: by user, by event type, by date
CREATE INDEX IF NOT EXISTS idx_analytics_user_id
  ON public.analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_event
  ON public.analytics(event);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at
  ON public.analytics(created_at DESC);

-- Composite index for event + date queries (health diagnostics)
CREATE INDEX IF NOT EXISTS idx_analytics_event_date
  ON public.analytics(event, created_at DESC);

-- Composite index for user + event queries (user analytics dashboards)
CREATE INDEX IF NOT EXISTS idx_analytics_user_event
  ON public.analytics(user_id, event, created_at DESC);

-- JSONB index for fallback queries
CREATE INDEX IF NOT EXISTS idx_analytics_fallback
  ON public.analytics((data->>'fallback_triggered'))
  WHERE (data->>'fallback_triggered')::boolean = true;

-- JSONB index for model_used queries
CREATE INDEX IF NOT EXISTS idx_analytics_model_used
  ON public.analytics((data->>'model_used'));

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own analytics
CREATE POLICY "analytics_select_own"
  ON public.analytics
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can INSERT their own analytics
CREATE POLICY "analytics_insert_own"
  ON public.analytics
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Note: No UPDATE or DELETE policies (analytics are immutable)
-- Admin access uses service role key (bypasses RLS)

-- ============================================================================
-- Backward Compatibility View
-- ============================================================================

-- View: v_generation_analytics (mirrors old generation_analytics table)
-- Allows legacy queries to continue working while code migrates
CREATE OR REPLACE VIEW public.v_generation_analytics AS
SELECT
  id,
  (data->>'quiz_id')::uuid as quiz_id,
  user_id,
  (data->>'request_id')::uuid as request_id,

  -- Model & routing
  data->>'model_used' as model_used,
  data->>'model_family' as model_family,
  (data->>'fallback_triggered')::boolean as fallback_triggered,
  (data->>'attempt_count')::int as attempt_count,

  -- Performance metrics
  (data->>'latency_ms')::int as latency_ms,
  (data->>'tokens_prompt')::int as tokens_prompt,
  (data->>'tokens_completion')::int as tokens_completion,
  (data->>'tokens_total')::int as tokens_total,

  -- Content metrics
  (data->>'question_count')::int as question_count,
  (data->>'mcq_count')::int as mcq_count,
  (data->>'short_count')::int as short_count,

  -- Quality metrics (keep as jsonb)
  data->'quality_metrics' as quality_metrics,

  -- Source context
  data->>'source_type' as source_type,
  (data->>'note_size_chars')::int as note_size_chars,

  -- Error tracking
  (event = 'generation_fail') as error_occurred,
  data->>'error_code' as error_code,
  data->>'error_message' as error_message,

  created_at
FROM public.analytics
WHERE event IN ('generation_success', 'generation_fail');

-- RLS for view (inherits from base table)
ALTER VIEW public.v_generation_analytics SET (security_invoker = on);

COMMENT ON VIEW public.v_generation_analytics IS
  'Backward compatibility view for generation_analytics queries. Filters analytics table to generation events only.';

-- ============================================================================
-- Data Migration (Optional - Backfill from generation_analytics)
-- ============================================================================

-- Uncomment to migrate existing generation_analytics rows to unified analytics table
-- This is OPTIONAL and can be run later if needed

/*
INSERT INTO public.analytics (id, event, user_id, created_at, data)
SELECT
  id,
  CASE WHEN error_occurred THEN 'generation_fail' ELSE 'generation_success' END as event,
  user_id,
  created_at,
  jsonb_build_object(
    'quiz_id', quiz_id,
    'request_id', request_id,
    'model_used', model_used,
    'model_family', model_family,
    'fallback_triggered', fallback_triggered,
    'attempt_count', attempt_count,
    'latency_ms', latency_ms,
    'tokens_prompt', tokens_prompt,
    'tokens_completion', tokens_completion,
    'tokens_total', tokens_total,
    'question_count', question_count,
    'mcq_count', mcq_count,
    'short_count', short_count,
    'quality_metrics', quality_metrics,
    'source_type', source_type,
    'note_size_chars', note_size_chars,
    'error_code', error_code,
    'error_message', error_message
  ) as data
FROM public.generation_analytics
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================================
-- Validation: Test RLS Policies
-- ============================================================================

-- These queries should be run manually after deployment to verify RLS works:
--
-- 1. As authenticated user:
--    SELECT * FROM analytics;  -- Should only see own rows
--
-- 2. As service role:
--    SELECT * FROM analytics;  -- Should see all rows
--
-- 3. Test insert:
--    INSERT INTO analytics (event, user_id, data)
--    VALUES ('test_event', auth.uid(), '{"test": true}'::jsonb);  -- Should succeed
--
-- 4. Test view:
--    SELECT * FROM v_generation_analytics;  -- Should show generation events only
--
-- 5. Test cross-user access:
--    SELECT * FROM analytics WHERE user_id != auth.uid();  -- Should return 0 rows
