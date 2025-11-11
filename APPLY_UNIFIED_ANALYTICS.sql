-- ============================================================================
-- Manual Migration: Unified Analytics Table
-- Run this in Supabase SQL Editor if `supabase db push` fails
-- ============================================================================

-- 1. Create unified analytics table
CREATE TABLE IF NOT EXISTS public.analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  data jsonb DEFAULT '{}'::jsonb
);

-- 2. Add indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON public.analytics(event);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_date ON public.analytics(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_event ON public.analytics(user_id, event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_fallback ON public.analytics((data->>'fallback_triggered')) WHERE (data->>'fallback_triggered')::boolean = true;
CREATE INDEX IF NOT EXISTS idx_analytics_model_used ON public.analytics((data->>'model_used'));

-- 3. Enable RLS
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS analytics_select_own ON public.analytics;
CREATE POLICY analytics_select_own ON public.analytics FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS analytics_insert_own ON public.analytics;
CREATE POLICY analytics_insert_own ON public.analytics FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. Create backward compatibility view
CREATE OR REPLACE VIEW public.v_generation_analytics AS
SELECT
  id,
  (data->>'quiz_id')::uuid as quiz_id,
  user_id,
  (data->>'request_id')::uuid as request_id,
  data->>'model_used' as model_used,
  data->>'model_family' as model_family,
  (data->>'fallback_triggered')::boolean as fallback_triggered,
  (data->>'attempt_count')::int as attempt_count,
  (data->>'latency_ms')::int as latency_ms,
  (data->>'tokens_prompt')::int as tokens_prompt,
  (data->>'tokens_completion')::int as tokens_completion,
  (data->>'tokens_total')::int as tokens_total,
  (data->>'question_count')::int as question_count,
  (data->>'mcq_count')::int as mcq_count,
  (data->>'short_count')::int as short_count,
  data->'quality_metrics' as quality_metrics,
  data->>'source_type' as source_type,
  (data->>'note_size_chars')::int as note_size_chars,
  (event = 'generation_fail') as error_occurred,
  data->>'error_code' as error_code,
  data->>'error_message' as error_message,
  created_at
FROM public.analytics
WHERE event IN ('generation_success', 'generation_fail');

ALTER VIEW public.v_generation_analytics SET (security_invoker = on);

-- 6. Add comments
COMMENT ON TABLE public.analytics IS 'Unified analytics for all AI operations';
COMMENT ON COLUMN public.analytics.event IS 'Event type: generation_success, generation_fail, grade_success, grade_fail';
COMMENT ON COLUMN public.analytics.data IS 'Flexible JSONB field containing event-specific metrics';
COMMENT ON VIEW public.v_generation_analytics IS 'Backward compatibility view for generation_analytics queries';

-- Done! Verify with:
-- SELECT COUNT(*) FROM analytics;
-- SELECT * FROM v_generation_analytics LIMIT 1;
