-- ===== Data quality guards =====

-- 1) quiz_attempts.score must be 0..1
alter table quiz_attempts
  add constraint quiz_attempts_score_0_1
  check (score is null or (score >= 0 and score <= 1));

-- 2) questions: enforce kind-dependent fields
-- MCQ must have options; SHORT must not have options (keeps JSON shape sane)
alter table questions
  add constraint questions_kind_options_guard
  check (
    (kind = 'mcq'   and options is not null)
    or
    (kind = 'short' and options is null)
  );

-- 3) quizzes.meta defaults to empty object for convenience
alter table quizzes
  alter column meta set default '{}'::jsonb;

-- ===== Helpful indexes (FKs + common filters) =====

create index if not exists idx_notes_class     on notes(class_id);
create index if not exists idx_quizzes_class   on quizzes(class_id);
create index if not exists idx_quizzes_notes   on quizzes(notes_id);
create index if not exists idx_questions_kind  on questions(kind);
-- Often used in dashboards / recent views
create index if not exists idx_quizzes_user_created on quizzes(user_id, created_at desc);
create index if not exists idx_notes_user_created   on notes(user_id, created_at desc);

-- (Optional) discourage duplicate class names per user
-- uncomment if you want per-user unique class names:
-- alter table classes add constraint classes_unique_per_user UNIQUE (user_id, name);

-- ===== Keep entitlements.updated_at in sync =====

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_entitlements_updated_at on entitlements;
create trigger trg_entitlements_updated_at
before update on entitlements
for each row execute function set_updated_at();
