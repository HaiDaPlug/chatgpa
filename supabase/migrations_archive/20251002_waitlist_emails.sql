-- ===========================
-- Waitlist emails table
-- ===========================
create table if not exists public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  ip text,
  ua text,
  created_at timestamptz not null default now()
);

-- Enable RLS (idempotent)
alter table public.waitlist_emails enable row level security;

-- Revoke all access from anon/authenticated (API uses service role)
revoke all on public.waitlist_emails from anon, authenticated;

-- Index for lookups
create index if not exists idx_waitlist_emails_email on public.waitlist_emails(email);
create index if not exists idx_waitlist_emails_created_at on public.waitlist_emails(created_at desc);
