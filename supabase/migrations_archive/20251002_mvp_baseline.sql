-- ===========================
-- MVP tables (safe, idempotent)
-- ===========================
create table if not exists public.mvp_subscription (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('cruiser','power','pro')),
  created_at timestamptz not null default now()
);

create table if not exists public.mvp_fuel (
  user_id uuid primary key references auth.users(id) on delete cascade,
  personal bigint not null default 0,
  reserve bigint not null default 0,
  pool_bonus bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Enable RLS (idempotent)
alter table public.mvp_subscription enable row level security;
alter table public.mvp_fuel enable row level security;

-- ===========================
-- Policies (wrapped to avoid duplicates)
-- ===========================
do $$
begin
  -- mvp_subscription
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mvp_subscription' and policyname='mvp_sub_select_own'
  ) then
    create policy "mvp_sub_select_own" on public.mvp_subscription
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mvp_subscription' and policyname='mvp_sub_upsert_own'
  ) then
    create policy "mvp_sub_upsert_own" on public.mvp_subscription
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mvp_subscription' and policyname='mvp_sub_update_own'
  ) then
    create policy "mvp_sub_update_own" on public.mvp_subscription
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- mvp_fuel
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mvp_fuel' and policyname='mvp_fuel_select_own'
  ) then
    create policy "mvp_fuel_select_own" on public.mvp_fuel
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mvp_fuel' and policyname='mvp_fuel_upsert_own'
  ) then
    create policy "mvp_fuel_upsert_own" on public.mvp_fuel
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mvp_fuel' and policyname='mvp_fuel_update_own'
  ) then
    create policy "mvp_fuel_update_own" on public.mvp_fuel
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
