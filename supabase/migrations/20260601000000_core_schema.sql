-- Non-destructive View2Connect core schema baseline.
-- This migration intentionally contains no demo accounts, passwords, or data resets.

create extension if not exists pgcrypto;

create table if not exists public.estates (
  id text primary key,
  name text not null,
  city text not null,
  residents integer not null default 0,
  businesses_live integer not null default 0,
  average_response_time text not null default '',
  clusters text[] not null default '{}',
  amenities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.estates (id, name, city)
values ('river-park', 'View2Connect Marketplace', 'Abuja')
on conflict (id) do nothing;

create table if not exists public.admin_users (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  password_hash text,
  role text not null check (role in ('owner', 'customerCare')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id text primary key,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  email text not null,
  auth_email text unique,
  phone_number text not null,
  password_hash text,
  role text not null check (role in ('resident', 'businessOwner', 'dispatch')),
  estate_id text not null references public.estates(id) on delete restrict,
  business_name text,
  business_cluster text,
  river_park_verified boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_email_role_unique
  on public.app_users (lower(email), role);
create unique index if not exists app_users_phone_role_unique
  on public.app_users (lower(phone_number), role);

create table if not exists public.payment_plans (
  cycle text primary key check (cycle in ('weekly', 'monthly')),
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  description text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.security_settings (
  id text primary key default 'default',
  allow_resident_signups boolean not null default true,
  allow_business_owner_signups boolean not null default true,
  maintenance_mode boolean not null default false,
  block_checkout boolean not null default false,
  require_manual_listing_approval boolean not null default true,
  session_timeout_minutes integer not null default 30,
  max_login_attempts integer not null default 5,
  login_announcement_enabled boolean not null default true,
  login_announcement_title text not null default 'Welcome to View2Connect',
  login_announcement_body text not null default 'Marketplace updates and account notices appear in notifications.',
  updated_at timestamptz not null default now()
);

insert into public.security_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.owner_business_profiles (
  id text primary key,
  owner_user_id text not null references public.app_users(id) on delete cascade,
  account_name text not null,
  account_email text not null,
  owner_name text not null,
  phone text not null,
  whatsapp text,
  email text not null,
  website text,
  instagram text,
  address text not null,
  cover_image text,
  gallery_images text,
  gallery_videos text,
  subscription_cycle text check (subscription_cycle in ('weekly', 'monthly')),
  subscription_status text check (subscription_status in ('pending', 'paid', 'active')),
  verified_amount numeric(12, 2),
  subscription_paid_at timestamptz,
  subscription_next_billing_at timestamptz,
  subscription_item_count integer,
  river_park_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists owner_business_profiles_owner_user_unique
  on public.owner_business_profiles (owner_user_id);

create table if not exists public.businesses (
  id text primary key,
  estate_id text not null references public.estates(id) on delete restrict,
  listing_type text not null check (listing_type in ('product', 'profession')),
  status text not null default 'active' check (status in ('active', 'archived')),
  subscription_cycle text check (subscription_cycle in ('weekly', 'monthly')),
  subscription_status text check (subscription_status in ('pending', 'paid', 'active')),
  verified_amount numeric(12, 2),
  subscription_paid_at timestamptz,
  subscription_next_billing_at timestamptz,
  subscription_item_count integer,
  name text not null,
  owner_name text not null,
  owner_user_id text references public.app_users(id) on delete set null,
  owner_email text,
  cluster text not null,
  category text not null,
  description text not null,
  long_description text not null,
  image_url text not null,
  media jsonb not null default '[]'::jsonb,
  address text not null,
  sku text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  price numeric(12, 2) not null default 0 check (price >= 0),
  price_label text,
  response_time text not null,
  verified boolean not null default false,
  river_park_verified boolean not null default false,
  services text[] not null default '{}',
  tags text[] not null default '{}',
  contact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_payments (
  id text primary key,
  reference text not null unique,
  owner_user_id text not null references public.app_users(id) on delete cascade,
  owner_name text not null,
  owner_email text not null,
  cycle text not null check (cycle in ('weekly', 'monthly')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  checkout_url text,
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  user_email text,
  user_name text not null,
  estate_id text not null references public.estates(id) on delete restrict,
  delivery_address text not null,
  delivery_cluster text not null,
  note text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  service_fee numeric(12, 2) not null default 0 check (service_fee >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  payment_method text not null check (payment_method in ('walletAccount', 'flutterwave', 'bankTransfer', 'cashOnDelivery')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
  status text not null default 'placed' check (status in ('placed', 'packed', 'outForDelivery', 'delivered', 'cancelled')),
  expected_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigserial primary key,
  order_id text not null references public.orders(id) on delete cascade,
  business_id text not null references public.businesses(id) on delete restrict,
  business_name text not null,
  owner_name text not null,
  owner_user_id text references public.app_users(id) on delete set null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(12, 2) not null default 0 check (line_total >= 0)
);

create table if not exists public.order_timeline_events (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  status text not null check (status in ('placed', 'packed', 'outForDelivery', 'delivered', 'cancelled')),
  label text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id text primary key,
  order_id text,
  business_id text,
  recipient_type text not null check (recipient_type in ('buyer', 'owner', 'admin', 'customerCare')),
  recipient_name text not null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null check (status in ('queued', 'sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.support_messages (
  id text primary key,
  conversation_id text not null,
  user_id text not null,
  user_name text not null,
  user_role text not null check (user_role in ('resident', 'businessOwner', 'dispatch')),
  sender_name text not null,
  sender_role text not null check (sender_role in ('resident', 'businessOwner', 'dispatch', 'customerCare', 'owner', 'system')),
  text text not null,
  context_type text check (context_type in ('order', 'listing', 'general')),
  context_id text,
  context_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null,
  user_name text not null,
  audience text not null check (audience in ('resident', 'businessOwner', 'dispatch')),
  title text not null,
  body text not null,
  context_type text check (context_type in ('order', 'listing', 'general')),
  context_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_id uuid,
  actor_name text not null,
  actor_role text not null check (actor_role in ('system', 'owner', 'customerCare')),
  action text not null,
  details text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id text primary key,
  owner_user_id text not null references public.app_users(id) on delete cascade,
  owner_name text not null,
  owner_email text not null,
  bank_name text not null,
  account_number text not null,
  account_name text,
  kyc_type text not null default 'bvn' check (kyc_type in ('bvn', 'nin')),
  kyc_last4 text not null default '0000',
  kyc_reference text not null default 'BVN ending 0000',
  amount numeric(12, 2) not null default 0 check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.virtual_accounts (
  id text primary key,
  owner_user_id text not null references public.app_users(id) on delete cascade,
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
