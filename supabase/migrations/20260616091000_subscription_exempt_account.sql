alter table public.security_settings
  add column if not exists subscription_exempt_account_email text not null default 'owner.admin@urbanconnect.com';
