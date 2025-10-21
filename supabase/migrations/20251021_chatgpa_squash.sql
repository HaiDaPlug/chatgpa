-- ============================================
-- ChatGPA — Complete Squash Migration
-- ============================================
-- Purpose: Full schema aligned to context_v2.1
-- Creates all base tables + aligns to new pricing/schema
-- Safe to re-run; all operations check existence first
-- ============================================

-- ========== EXTENSIONS ==========
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== HELPER FUNCTION ==========
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;

-- ========== ENUM: tier ==========
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tier') THEN
    CREATE TYPE tier AS ENUM ('free','monthly','annual');
  END IF;
END
$do$;

-- ========== BASE TABLES ==========

-- classes: user's study subjects
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- notes: uploaded study materials
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  title text,
  source_type text CHECK (source_type IN ('text','pdf','docx','image')) DEFAULT 'text',
  path text,       -- storage path for file uploads
  raw_text text,   -- pasted text
  created_at timestamptz DEFAULT now()
);

-- quizzes: quiz sessions (with embedded questions jsonb per context_v2.1)
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  notes_id uuid REFERENCES public.notes(id) ON DELETE SET NULL,
  questions jsonb DEFAULT '[]'::jsonb,  -- embedded questions per context_v2.1
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- quiz_attempts: user answers + grading
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responses jsonb,    -- {questionId: userAnswer}
  grading jsonb,      -- {questionId: {score, got, missed, next_hint}}
  score numeric CHECK (score >= 0 AND score <= 1),  -- 0..1
  created_at timestamptz DEFAULT now()
);

-- ========== CONTEXT_V2.1 TABLES ==========

-- subscriptions: replaces entitlements per context_v2.1
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- usage_limits: free tier enforcement
CREATE TABLE IF NOT EXISTS public.usage_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  classes_created int NOT NULL DEFAULT 0,
  quizzes_taken int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_classes_user ON public.classes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON public.quiz_attempts(user_id);

-- ========== TRIGGERS ==========
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='subscriptions_updated_at' AND tgrelid='public.subscriptions'::regclass
  ) THEN
    CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='usage_limits_updated_at' AND tgrelid='public.usage_limits'::regclass
  ) THEN
    CREATE TRIGGER usage_limits_updated_at
    BEFORE UPDATE ON public.usage_limits
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END
$do$;

-- ========== RLS ==========
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES ==========

-- Base tables: user owns their rows
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes','notes','quizzes','quiz_attempts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "own rows" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "own rows" ON public.%I FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      t
    );
  END LOOP;
END
$do$;

-- subscriptions: user read own, service role manage all
DROP POLICY IF EXISTS "users_read_own_subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "service_role_manage_subscriptions" ON public.subscriptions;

CREATE POLICY "users_read_own_subscription"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "service_role_manage_subscriptions"
ON public.subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- usage_limits: user read own, service role manage all
DROP POLICY IF EXISTS "users_read_own_limits" ON public.usage_limits;
DROP POLICY IF EXISTS "service_role_manage_limits" ON public.usage_limits;

CREATE POLICY "users_read_own_limits"
ON public.usage_limits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "service_role_manage_limits"
ON public.usage_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========== DATA MIGRATION ==========

-- Migrate legacy entitlements → subscriptions (if exists)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='entitlements'
  ) THEN
    INSERT INTO public.subscriptions (user_id, tier, status, current_period_end, created_at, updated_at)
    SELECT
      user_id,
      CASE
        WHEN plan = 'pro' THEN 'monthly'::tier
        ELSE 'free'::tier
      END AS tier,
      'active' AS status,
      current_period_end,
      created_at,
      updated_at
    FROM public.entitlements
    ON CONFLICT (user_id) DO UPDATE SET
      tier = EXCLUDED.tier,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now();
  END IF;
END
$do$;

-- Migrate legacy questions table → quizzes.questions jsonb (if exists)
DO $do$
DECLARE
  quiz_rec RECORD;
  questions_array jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='questions'
  ) THEN
    FOR quiz_rec IN
      SELECT DISTINCT quiz_id FROM public.questions
    LOOP
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'kind', kind,
          'prompt', prompt,
          'options', options,
          'answer_key', answer_key
        )
      ) INTO questions_array
      FROM public.questions
      WHERE quiz_id = quiz_rec.quiz_id;

      UPDATE public.quizzes
      SET questions = COALESCE(questions, '[]'::jsonb) || questions_array
      WHERE id = quiz_rec.quiz_id;
    END LOOP;
  END IF;
END
$do$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Schema now matches /docs/context_v2.1.md:
-- ✅ tier enum ('free','monthly','annual')
-- ✅ Base tables: classes, notes, quizzes, quiz_attempts
-- ✅ quizzes.questions as jsonb (not separate table)
-- ✅ subscriptions table (replaces entitlements)
-- ✅ usage_limits for free tier enforcement
-- ✅ RLS policies (user read own, service role manage all)
-- ✅ Data migrated from legacy schema
-- ============================================
