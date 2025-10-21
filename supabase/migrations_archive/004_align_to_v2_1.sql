-- 1) PRICING: create enum 'tier' and subscriptions table
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tier') then
    create type tier as enum ('free','monthly','annual');
  end if;
end $$;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier tier not null default 'free',
  status text not null default 'inactive', -- 'active' | 'inactive' | 'past_due' | etc.
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- auto-touch updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_subscriptions_touch on public.subscriptions;
create trigger trg_subscriptions_touch
before update on public.subscriptions
for each row execute function public.touch_updated_at();

-- 2) MIGRATE from entitlements (plan text with 'free'/'pro') → subscriptions (enum)
-- Map: 'pro' -> 'monthly', else 'free'
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'entitlements' and table_schema = 'public') then
    insert into public.subscriptions (user_id, tier, status, current_period_end, updated_at)
    select
      e.user_id,
      case when lower(e.plan) = 'pro' then 'monthly'::tier else 'free'::tier end,
      case when lower(e.plan) = 'pro' then 'active' else 'inactive' end,
      null,
      coalesce(e.updated_at, now())
    from public.entitlements e
    on conflict (user_id) do update
      set tier = excluded.tier,
          status = excluded.status,
          updated_at = excluded.updated_at;
  end if;
end $$;

-- 3) USAGE LIMITS for Free tier counters
create table if not exists public.usage_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  classes_created int not null default 0,
  quizzes_created int not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_usage_limits_touch on public.usage_limits;
create trigger trg_usage_limits_touch
before update on public.usage_limits
for each row execute function public.touch_updated_at();

-- 4) QUESTIONS: embed into quizzes as jsonb array
-- add column if missing
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='questions'
  ) then
    alter table public.quizzes add column questions jsonb not null default '[]'::jsonb;
  end if;
end $$;

-- Migrate rows from public.questions → quizzes.questions (jsonb)
-- We try common field names; adjust if your current 'questions' schema differs.
do $m$
declare
  col_kind_exists boolean;
  col_prompt_exists boolean;
  col_options_exists boolean;
  col_answer_exists boolean;
  col_meta_exists boolean;
begin
  -- detect columns in questions table to avoid errors if schema differs
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='kind'
  ) into col_kind_exists;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='prompt'
  ) into col_prompt_exists;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='options'
  ) into col_options_exists;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='answer'
  ) into col_answer_exists;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='questions' and column_name='meta'
  ) into col_meta_exists;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='questions') then
    -- build json objects defensively
    update public.quizzes q
    set questions = coalesce(q.questions, '[]'::jsonb) ||
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', qs.id
            )
            || case when col_kind_exists then jsonb_build_object('kind', qs.kind) else '{}'::jsonb end
            || case when col_prompt_exists then jsonb_build_object('prompt', qs.prompt) else '{}'::jsonb end
            || case when col_options_exists then jsonb_build_object('options', coalesce(qs.options, '[]'::jsonb)) else '{}'::jsonb end
            || case when col_answer_exists then jsonb_build_object('answer', qs.answer) else '{}'::jsonb end
            || case when col_meta_exists then jsonb_build_object('meta', coalesce(qs.meta, '{}'::jsonb)) else '{}'::jsonb end
          )
          from public.questions qs
          where qs.quiz_id = q.id
        ),
        '[]'::jsonb
      )
    where exists (select 1 from public.questions where quiz_id = q.id);
  end if;
end
$m$ language plpgsql;

-- 5) CLEANUP old tables
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='questions') then
    drop table public.questions;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='entitlements') then
    drop table public.entitlements;
  end if;
end $$;

-- 6) RLS POLICIES
alter table public.subscriptions enable row level security;
alter table public.usage_limits enable row level security;

-- Owner can read/write own subscriptions
drop policy if exists "subscriptions_owner_rw" on public.subscriptions;
create policy "subscriptions_owner_rw"
on public.subscriptions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Owner can read/update own usage_limits
drop policy if exists "usage_limits_owner_rw" on public.usage_limits;
create policy "usage_limits_owner_rw"
on public.usage_limits
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 7) (Optional) CHECK constraints for score and question structure inside quizzes.questions
-- Example: enforce quiz_attempts.score between 0 and 1
do $$ begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema='public' and table_name='quiz_attempts' and constraint_name='quiz_attempts_score_0_1_chk'
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_score_0_1_chk check (score >= 0 and score <= 1);
  end if;
end $$;
