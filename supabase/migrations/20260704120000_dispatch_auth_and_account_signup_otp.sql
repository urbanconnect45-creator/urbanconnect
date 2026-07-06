create extension if not exists pgcrypto;

create table if not exists public.account_signup_verifications (
  email text primary key,
  role text not null check (role in ('resident', 'businessOwner', 'dispatch')),
  code_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  requested_at timestamptz not null default now()
);

alter table public.account_signup_verifications enable row level security;
revoke all on public.account_signup_verifications from anon, authenticated;

do $$
declare
  constraint_record record;
begin
  if to_regclass('public.app_users') is not null then
    for constraint_record in
      select conname
      from pg_constraint
      where conrelid = 'public.app_users'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
    loop
      execute format('alter table public.app_users drop constraint %I', constraint_record.conname);
    end loop;

    alter table public.app_users
      add constraint app_users_role_check
      check (role in ('resident', 'businessOwner', 'dispatch'));
  end if;
end $$;

do $$
declare
  constraint_record record;
begin
  if to_regclass('public.dynamic_deposit_accounts') is not null then
    for constraint_record in
      select conname
      from pg_constraint
      where conrelid = 'public.dynamic_deposit_accounts'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%user_role%'
    loop
      execute format(
        'alter table public.dynamic_deposit_accounts drop constraint %I',
        constraint_record.conname
      );
    end loop;

    alter table public.dynamic_deposit_accounts
      add constraint dynamic_deposit_accounts_user_role_check
      check (user_role in ('resident', 'businessOwner', 'dispatch'));
  end if;
end $$;

do $$
begin
  if to_regclass('public.email_logs') is not null then
    alter table public.email_logs
      drop constraint if exists email_logs_recipient_type_check;

    alter table public.email_logs
      add constraint email_logs_recipient_type_check
      check (recipient_type in ('buyer', 'owner', 'dispatch', 'admin', 'customerCare'));
  end if;
end $$;
