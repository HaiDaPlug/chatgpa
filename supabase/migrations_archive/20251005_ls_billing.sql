-- Billing table
create table if not exists public.mvp_billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'lemonsqueezy',
  ls_order_id text,
  ls_subscription_id text,
  tier text check (tier in ('Cruiser','Power','Pro')),
  status text, -- active, past_due, canceled, etc.
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mvp_billing enable row level security;

-- RLS: user can read own row
create policy "billing read self"
on public.mvp_billing for select
to authenticated using (auth.uid() = user_id);

-- Service role can insert/update via webhook
create policy "billing svc write"
on public.mvp_billing for all
to service_role using (true) with check (true);

-- (Optional) helper view for Account page
create or replace view public.v_account as
select
  b.user_id, b.tier, b.status, b.current_period_end,
  f.personal_tokens, f.reserve_tokens, f.pool_bonus_tokens
from mvp_billing b
left join mvp_fuel f on f.user_id = b.user_id;
