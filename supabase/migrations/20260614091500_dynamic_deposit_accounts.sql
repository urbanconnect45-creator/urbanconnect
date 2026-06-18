create table if not exists public.dynamic_deposit_accounts (
  id text primary key,
  reference text not null unique,
  user_id text not null,
  user_name text not null,
  user_email text not null,
  user_role text not null check (user_role in ('resident', 'businessOwner')),
  provider text not null default 'flutterwave' check (provider in ('flutterwave')),
  provider_reference text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  expires_at timestamptz,
  paid_at timestamptz,
  provider_charge_id text,
  failure_reason text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dynamic_deposit_accounts enable row level security;

drop policy if exists "Allow public dynamic deposit reads" on public.dynamic_deposit_accounts;
create policy "Allow public dynamic deposit reads"
  on public.dynamic_deposit_accounts for select
  using (true);

drop policy if exists "Allow public dynamic deposit upserts" on public.dynamic_deposit_accounts;
create policy "Allow public dynamic deposit upserts"
  on public.dynamic_deposit_accounts for insert
  with check (true);

drop policy if exists "Allow public dynamic deposit updates" on public.dynamic_deposit_accounts;
create policy "Allow public dynamic deposit updates"
  on public.dynamic_deposit_accounts for update
  using (true)
  with check (true);
