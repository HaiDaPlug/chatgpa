-- Verification script: Check classes table security setup
-- Run this to verify RLS policies, triggers, and constraints are active

-- ============================================
-- 1. Verify table structure
-- ============================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'classes'
ORDER BY ordinal_position;

-- ============================================
-- 2. Verify RLS is enabled
-- ============================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'classes';

-- ============================================
-- 3. List all RLS policies
-- ============================================
SELECT
  policyname,
  cmd AS operation,
  qual AS using_clause,
  with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'classes'
ORDER BY policyname;

-- ============================================
-- 4. Verify triggers
-- ============================================
SELECT
  trigger_name,
  event_manipulation AS on_event,
  action_timing AS timing,
  action_statement AS function_call
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'classes'
ORDER BY trigger_name;

-- ============================================
-- 5. Verify constraints
-- ============================================
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.classes'::regclass
ORDER BY contype, conname;

-- ============================================
-- 6. Check functions used by triggers
-- ============================================
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('touch_updated_at', 'set_user_id_on_classes')
ORDER BY routine_name;

-- ============================================
-- Expected Output Summary:
-- ============================================
-- Columns: id, user_id (NOT NULL), name (NOT NULL), description, created_at, updated_at
-- RLS: enabled = true
-- Policies: 4 policies (read, insert, update, delete)
-- Triggers: 2 triggers (classes_updated_at, set_user_id_on_classes_insert)
-- Constraints: PRIMARY KEY, FOREIGN KEY (user_id -> auth.users), NOT NULL
-- Functions: touch_updated_at, set_user_id_on_classes (both exist)
