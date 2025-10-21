-- 1) Ensure mvp_billing exists
create table if not exists public.mvp_billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'lemonsqueezy',
  ls_order_id text,
  ls_subscription_id text,
  tier text check (tier in ('Cruiser','Power','Pro')),
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mvp_billing enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_billing' and policyname='billing read self'
  ) then
    create policy "billing read self"
    on public.mvp_billing for select
    to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_billing' and policyname='billing svc write'
  ) then
    create policy "billing svc write"
    on public.mvp_billing for all
    to service_role using (true) with check (true);
  end if;
end$$;

-- 2) Recreate v_account now that mvp_billing is guaranteed to exist
create or replace view public.v_account as
select
  b.user_id,
  coalesce(b.tier, s.tier) as tier,
  b.status,
  b.current_period_end,
  f.personal_tokens,
  f.reserve_tokens,
  f.pool_bonus_tokens
from public.mvp_billing b
full join public.mvp_subscription s on s.user_id = b.user_id
left join public.mvp_fuel f on f.user_id = coalesce(b.user_id, s.user_id);
