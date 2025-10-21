-- Add expected columns if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mvp_fuel' and column_name='personal_tokens'
  ) then
    alter table public.mvp_fuel add column personal_tokens bigint not null default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mvp_fuel' and column_name='reserve_tokens'
  ) then
    alter table public.mvp_fuel add column reserve_tokens bigint not null default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mvp_fuel' and column_name='pool_bonus_tokens'
  ) then
    alter table public.mvp_fuel add column pool_bonus_tokens bigint not null default 0;
  end if;

  -- Optional backfill from legacy columns if they exist (won’t run if they don’t)
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mvp_fuel' and column_name='personal'
  ) then
    execute 'update public.mvp_fuel set personal_tokens = coalesce(personal_tokens, personal, 0)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mvp_fuel' and column_name='reserve'
  ) then
    execute 'update public.mvp_fuel set reserve_tokens = coalesce(reserve_tokens, reserve, 0)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mvp_fuel' and column_name='pool'
  ) then
    execute 'update public.mvp_fuel set pool_bonus_tokens = coalesce(pool_bonus_tokens, pool, 0)';
  end if;
end$$;

-- Recreate the account view to use the standardized column names
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
