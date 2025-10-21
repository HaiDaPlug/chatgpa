-- billing_events: Idempotency tracking for Stripe webhook events
-- Prevents duplicate processing of the same event

create table if not exists public.billing_events (
  event_id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

-- Index for faster lookups and cleanup
create index if not exists billing_events_created_idx
  on public.billing_events (created_at desc);

-- Enable RLS and deny public access (webhook uses service key)
alter table public.billing_events enable row level security;

create policy "deny all" on public.billing_events
  for all using (false);

-- Cleanup function to prevent unbounded growth
create or replace function public.cleanup_old_billing_events()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.billing_events
  where created_at < now() - interval '30 days';
end;
$$;

comment on table public.billing_events is 'Webhook event idempotency: tracks processed Stripe events to prevent duplicates';
