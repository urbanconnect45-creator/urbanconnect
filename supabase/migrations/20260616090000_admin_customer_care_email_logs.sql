alter table public.email_logs
  drop constraint if exists email_logs_recipient_type_check;

alter table public.email_logs
  add constraint email_logs_recipient_type_check
  check (recipient_type in ('buyer', 'owner', 'admin', 'customerCare'));
