-- ==========================================
-- Carpool AI V15 — Unified Clean Schema
-- Safe for clean install, keeps waitlist + auth
-- ==========================================

-- Enable helpers (idempotent)
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ==========================================
-- 1️⃣ DROP OLD MVP TABLES (safe reset)
-- ==========================================
drop view if exists public.v_account cascade;
drop table if exists public.mvp_billing cascade;
drop table if exists public.mvp_fuel cascade;
drop table if exists public.mvp_usage_logs cascade;

-- ==========================================
-- 2️⃣ CREATE CORE TABLES
-- ==========================================

-- Billing table
create table public.mvp_billing (
  user_id uuid primary key,
  customer_id text,
  subscription_id text,
  status text check (status in ('active','past_due','canceled','incomplete','trialing')) default 'incomplete',
  tier text check (tier in ('cruiser','power','pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.trg_timestamps_billing()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger t_u_billing
before update on public.mvp_billing
for each row execute procedure public.trg_timestamps_billing();

-- Usage logs (token spend events)
create table public.mvp_usage_logs (
  id bigserial primary key,
  user_id uuid not null,
  tokens_spent bigint not null check (tokens_spent > 0),
  model text,
  message_id text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_usage_user_id on public.mvp_usage_logs(user_id);

-- Fuel ledger (normalized)
create table public.mvp_fuel (
  id bigserial primary key,
  user_id uuid not null,
  source text check (source in ('personal','reserve','pool_bonus','manual')) not null,
  tokens bigint not null check (tokens >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index idx_fuel_user_source on public.mvp_fuel(user_id, source);

-- ==========================================
-- 3️⃣ ACCOUNT VIEW (live balance calculation)
-- ==========================================
create or replace view public.v_account as
with grants as (
  select
    user_id,
    sum(case when source='personal'   then tokens else 0 end) as personal_granted,
    sum(case when source='reserve'    then tokens else 0 end) as reserve_granted,
    sum(case when source='pool_bonus' then tokens else 0 end) as pool_granted
  from public.mvp_fuel
  group by user_id
),
spend as (
  select user_id, coalesce(sum(tokens_spent),0)::bigint as spent
  from public.mvp_usage_logs
  group by user_id
)
select
  g.user_id,
  greatest(coalesce(g.personal_granted,0) - coalesce(s.spent,0),0)::bigint as personal_tokens,
  greatest(
    case when coalesce(g.personal_granted,0) > coalesce(s.spent,0)
      then 0
      else coalesce(g.reserve_granted,0) - (coalesce(s.spent,0) - coalesce(g.personal_granted,0))
    end, 0
  )::bigint as reserve_tokens,
  greatest(
    case
      when coalesce(s.spent,0) <= coalesce(g.personal_granted,0)+coalesce(g.reserve_granted,0) then 0
      else coalesce(g.pool_granted,0) - (coalesce(s.spent,0) - (coalesce(g.personal_granted,0)+coalesce(g.reserve_granted,0)))
    end, 0
  )::bigint as pool_bonus_tokens
from grants g
left join spend s using (user_id);

-- ==========================================
-- 4️⃣ FUNCTIONS (RPCs)
-- ==========================================

-- Spend tokens in priority order
create or replace function public.spend_tokens(
  p_user_id uuid,
  p_tokens bigint,
  p_model text default null,
  p_message_id text default null,
  p_meta jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_bal record;
begin
  if p_tokens <= 0 then
    return jsonb_build_object('ok', false, 'reason','non_positive_spend');
  end if;

  select personal_tokens, reserve_tokens, pool_bonus_tokens
  into v_bal
  from public.v_account
  where user_id = p_user_id;

  if v_bal is null then
    return jsonb_build_object('ok', false, 'reason','no_balance');
  end if;

  if (v_bal.personal_tokens + v_bal.reserve_tokens + v_bal.pool_bonus_tokens) < p_tokens then
    return jsonb_build_object('ok', false, 'reason','insufficient_funds');
  end if;

  insert into public.mvp_usage_logs (user_id, tokens_spent, model, message_id, meta)
  values (p_user_id, p_tokens, p_model, p_message_id, p_meta);

  return jsonb_build_object(
    'ok', true,
    'after', (select row_to_json(v) from (select * from public.v_account where user_id=p_user_id) v)
  );
end $$;

-- Seed allocations after purchase
create or replace function public.seed_after_purchase(
  p_user_id uuid,
  p_tier text,
  p_customer text,
  p_subscription text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_tokens_personal bigint;
begin
  if p_tier not in ('cruiser','power','pro') then
    return jsonb_build_object('ok',false,'reason','invalid_tier');
  end if;

  select case p_tier
           when 'cruiser' then 178000
           when 'power'   then 356000
           when 'pro'     then 711000
         end into v_tokens_personal;

  insert into public.mvp_billing(user_id, customer_id, subscription_id, status, tier)
  values (p_user_id, p_customer, p_subscription, 'active', p_tier)
  on conflict (user_id) do update
    set customer_id = excluded.customer_id,
        subscription_id = excluded.subscription_id,
        status = 'active',
        tier = excluded.tier,
        updated_at = now();

  insert into public.mvp_fuel(user_id, source, tokens, note)
  values (p_user_id, 'personal', v_tokens_personal, 'monthly allocation');

  return jsonb_build_object('ok',true,'granted',v_tokens_personal);
end $$;

-- ==========================================
-- 5️⃣ RLS SECURITY
-- ==========================================
alter table public.mvp_billing enable row level security;
alter table public.mvp_fuel enable row level security;
alter table public.mvp_usage_logs enable row level security;

-- Read-only per user
create policy billing_read_own
  on public.mvp_billing for select
  using (user_id = auth.uid());

create policy fuel_read_own
  on public.mvp_fuel for select
  using (user_id = auth.uid());

create policy usage_read_own
  on public.mvp_usage_logs for select
  using (user_id = auth.uid());

-- Restrict writes to service key
revoke all on table public.mvp_billing     from anon, authenticated;
revoke all on table public.mvp_fuel        from anon, authenticated;
revoke all on table public.mvp_usage_logs  from anon, authenticated;

-- Set ownership
alter function public.spend_tokens(uuid,bigint,text,text,jsonb) owner to postgres;
alter function public.seed_after_purchase(uuid,text,text,text) owner to postgres;

-- ==========================================
-- ✅ Verification (optional post-run)
-- ==========================================
-- select table_name from information_schema.tables where table_schema='public' and table_name like 'mvp_%';
-- select * from public.v_account limit 5;
