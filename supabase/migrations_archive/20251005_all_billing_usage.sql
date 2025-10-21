-- ===== Safe extensions =====
create extension if not exists pgcrypto with schema public;

-- ===== WAITLIST EMAILS =====
create table if not exists public.waitlist_emails (
  id           bigserial primary key,
  email        text not null,
  source       text,
  created_at   timestamptz not null default now()
);

alter table public.waitlist_emails enable row level security;

-- Deny by default; allow only service_role writes
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'waitlist_emails' and policyname = 'waitlist service write'
  ) then
    create policy "waitlist service write"
    on public.waitlist_emails
    as permissive
    for all
    to service_role
    using (true) with check (true);
  end if;
end$$;

-- ===== CORE TABLES (create only if missing) =====
create table if not exists public.mvp_subscription (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text check (tier in ('Cruiser','Power','Pro')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.mvp_subscription enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_subscription' and policyname='sub read self'
  ) then
    create policy "sub read self"
    on public.mvp_subscription for select
    to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_subscription' and policyname='sub svc write'
  ) then
    create policy "sub svc write"
    on public.mvp_subscription for all
    to service_role using (true) with check (true);
  end if;
end$$;

create table if not exists public.mvp_fuel (
  user_id uuid primary key references auth.users(id) on delete cascade,
  personal_tokens bigint not null default 0,
  reserve_tokens  bigint not null default 0,
  pool_bonus_tokens bigint not null default 0,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.mvp_fuel enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_fuel' and policyname='fuel read self'
  ) then
    create policy "fuel read self"
    on public.mvp_fuel for select
    to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_fuel' and policyname='fuel svc write'
  ) then
    create policy "fuel svc write"
    on public.mvp_fuel for all
    to service_role using (true) with check (true);
  end if;
end$$;

-- ===== USAGE LOGS (idempotent per user_id+message_id) =====
create table if not exists public.mvp_usage_logs (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  message_id      text not null,
  prompt_tokens   integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens    integer not null,
  created_at      timestamptz not null default now()
);
create unique index if not exists mvp_usage_logs_user_msg_uidx
  on public.mvp_usage_logs(user_id, message_id);

alter table public.mvp_usage_logs enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_usage_logs' and policyname='usage read self'
  ) then
    create policy "usage read self"
    on public.mvp_usage_logs for select
    to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mvp_usage_logs' and policyname='usage svc write'
  ) then
    create policy "usage svc write"
    on public.mvp_usage_logs for all
    to service_role using (true) with check (true);
  end if;
end$$;

-- ===== BILLING (Lemon Squeezy) =====
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

-- ===== Helper view for Account =====
create or replace view public.v_account as
select
  b.user_id,
  coalesce(b.tier, s.tier) as tier,
  b.status,
  b.current_period_end,
  f.personal_tokens, f.reserve_tokens, f.pool_bonus_tokens
from public.mvp_billing b
full join public.mvp_subscription s on s.user_id = b.user_id
left join public.mvp_fuel f on f.user_id = coalesce(b.user_id, s.user_id);

-- ===== RPC: spend_tokens (idempotent by message_id) =====
-- Deducts from personal, then reserve. Inserts usage log if not present.
-- Returns the resulting balances and a flag whether this call performed a new charge.
create or replace function public.spend_tokens(
  p_user_id uuid,
  p_total_tokens integer,
  p_message_id text,
  p_prompt_tokens integer default 0,
  p_completion_tokens integer default 0
)
returns table (
  charged boolean,
  personal_after bigint,
  reserve_after bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_personal bigint;
  v_reserve  bigint;
  v_already boolean;
begin
  if p_total_tokens <= 0 then
    return query select false, (select personal_tokens from mvp_fuel where user_id=p_user_id), (select reserve_tokens from mvp_fuel where user_id=p_user_id);
    return;
  end if;

  -- Idempotency check
  select exists(
    select 1 from mvp_usage_logs where user_id = p_user_id and message_id = p_message_id
  ) into v_already;

  if v_already then
    select personal_tokens, reserve_tokens into v_personal, v_reserve
    from mvp_fuel where user_id = p_user_id;
    return query select false, coalesce(v_personal,0), coalesce(v_reserve,0);
  end if;

  -- Atomic deduct
  perform 1;
  update mvp_fuel
  set
    personal_tokens = case
      when personal_tokens >= p_total_tokens then personal_tokens - p_total_tokens
      else 0
    end,
    reserve_tokens = case
      when personal_tokens >= p_total_tokens then reserve_tokens
      else greatest(0, reserve_tokens - (p_total_tokens - personal_tokens))
    end,
    updated_at = now()
  where user_id = p_user_id;

  -- Insert usage log (unique constraint protects idempotency under race)
  begin
    insert into mvp_usage_logs(user_id, message_id, prompt_tokens, completion_tokens, total_tokens)
    values (p_user_id, p_message_id, p_prompt_tokens, p_completion_tokens, p_total_tokens);
  exception when unique_violation then
    -- another concurrent insert did it; continue
    null;
  end;

  select personal_tokens, reserve_tokens
  into v_personal, v_reserve
  from mvp_fuel where user_id = p_user_id;

  return query select true, coalesce(v_personal,0), coalesce(v_reserve,0);
end
$$;

grant execute on function public.spend_tokens(uuid, integer, text, integer, integer) to anon, authenticated, service_role;

-- ===== RPC: seed_after_purchase (idempotent per user) =====
-- Initializes subscription+fuel based on tier if not already seeded.
-- Token allocations per current pricing:
-- Cruiser ~178_000, Power ~356_000, Pro ~711_000 (all to personal to start).
create or replace function public.seed_after_purchase(p_user_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_tokens bigint;
begin
  if p_tier not in ('Cruiser','Power','Pro') then
    raise exception 'Invalid tier %', p_tier;
  end if;

  -- Choose allocation
  v_tokens := case p_tier
    when 'Cruiser' then 178000
    when 'Power'   then 356000
    when 'Pro'     then 711000
  end;

  -- Upsert subscription
  insert into mvp_subscription(user_id, tier, created_at, updated_at)
  values (p_user_id, p_tier, now(), now())
  on conflict (user_id) do update set tier = excluded.tier, updated_at = now();

  -- Seed fuel if empty
  select exists(select 1 from mvp_fuel where user_id = p_user_id) into v_exists;
  if not v_exists then
    insert into mvp_fuel(user_id, personal_tokens, reserve_tokens, pool_bonus_tokens)
    values (p_user_id, v_tokens, 0, 0);
  end if;
end
$$;

grant execute on function public.seed_after_purchase(uuid, text) to service_role;

-- ===== OPTIONAL: helpful comment on RLS =====
comment on table public.waitlist_emails is 'Insert-only via service_role; used by /api/join-waitlist.';
comment on table public.mvp_usage_logs is 'Per-message usage with idempotent (user_id, message_id).';
comment on function public.spend_tokens is 'Atomic token deduction; idempotent by message_id.';
comment on function public.seed_after_purchase is 'Called from billing webhook to initialize tier & fuel.';
