-- Align squash to context_v2.1: storage policies, usage_limits column name, subscriptions default, question key rename

-- 1) STORAGE: ensure private bucket 'notes-files' + RLS by owner prefix
insert into storage.buckets (id, name, public)
values ('notes-files','notes-files', false)
on conflict (id) do nothing;

-- Allow owners to manage their own files (path starts with "<uid>/")
do $do$
begin
  -- Read
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='notes-files read own'
  ) then
    create policy "notes-files read own"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'notes-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;

  -- Write (insert)
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='notes-files write own'
  ) then
    create policy "notes-files write own"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'notes-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;

  -- Update
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='notes-files update own'
  ) then
    create policy "notes-files update own"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'notes-files' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'notes-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;

  -- Delete
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='notes-files delete own'
  ) then
    create policy "notes-files delete own"
    on storage.objects
    for delete
    to authenticated
    using (bucket_id = 'notes-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end
$do$;

-- 2) usage_limits: ensure 'quizzes_created' exists; prefer rename when only quizzes_taken exists
do $do$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='usage_limits' and column_name='quizzes_taken'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='usage_limits' and column_name='quizzes_created'
  ) then
    alter table public.usage_limits rename column quizzes_taken to quizzes_created;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='usage_limits' and column_name='quizzes_created'
  ) then
    alter table public.usage_limits add column quizzes_created int not null default 0;
  end if;
end
$do$;

-- 3) subscriptions default status should be 'inactive' until checkout/webhook sets active
do $do$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscriptions' and column_name='status'
  ) then
    alter table public.subscriptions alter column status set default 'inactive';
    -- normalize existing free rows to inactive (paid stays active)
    update public.subscriptions
      set status = case when tier = 'free' then 'inactive' else status end;
  end if;
end
$do$;

-- 4) Normalize questions json: 'answer_key' -> 'answer'
-- For each row: map each array element { ... , "answer_key": X } => { ..., "answer": X } (remove answer_key)
update public.quizzes
set questions = (
  select jsonb_agg(
           (elem - 'answer_key') || jsonb_build_object('answer', elem->'answer_key')
         )
  from jsonb_array_elements(coalesce(public.quizzes.questions, '[]'::jsonb)) as elem
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(public.quizzes.questions, '[]'::jsonb)) as e
  where e ? 'answer_key'
);

-- Done.
