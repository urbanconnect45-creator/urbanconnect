-- UrbanConnect wallet order and warehouse verification migration
-- Run this in the Supabase SQL Editor before relying on remote order persistence.

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('walletAccount', 'flutterwave', 'bankTransfer', 'cashOnDelivery'));

alter table public.orders
  drop constraint if exists orders_status_check;

update public.orders
set status = case
  when status = 'confirmed' then 'packed'
  when status = 'warehouseVerified' then 'outForDelivery'
  else status
end
where status in ('confirmed', 'warehouseVerified');

alter table public.orders
  add constraint orders_status_check
  check (status in ('placed', 'packed', 'outForDelivery', 'delivered', 'cancelled'));

alter table public.order_timeline_events
  drop constraint if exists order_timeline_events_status_check;

update public.order_timeline_events
set status = case
  when status = 'confirmed' then 'packed'
  when status = 'warehouseVerified' then 'outForDelivery'
  else status
end
where status in ('confirmed', 'warehouseVerified');

alter table public.order_timeline_events
  add constraint order_timeline_events_status_check
  check (status in ('placed', 'packed', 'outForDelivery', 'delivered', 'cancelled'));

create table if not exists public.withdrawal_requests (
  id text primary key,
  owner_user_id text not null,
  owner_name text not null,
  owner_email text not null,
  bank_name text not null,
  account_number text not null,
  account_name text,
  kyc_type text not null default 'bvn' check (kyc_type in ('bvn', 'nin')),
  kyc_last4 text not null default '0000',
  kyc_reference text not null default 'BVN ending 0000',
  amount numeric(12, 2) not null default 0,
  status text not null default 'paid' check (status in ('paid')),
  created_at timestamptz not null default now()
);

alter table public.withdrawal_requests
  add column if not exists kyc_type text not null default 'bvn',
  add column if not exists kyc_last4 text not null default '0000',
  add column if not exists kyc_reference text not null default 'BVN ending 0000';

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_kyc_type_check;

alter table public.withdrawal_requests
  add constraint withdrawal_requests_kyc_type_check
  check (kyc_type in ('bvn', 'nin'));

alter table public.withdrawal_requests enable row level security;

drop policy if exists "Allow public withdrawal request reads" on public.withdrawal_requests;
create policy "Allow public withdrawal request reads"
  on public.withdrawal_requests for select
  using (true);

drop policy if exists "Allow public withdrawal request writes" on public.withdrawal_requests;
create policy "Allow public withdrawal request writes"
  on public.withdrawal_requests for insert
  with check (true);

create table if not exists public.virtual_accounts (
  id text primary key,
  owner_user_id text not null,
  owner_name text not null,
  owner_email text not null,
  provider text not null default 'flutterwave' check (provider in ('flutterwave')),
  provider_reference text not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  kyc_type text check (kyc_type in ('bvn', 'nin')),
  kyc_last4 text,
  kyc_reference text,
  status text not null default 'depositReady' check (status in ('depositReady', 'verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.virtual_accounts
  alter column kyc_type drop not null,
  alter column kyc_last4 drop not null,
  alter column kyc_reference drop not null,
  alter column status set default 'depositReady';

alter table public.virtual_accounts
  drop constraint if exists virtual_accounts_status_check;

alter table public.virtual_accounts
  add constraint virtual_accounts_status_check
  check (status in ('depositReady', 'verified'));

alter table public.virtual_accounts
  drop constraint if exists virtual_accounts_kyc_type_check;

alter table public.virtual_accounts
  add constraint virtual_accounts_kyc_type_check
  check (kyc_type in ('bvn', 'nin') or kyc_type is null);

alter table public.virtual_accounts enable row level security;

drop policy if exists "Allow public virtual account reads" on public.virtual_accounts;
create policy "Allow public virtual account reads"
  on public.virtual_accounts for select
  using (true);

drop policy if exists "Allow public virtual account upserts" on public.virtual_accounts;
create policy "Allow public virtual account upserts"
  on public.virtual_accounts for insert
  with check (true);

drop policy if exists "Allow public virtual account updates" on public.virtual_accounts;
create policy "Allow public virtual account updates"
  on public.virtual_accounts for update
  using (true)
  with check (true);

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
