-- security_events: lightweight app-level rate limiting table
-- Used for per-IP rate limits without external services

create table if not exists public.security_events (
  id bigserial primary key,
  ip inet not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists security_events_ip_bucket_created_idx
  on public.security_events (ip, bucket, created_at desc);

-- Enable RLS and deny public access (server-side uses service key)
alter table public.security_events enable row level security;

create policy "deny all" on public.security_events
  for all using (false);

-- Add cleanup function to prevent unbounded growth
create or replace function public.cleanup_old_security_events()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.security_events
  where created_at < now() - interval '7 days';
end;
$$;

-- Optional: Schedule cleanup via pg_cron if available
-- SELECT cron.schedule('cleanup-security-events', '0 2 * * *', 'SELECT public.cleanup_old_security_events()');
