-- ===========================================
-- Carpool AI — Core schema (Bonus → Personal; Ghost Ledger)
-- ===========================================
begin;

-- --- ENUM: tier ---
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tier') then
    create type tier as enum ('cruiser','power','pro');
  end if;
end$$;

-- --- USERS MIRROR ---
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz default now()
);

-- --- SUBSCRIPTIONS ---
create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier tier not null,
  status text not null,                        -- 'active' | 'past_due' | 'canceled'
  current_period_start date not null,
  current_period_end date not null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  updated_at timestamptz default now()
);

-- --- LEDGER (TOKENS) ---
create table if not exists token_ledger (
  user_id uuid primary key references auth.users(id) on delete cascade,
  personal bigint not null default 0,  -- spendable now
  reserve  bigint not null default 0,  -- rollover stash (capped by tier)
  updated_at timestamptz default now()
);

-- optional usage journal (handy for debugging/CS)
create table if not exists usage_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tokens_used bigint not null,
  source text not null,                        -- e.g. "chat:completion"
  created_at timestamptz default now()
);

-- --- COMMUNITY BUFFER POT (accumulates monthly buffer in TOKENS) ---
create table if not exists community_pool (
  id smallint primary key default 1,
  balance bigint not null default 0,  -- tokens sitting in the pot
  updated_at timestamptz default now()
);
insert into community_pool (id, balance) values (1, 0)
  on conflict (id) do nothing;

-- --- CAPS (GPT-5 truth): $1 ≈ 178k tokens; caps are $5/$10/$20 ---
drop view if exists v_reserve_caps;
create view v_reserve_caps as
select 'cruiser'::tier as tier,  890000::bigint as cap union all
select 'power'::tier,           1780000::bigint union all
select 'pro'::tier,             3560000::bigint;

-- --- RPC: SPEND (personal → reserve) ---
create or replace function spend_tokens(p_user_id uuid, p_amount bigint)
returns void language plpgsql as $$
declare
  remain bigint := p_amount;
  led record;
  use_personal bigint := 0;
  use_reserve  bigint := 0;
begin
  select * into led from token_ledger where user_id = p_user_id for update;
  if not found then raise exception 'ledger not found for %', p_user_id; end if;

  -- personal first
  if led.personal >= remain then
    use_personal := remain; remain := 0;
  else
    use_personal := led.personal; remain := remain - led.personal;
  end if;

  -- then reserve
  if remain > 0 then
    if led.reserve >= remain then
      use_reserve := remain; remain := 0;
    else
      use_reserve := led.reserve; remain := remain - led.reserve;
    end if;
  end if;

  update token_ledger
  set personal = personal - use_personal,
      reserve  = reserve  - use_reserve,
      updated_at = now()
  where user_id = p_user_id;

  insert into usage_events(user_id, tokens_used, source)
  values (p_user_id, p_amount, 'chat:completion');

  -- if remain > 0 → app should upsell/payg
end;
$$;

-- --- RPC: apply_monthly_allocation (called by Stripe webhook on renewal/change)
-- expects amounts IN TOKENS already (Claude/Jerry compute with 178k tokens per $)
-- p_personal = guaranteed monthly personal tokens (e.g., 178k cruiser)
-- p_buffer   = monthly buffer (e.g., 89k cruiser)
create or replace function apply_monthly_allocation(
  p_user_id uuid,
  p_personal bigint,
  p_buffer bigint
) returns void language plpgsql as $$
declare
  exists_led boolean := false;
begin
  -- ensure ledger row
  insert into token_ledger(user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  -- top up personal with this month's guaranteed amount
  update token_ledger
  set personal = personal + p_personal,
      updated_at = now()
  where user_id = p_user_id;

  -- add buffer into the community pot (silent)
  update community_pool
  set balance = balance + p_buffer,
      updated_at = now()
  where id = 1;
end;
$$;

-- --- RPC: monthly_rollover (run on the 1st via cron)
-- 1) Evenly split pool.balance across ACTIVE users → add to PERSONAL
-- 2) Move remaining PERSONAL → RESERVE (cap by tier)
-- 3) Zero the pool
create or replace function monthly_rollover()
returns void language plpgsql as $$
declare
  pot bigint := 0;
  ucount bigint := 0;
  per_user bigint := 0;
begin
  select balance into pot from community_pool where id = 1 for update;
  if pot is null then pot := 0; end if;

  -- who is active
  with active as (
    select user_id, tier from subscriptions where status = 'active'
  ) select count(*) into ucount from active;

  if ucount > 0 and pot > 0 then
    per_user := floor(pot / ucount);

    -- add the bonus straight into PERSONAL
    update token_ledger t
    set personal = personal + per_user,
        updated_at = now()
    where t.user_id in (select user_id from subscriptions where status='active');

    -- reset pot
    update community_pool set balance = 0, updated_at = now() where id = 1;
  end if;

  -- PERSONAL → RESERVE (cap by tier)
  with caps as (select * from v_reserve_caps)
  update token_ledger t
  set reserve = least(
        t.reserve + t.personal,
        case s.tier
          when 'cruiser' then (select cap from caps where tier='cruiser')
          when 'power'   then (select cap from caps where tier='power')
          when 'pro'     then (select cap from caps where tier='pro')
        end
      ),
      personal = 0,
      updated_at = now()
  from subscriptions s
  where s.user_id = t.user_id
    and s.status = 'active';
end;
$$;

-- --- RLS (basic, owner can see their own rows) ---
alter table user_profiles enable row level security;
alter table subscriptions enable row level security;
alter table token_ledger enable row level security;
alter table usage_events enable row level security;

do $$ begin
  create policy "me_read_profiles" on user_profiles
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "me_read_subs" on subscriptions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "me_read_ledger" on token_ledger
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "me_read_usage" on usage_events
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

commit;
