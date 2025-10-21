-- =========================================
-- ChatGPA MVP – Canonical Schema (Public)
-- Tables: classes, notes, quizzes, questions, quiz_attempts, entitlements
-- RLS: owner-only; questions via quiz ownership
-- Last updated: 2025-10-21
-- =========================================

-- Extensions (idempotent)
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ========== TABLES ==========

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  title text,
  source_type text check (source_type in ('text','pdf','docx','image')) default 'text',
  path text,       -- storage path for file uploads
  raw_text text,   -- pasted text
  created_at timestamptz default now()
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  notes_id uuid references notes(id) on delete set null,
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  kind text check (kind in ('mcq','short')) not null,
  prompt text not null,
  options jsonb,      -- for mcq
  answer_key jsonb    -- canonical answers / rubric
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  responses jsonb,    -- {questionId: userAnswer}
  grading jsonb,      -- {questionId: {score, got, missed, next_hint}}
  score numeric,      -- 0..1
  created_at timestamptz default now()
);

create table if not exists entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text check (plan in ('free','pro')) not null default 'free',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== INDEXES (lightweight) ==========
create index if not exists idx_classes_user on classes(user_id);
create index if not exists idx_notes_user on notes(user_id);
create index if not exists idx_quizzes_user on quizzes(user_id);
create index if not exists idx_questions_quiz on questions(quiz_id);
create index if not exists idx_attempts_quiz on quiz_attempts(quiz_id);
create index if not exists idx_attempts_user on quiz_attempts(user_id);

-- ========== RLS ==========
alter table classes enable row level security;
alter table notes enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table quiz_attempts enable row level security;
alter table entitlements enable row level security;

-- unified owner policy for user-owned tables
do $$
declare t text;
begin
  foreach t in array ['classes','notes','quizzes','quiz_attempts'] loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- questions: readable/writable if you own the parent quiz
drop policy if exists "read by quiz owner" on questions;
drop policy if exists "insert by quiz owner" on questions;
drop policy if exists "update by quiz owner" on questions;
drop policy if exists "delete by quiz owner" on questions;

create policy "read by quiz owner" on questions
for select using (
  exists (select 1 from quizzes q where q.id = quiz_id and q.user_id = auth.uid())
);

create policy "insert by quiz owner" on questions
for insert with check (
  exists (select 1 from quizzes q where q.id = quiz_id and q.user_id = auth.uid())
);

create policy "update by quiz owner" on questions
for update using (
  exists (select 1 from quizzes q where q.id = quiz_id and q.user_id = auth.uid())
) with check (
  exists (select 1 from quizzes q where q.id = quiz_id and q.user_id = auth.uid())
);

create policy "delete by quiz owner" on questions
for delete using (
  exists (select 1 from quizzes q where q.id = quiz_id and q.user_id = auth.uid())
);

-- entitlements: user can read own; writes via service role (Stripe webhook)
drop policy if exists "self entitlement" on entitlements;
create policy "self entitlement" on entitlements
for select using (user_id = auth.uid());
