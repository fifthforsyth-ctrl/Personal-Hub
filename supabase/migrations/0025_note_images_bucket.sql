-- Images for quote cards.
--
-- Private, not public: these are personal, and a public bucket means anyone
-- holding the URL can read it forever. The app hands out short-lived signed
-- URLs instead, which is why study_notes stores the object PATH and never a
-- URL — a persisted URL would be a link that quietly stops working.
--
-- Objects are namespaced by user id as the first path segment, and the
-- policies below enforce that, so one account can never read or write into
-- another's folder even though they share the bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-images',
  'note-images',
  false,
  8388608, -- 8 MB; a phone photo comfortably fits, a video does not
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

drop policy if exists "own note images read" on storage.objects;
drop policy if exists "own note images insert" on storage.objects;
drop policy if exists "own note images update" on storage.objects;
drop policy if exists "own note images delete" on storage.objects;

create policy "own note images read" on storage.objects
  for select using (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own note images insert" on storage.objects
  for insert with check (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own note images update" on storage.objects
  for update using (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own note images delete" on storage.objects
  for delete using (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
