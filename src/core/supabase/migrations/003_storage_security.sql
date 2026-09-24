-- ============================================================
-- SURPRIZYY
-- Migration 003 — Private Storage Security
-- ============================================================

-- Allow authenticated users to manage files belonging
-- to surprises they are authorized to access.

create policy "Authenticated users can upload surprise media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'surprise-media'
);


create policy "Authenticated users can read surprise media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'surprise-media'
);


create policy "Authenticated users can update surprise media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'surprise-media'
)
with check (
  bucket_id = 'surprise-media'
);


create policy "Authenticated users can delete surprise media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'surprise-media'
);