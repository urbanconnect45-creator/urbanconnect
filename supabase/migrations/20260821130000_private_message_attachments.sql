insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'urbanconnect-message-attachments',
  'urbanconnect-message-attachments',
  false,
  31457280,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'text/plain'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists view2connect_message_attachment_insert on storage.objects;
create policy view2connect_message_attachment_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'urbanconnect-message-attachments'
  and (storage.foldername(name))[1] = 'chat-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(storage.extension(name)) in (
    'jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'
  )
);

drop policy if exists view2connect_message_attachment_read on storage.objects;
create policy view2connect_message_attachment_read on storage.objects
for select to authenticated
using (
  bucket_id = 'urbanconnect-message-attachments'
  and (
    owner_id = auth.uid()::text
    or public.is_view2connect_staff()
    or exists (
      select 1
      from public.listing_messages message
      where message.id = (storage.foldername(name))[3]
        and (
          message.sender_user_id = auth.uid()::text
          or message.recipient_user_id = auth.uid()::text
        )
    )
    or exists (
      select 1
      from public.support_messages message
      where message.id = (storage.foldername(name))[3]
        and message.user_id = auth.uid()::text
    )
  )
);

drop policy if exists view2connect_message_attachment_update on storage.objects;
create policy view2connect_message_attachment_update on storage.objects
for update to authenticated
using (
  bucket_id = 'urbanconnect-message-attachments'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'urbanconnect-message-attachments'
  and owner_id = auth.uid()::text
);

drop policy if exists view2connect_message_attachment_delete on storage.objects;
create policy view2connect_message_attachment_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'urbanconnect-message-attachments'
  and owner_id = auth.uid()::text
);
