-- UrbanConnect listing media storage setup
-- Run this once in the Supabase SQL Editor so listing photos/videos can be
-- uploaded to public Supabase Storage URLs that admin can view.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'urbanconnect-listing-media',
  'urbanconnect-listing-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "UrbanConnect listing media public read" on storage.objects;
create policy "UrbanConnect listing media public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'urbanconnect-listing-media');

drop policy if exists "UrbanConnect listing media upload" on storage.objects;
create policy "UrbanConnect listing media upload"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'urbanconnect-listing-media');

drop policy if exists "UrbanConnect listing media update" on storage.objects;
create policy "UrbanConnect listing media update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'urbanconnect-listing-media')
with check (bucket_id = 'urbanconnect-listing-media');

commit;
