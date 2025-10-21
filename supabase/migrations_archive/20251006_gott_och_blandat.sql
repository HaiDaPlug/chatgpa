1) Create mvp_billing (needed by the view)
-- Create Lemon Squeezy billing table (safe if already exists)
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

2) Ensure your fuel columns are the ones we’ll reference

(You said your columns are personal, reserve, pool_bonus. No changes needed. Skip if that’s true.)

-- Optional: quick peek at columns (won’t change anything)
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='mvp_fuel'
order by ordinal_position;

3) Create/replace the v_account view (matches your column names)
-- If the view exists with wrong deps, drop then recreate
drop view if exists public.v_account;

create view public.v_account as
select
  b.user_id,
  coalesce(b.tier, s.tier) as tier,
  b.status,
  b.current_period_end,
  f.personal   as personal_tokens,
  f.reserve    as reserve_tokens,
  f.pool_bonus as pool_bonus_tokens
from public.mvp_billing b
full join public.mvp_subscription s on s.user_id = b.user_id
left join public.mvp_fuel f on f.user_id = coalesce(b.user_id, s.user_id);

4) (Optional but recommended) Create mvp_usage_logs + spend_tokens RPC

This powers real token deduction; uses your personal/reserve columns.

-- Usage logs
create table if not exists public.mvp_usage_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null,
  created_at timestamptz not null default now()
);
create unique index if not exists mvp_usage_logs_user_msg_uidx
  on public.mvp_usage_logs(user_id, message_id);

alter table public.mvp_usage_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mvp_usage_logs' and policyname='usage read self') then
    create policy "usage read self"
    on public.mvp_usage_logs for select
    to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mvp_usage_logs' and policyname='usage svc write') then
    create policy "usage svc write"
    on public.mvp_usage_logs for all
    to service_role using (true) with check (true);
  end if;
end$$;

-- spend_tokens RPC (idempotent by message_id)
create or replace function public.spend_tokens(
  p_user_id uuid,
  p_total_tokens integer,
  p_message_id text,
  p_prompt_tokens integer default 0,
  p_completion_tokens integer default 0
)
returns table (charged boolean, personal_after bigint, reserve_after bigint)
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
    select personal, reserve into v_personal, v_reserve
    from mvp_fuel where user_id = p_user_id;
    return query select false, coalesce(v_personal,0), coalesce(v_reserve,0);
  end if;

  select exists(
    select 1 from mvp_usage_logs where user_id = p_user_id and message_id = p_message_id
  ) into v_already;

  if v_already then
    select personal, reserve into v_personal, v_reserve
    from mvp_fuel where user_id = p_user_id;
    return query select false, coalesce(v_personal,0), coalesce(v_reserve,0);
  end if;

  update mvp_fuel
  set
    personal = case
      when personal >= p_total_tokens then personal - p_total_tokens
      else 0
    end,
    reserve = case
      when personal >= p_total_tokens then reserve
      else greatest(0, reserve - (p_total_tokens - personal))
    end,
    updated_at = now()
  where user_id = p_user_id;

  begin
    insert into mvp_usage_logs(user_id, message_id, prompt_tokens, completion_tokens, total_tokens)
    values (p_user_id, p_message_id, p_prompt_tokens, p_completion_tokens, p_total_tokens);
  exception when unique_violation then
    null;
  end;

  select personal, reserve into v_personal, v_reserve
  from mvp_fuel where user_id = p_user_id;

  return query select true, coalesce(v_personal,0), coalesce(v_reserve,0);
end
$$;

grant execute on function public.spend_tokens(uuid, integer, text, integer, integer)
  to anon, authenticated, service_role;

5) (Optional) Seed-after-purchase RPC for Lemon Squeezy webhook

Uses your columns; call this from your LS webhook on successful activation.

create or replace function public.seed_after_purchase(p_user_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens bigint;
begin
  if p_tier not in ('Cruiser','Power','Pro') then
    raise exception 'Invalid tier %', p_tier;
  end if;

  v_tokens := case p_tier
    when 'Cruiser' then 178000
    when 'Power'   then 356000
    when 'Pro'     then 711000
  end;

  insert into mvp_subscription(user_id, tier, created_at, updated_at)
  values (p_user_id, p_tier, now(), now())
  on conflict (user_id) do update set tier = excluded.tier, updated_at = now();

  insert into mvp_fuel(user_id, personal, reserve, pool_bonus)
  values (p_user_id, v_tokens, 0, 0)
  on conflict (user_id) do nothing;
end
$$;

grant execute on function public.seed_after_purchase(uuid, text) to service_role;

6) Quick verification queries

Run each and check they return rows / no errors.

select * from public.mvp_billing limit 1;
select * from public.v_account limit 1;
select proname from pg_proc where proname in ('spend_tokens','seed_after_purchase');

7) Wire-up reminders (outside SQL)

Webhook (LS dashboard): point to /api/ls-webhook, on subscription_created/updated call:

upsert mvp_billing row,

then select public.seed_after_purchase(:user_id, :tier);

Chat API: after a streamed reply, call:

select * from public.spend_tokens(:user_id, :total, :message_id, :prompt, :completion);

That’s it. If any statement errors, paste the exact error and I’ll patch just that piece.