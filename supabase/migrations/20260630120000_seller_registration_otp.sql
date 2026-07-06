create extension if not exists pgcrypto;

create table if not exists public.seller_signup_verifications (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  requested_at timestamptz not null default now()
);

alter table public.seller_signup_verifications enable row level security;
revoke all on public.seller_signup_verifications from anon, authenticated;

create table if not exists public.seller_applications (
  id text primary key default gen_random_uuid()::text,
  auth_user_id text not null,
  profile_user_id text not null references public.app_users(id) on delete cascade,
  email text not null,
  owner_name text not null,
  phone text not null,
  seller_type text not null check (seller_type in ('individual', 'store')),
  business_name text not null,
  business_type text,
  area text not null,
  address text not null,
  cac_number text,
  pos_system text,
  catalog_status text,
  notes text not null,
  selected_plan text not null check (selected_plan in ('free', 'gold')),
  plan_amount numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_applications_email_idx
  on public.seller_applications (lower(email), created_at desc);

alter table public.seller_applications enable row level security;
revoke all on public.seller_applications from anon, authenticated;
