-- Add name column to waitlist_emails table
-- Idempotent migration

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'waitlist_emails'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE public.waitlist_emails ADD COLUMN name text;
  END IF;
END$$;

-- Add helpful comment
COMMENT ON COLUMN public.waitlist_emails.name IS 'Optional user name from waitlist signup';
