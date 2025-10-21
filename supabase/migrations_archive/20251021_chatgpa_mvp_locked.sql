-- ============================================
-- ChatGPA MVP - Locked Schema
-- Last Updated: 2025-10-21
-- Status: 🔒 LOCKED - See MIGRATION_SUMMARY.md for rationale
-- ============================================

begin;

-- ===========================================
-- 1. PRICING TIER (LOCKED: free + pro only)
-- ===========================================

drop type if exists plan_type cascade;
create type plan_type as enum ('free', 'pro');

-- ===========================================
-- 2. CORE TABLES
-- ===========================================

-- Classes (user's courses)
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_classes_user_id on classes(user_id);

-- Notes (uploaded study materials)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,                       -- extracted text
  file_url text,                               -- Supabase Storage URL (notes-files bucket)
  file_type text,                              -- 'text' | 'pdf' | 'docx'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notes_class_id on notes(class_id);
create index if not exists idx_notes_user_id on notes(user_id);

-- Quizzes (generated from notes)
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid references notes(id) on delete set null,
  title text not null,
  created_at timestamptz default now()
);

create index if not exists idx_quizzes_class_id on quizzes(class_id);
create index if not exists idx_quizzes_user_id on quizzes(user_id);

-- Questions (quiz questions - separate table for easier querying)
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question text not null,
  type text not null,                          -- 'multiple_choice' | 'short_answer' | 'true_false'
  options jsonb,                               -- For multiple choice: ["A", "B", "C", "D"]
  correct_answer text not null,
  order_num int not null,                      -- Display order (1, 2, 3...)
  created_at timestamptz default now()
);

create index if not exists idx_questions_quiz_id on questions(quiz_id);

-- Quiz attempts (user answers + grading results)
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null,                      -- {question_id: user_answer}
  grading_results jsonb not null,              -- {question_id: {correct, concept, terminology, feedback}}
  score decimal(5,2),                          -- 0.00 - 100.00
  completed_at timestamptz default now()
);

create index if not exists idx_quiz_attempts_quiz_id on quiz_attempts(quiz_id);
create index if not exists idx_quiz_attempts_user_id on quiz_attempts(user_id);

-- ===========================================
-- 3. ENTITLEMENTS (Billing & Access Control)
-- ===========================================

create table if not exists entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan plan_type not null default 'free',

  -- Stripe fields (null for free tier)
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,                    -- 'active' | 'past_due' | 'canceled' | null
  current_period_end timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_entitlements_plan on entitlements(plan);
create index if not exists idx_entitlements_stripe_customer on entitlements(stripe_customer_id);

-- ===========================================
-- 4. RLS POLICIES
-- ===========================================

alter table classes enable row level security;
alter table notes enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table quiz_attempts enable row level security;
alter table entitlements enable row level security;

-- Classes
drop policy if exists "users_manage_classes" on classes;
create policy "users_manage_classes" on classes
  for all using (auth.uid() = user_id);

-- Notes
drop policy if exists "users_manage_notes" on notes;
create policy "users_manage_notes" on notes
  for all using (auth.uid() = user_id);

-- Quizzes
drop policy if exists "users_manage_quizzes" on quizzes;
create policy "users_manage_quizzes" on quizzes
  for all using (auth.uid() = user_id);

-- Questions (read-only via quiz ownership)
drop policy if exists "users_read_questions" on questions;
create policy "users_read_questions" on questions
  for select using (
    exists (
      select 1 from quizzes
      where quizzes.id = questions.quiz_id
      and quizzes.user_id = auth.uid()
    )
  );

-- Quiz attempts
drop policy if exists "users_manage_attempts" on quiz_attempts;
create policy "users_manage_attempts" on quiz_attempts
  for all using (auth.uid() = user_id);

-- Entitlements (users can read their own, server can manage)
drop policy if exists "users_read_entitlements" on entitlements;
create policy "users_read_entitlements" on entitlements
  for select using (auth.uid() = user_id);

drop policy if exists "service_role_manage_entitlements" on entitlements;
create policy "service_role_manage_entitlements" on entitlements
  for all using (auth.role() = 'service_role');

-- ===========================================
-- 5. STORAGE BUCKET & POLICIES
-- ===========================================

-- Create storage bucket (run in Supabase dashboard or via SQL)
insert into storage.buckets (id, name, public)
values ('notes-files', 'notes-files', false)
on conflict (id) do nothing;

-- Storage RLS policies
drop policy if exists "users_upload_notes" on storage.objects;
create policy "users_upload_notes" on storage.objects
  for insert with check (
    bucket_id = 'notes-files' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users_read_own_notes" on storage.objects;
create policy "users_read_own_notes" on storage.objects
  for select using (
    bucket_id = 'notes-files' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users_delete_own_notes" on storage.objects;
create policy "users_delete_own_notes" on storage.objects
  for delete using (
    bucket_id = 'notes-files' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ===========================================
-- 6. HELPER FUNCTIONS (Optional but useful)
-- ===========================================

-- Auto-create entitlement row for new users
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into entitlements (user_id, plan)
  values (new.id, 'free');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===========================================
-- 7. VIEWS (For easier querying)
-- ===========================================

-- User's class summary with quiz counts
drop view if exists v_class_summary;
create view v_class_summary as
select
  c.id,
  c.user_id,
  c.name,
  c.description,
  c.created_at,
  count(distinct n.id) as note_count,
  count(distinct q.id) as quiz_count,
  count(distinct qa.id) as attempt_count
from classes c
left join notes n on n.class_id = c.id
left join quizzes q on q.class_id = c.id
left join quiz_attempts qa on qa.quiz_id = q.id
group by c.id;

commit;

-- ===========================================
-- USAGE NOTES
-- ===========================================

-- Free tier enforcement (in API routes):
--
-- const { count: classCount } = await supabase
--   .from('classes')
--   .select('*', { count: 'exact', head: true })
--   .eq('user_id', userId)
--
-- const canCreate = classCount < 1 || entitlement.plan === 'pro'
--
-- Similar for quiz attempts (limit: 5 for free tier)

-- Storage path format:
-- {user_id}/{uuid}-{filename}
-- Example: 550e8400-e29b-41d4-a716-446655440000/abc123-chapter5.pdf

-- Stripe webhook updates entitlements table:
-- checkout.session.completed → plan = 'pro'
-- customer.subscription.deleted → plan = 'free'
