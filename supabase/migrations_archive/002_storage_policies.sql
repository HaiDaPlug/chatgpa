-- =========================================
-- Storage RLS for bucket 'notes-files'
-- Path convention: <user_id>/<uuid>-<original-name>
-- =========================================

-- Create bucket manually once in Dashboard or CLI:
--   Name: notes-files
--   Privacy: Private

-- Policies on storage.objects (RLS is enabled by default there)
create policy if not exists "notes-files read own"
on storage.objects
for select
using (
  bucket_id = 'notes-files'
  and name like auth.uid()::text || '/%'
);

create policy if not exists "notes-files write own"
on storage.objects
for insert
with check (
  bucket_id = 'notes-files'
  and name like auth.uid()::text || '/%'
);

create policy if not exists "notes-files update own"
on storage.objects
for update
using (
  bucket_id = 'notes-files'
  and name like auth.uid()::text || '/%'
)
with check (
  bucket_id = 'notes-files'
  and name like auth.uid()::text || '/%'
);

create policy if not exists "notes-files delete own"
on storage.objects
for delete
using (
  bucket_id = 'notes-files'
  and name like auth.uid()::text || '/%'
);
