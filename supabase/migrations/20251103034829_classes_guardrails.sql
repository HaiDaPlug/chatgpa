-- Migration: Add guardrails for classes table
-- Date: 2025-11-01
-- Purpose: Ensure RLS, updated_at trigger, and user_id auto-population

-- ============================================
-- 1. Add updated_at column if not exists
-- ============================================
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================
-- 2. Create trigger to auto-update updated_at
-- ============================================
-- Note: touch_updated_at() function already exists from squash migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'classes_updated_at'
    AND tgrelid = 'public.classes'::regclass
  ) THEN
    CREATE TRIGGER classes_updated_at
      BEFORE UPDATE ON public.classes
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- ============================================
-- 3. Create trigger to auto-set user_id on insert
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_id_on_classes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set user_id if it's NULL (allows explicit setting if needed)
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Validate that user_id matches current user (security check)
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user_id must match authenticated user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS set_user_id_on_classes_insert ON public.classes;

-- Create the trigger
CREATE TRIGGER set_user_id_on_classes_insert
  BEFORE INSERT ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_on_classes();

-- ============================================
-- 4. Verify RLS is enabled (should already be from squash)
-- ============================================
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Recreate RLS policies with explicit names
-- ============================================
-- Drop the generic "own rows" policy if it exists
DROP POLICY IF EXISTS "own rows" ON public.classes;

-- Create separate policies for clarity
DROP POLICY IF EXISTS "users_read_own_classes" ON public.classes;
CREATE POLICY "users_read_own_classes"
  ON public.classes
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_classes" ON public.classes;
CREATE POLICY "users_insert_own_classes"
  ON public.classes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_classes" ON public.classes;
CREATE POLICY "users_update_own_classes"
  ON public.classes
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_classes" ON public.classes;
CREATE POLICY "users_delete_own_classes"
  ON public.classes
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 6. Add helpful comments
-- ============================================
COMMENT ON TABLE public.classes IS 'User classes/courses - RLS enforced, user_id auto-populated';
COMMENT ON COLUMN public.classes.user_id IS 'Owner of the class - auto-set on insert via trigger';
COMMENT ON COLUMN public.classes.updated_at IS 'Auto-updated on row modification via trigger';
COMMENT ON FUNCTION public.set_user_id_on_classes() IS 'Automatically sets user_id to auth.uid() on insert and validates ownership';

-- ============================================
-- 7. Verify constraints
-- ============================================
-- Ensure user_id is NOT NULL (should already be from squash, but double-check)
ALTER TABLE public.classes
ALTER COLUMN user_id SET NOT NULL;

-- Ensure foreign key exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classes_user_id_fkey'
  ) THEN
    ALTER TABLE public.classes
    ADD CONSTRAINT classes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
