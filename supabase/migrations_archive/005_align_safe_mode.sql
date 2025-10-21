-- SAFE-MODE ALIGNMENT (non-destructive). Creates/aligns; never DROP.

-- 0) Helper: touch_updated_at()
do $$ begin
  if not exists (
    select 1 from pg_proc where proname = 'touch_updated_at' and pg_function_is_visible(oid)
  ) then
    create or replace function public.touch_updated_at()
    returns trigger language plpgsql as $$
    begin
      new.updated_at = now();
      return new;
    end $$;
  end if;
end $$;

-- 1) Ensure enum 'tier' ('free','monthly','annual')
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tier') then
    create type tier as enum ('free','monthly','annual');
  end if;
end $$;

-- 2) Ensure subscriptions table exists & is shaped correctly
do $$ begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='subscriptions'
  ) then
    create table public.subscriptions (
      user_id uuid primary key references auth.users(id) on delete cascade,
      tier tier not null default 'free',
      status text not null default 'inactive',
      current_period_end timestamptz,
      updated_at timestamptz not null default now()
    );
  else
    -- if exists with 'plan' text or 'tier' text, coerce to enum
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='tier'
            and data_type='text'
    ) then
      alter table public.subscriptions
        alter column tier type tier using
          case lower(tier)
            when 'monthly' then 'monthly'::tier
            when 'annual'  then 'annual'::tier
            else 'free'::tier
          end;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='tier'
    ) then
      alter table public.subscriptions add column tier tier not null default 'free';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='status'
    ) then
      alter table public.subscriptions add column status text not null default 'inactive';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='current_period_end'
    ) then
      alter table public.subscriptions add column current_period_end timestamptz;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='updated_at'
    ) then
      alter table public.subscriptions add column updated_at timestamptz not null default now();
    end if;
  end if;
end $$;

-- trigger for updated_at
do $$ begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname='subscriptions' and t.tgname='trg_subscriptions_touch'
  ) then
    create trigger trg_subscriptions_touch
    before update on public.subscriptions
    for each row execute function public.touch_updated_at();
  end if;
end $$;

-- 3) Migrate data from entitlements (if present) into subscriptions (no drop)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='entitlements') then
    -- Accept either 'plan text' or 'tier' columns
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='entitlements' and column_name='plan'
    ) then
      insert into public.subscriptions (user_id, tier, status, current_period_end, updated_at)
      select
        e.user_id,
        case when lower(e.plan) in ('pro','monthly') then 'monthly'::tier
             when lower(e.plan) = 'annual' then 'annual'::tier
             else 'free'::tier end,
        case when lower(e.plan) in ('pro','monthly','annual') then 'active' else 'inactive' end,
        null,
        coalesce(e.updated_at, now())
      from public.entitlements e
      on conflict (user_id) do update
        set tier = excluded.tier,
            status = excluded.status,
            updated_at = excluded.updated_at;
    elsif exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='entitlements' and column_name='tier'
    ) then
      insert into public.subscriptions (user_id, tier, status, current_period_end, updated_at)
      select
        e.user_id,
        case lower(e.tier)
          when 'monthly' then 'monthly'::tier
          when 'annual'  then 'annual'::tier
          else 'free'::tier end,
        case when lower(e.tier) in ('monthly','annual') then 'active' else 'inactive' end,
        null,
        coalesce(e.updated_at, now())
      from public.entitlements e
      on conflict (user_id) do update
        set tier = excluded.tier,
            status = excluded.status,
            updated_at = excluded.updated_at;
    end if;
  end if;
end $$;

-- 4) Ensure usage_limits table (for free-tier counters)
do $$ begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='usage_limits'
  ) then
    create table public.usage_limits (
      user_id uuid primary key references auth.users(id) on delete cascade,
      classes_created int not null default 0,
      quizzes_created int not null default 0,
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname='usage_limits' and t.tgname='trg_usage_limits_touch'
  ) then
    create trigger trg_usage_limits_touch
    before update on public.usage_limits
    for each row execute function public.touch_updated_at();
  end if;
end $$;

-- 5) Ensure quizzes.questions jsonb column exists
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='quizzes') then
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='quizzes' and column_name='questions'
    ) then
      alter table public.quizzes add column questions jsonb not null default '[]'::jsonb;
    end if;
  end if;
end $$;

-- 6) If a 'questions' table exists AND has quiz_id, migrate rows into quizzes.questions (no drop)
do $m$
declare
  has_questions_table boolean;
  has_quiz_id boolean;
  has_kind boolean;
  has_prompt boolean;
  has_options boolean;
  has_answer boolean;
  has_meta boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='questions'
  ) into has_questions_table;

  if has_questions_table then
    select exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='questions' and column_name='quiz_id'
    ) into has_quiz_id;

    if has_quiz_id then
      select exists (...) into has_kind
      from (select 1) x
      where exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='questions' and column_name='kind'
      );

      select exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='questions' and column_name='prompt'
      ) into has_prompt;

      select exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='questions' and column_name='options'
      ) into has_options;

      select exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='questions' and column_name='answer'
      ) into has_answer;

      select exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='questions' and column_name='meta'
      ) into has_meta;

      update public.quizzes q
      set questions = coalesce(q.questions, '[]'::jsonb) ||
        coalesce((
          select jsonb_agg(
            jsonb_build_object('id', qs.id)
            || case when has_kind then jsonb_build_object('kind', qs.kind) else '{}'::jsonb end
            || case when has_prompt then jsonb_build_object('prompt', qs.prompt) else '{}'::jsonb end
            || case when has_options then jsonb_build_object('options', coalesce(qs.options, '[]'::jsonb)) else '{}'::jsonb end
            || case when has_answer then jsonb_build_object('answer', qs.answer) else '{}'::jsonb end
            || case when has_meta then jsonb_build_object('meta', coalesce(qs.meta, '{}'::jsonb)) else '{}'::jsonb end
          )
          from public.questions qs
          where qs.quiz_id = q.id
        ), '[]'::jsonb)
      where exists (select 1 from public.questions where quiz_id = q.id);
    end if;
  end if;
end
$m$ language plpgsql;

-- 7) RLS (enable safely if not already)
do $$ begin
  perform 1 from pg_class where relname = 'subscriptions';
  if found then
    execute 'alter table public.subscriptions enable row level security';
    -- owner RW
    create policy if not exists "subscriptions_owner_rw"
    on public.subscriptions for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  perform 1 from pg_class where relname = 'usage_limits';
  if found then
    execute 'alter table public.usage_limits enable row level security';
    create policy if not exists "usage_limits_owner_rw"
    on public.usage_limits for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- 8) Guard: ensure quiz_attempts.score 0..1 (only if column exists)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quiz_attempts' and column_name='score'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='quiz_attempts' and constraint_type='CHECK'
        and constraint_name='quiz_attempts_score_0_1_chk'
    ) then
      alter table public.quiz_attempts
        add constraint quiz_attempts_score_0_1_chk check (score >= 0 and score <= 1);
    end if;
  end if;
end $$;
