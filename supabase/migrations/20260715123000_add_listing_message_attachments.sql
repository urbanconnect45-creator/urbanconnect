alter table public.listing_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.listing_messages
  drop constraint if exists listing_messages_attachments_array_check;

alter table public.listing_messages
  add constraint listing_messages_attachments_array_check
  check (jsonb_typeof(attachments) = 'array');

alter table public.support_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.support_messages
  drop constraint if exists support_messages_attachments_array_check;

alter table public.support_messages
  add constraint support_messages_attachments_array_check
  check (jsonb_typeof(attachments) = 'array');
