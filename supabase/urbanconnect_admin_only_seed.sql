-- UrbanConnect admin-only Supabase seed/reset
-- Run this in the Supabase SQL Editor. It keeps the two admin accounts and
-- clears customer, seller, listing, order, chat, email, and notification data.

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

create table if not exists public.admin_users (
  id text primary key,
  full_name text not null,
  email text not null unique,
  password_hash text not null,
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
  email text not null unique,
  phone_number text not null unique,
  password_hash text not null default 'supabase-auth-managed',
  role text not null check (role in ('resident', 'businessOwner')),
  estate_id text not null references public.estates(id) on delete restrict,
  business_name text,
  business_cluster text,
  river_park_verified boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users alter column password_hash set default 'supabase-auth-managed';
alter table public.app_users alter column password_hash drop not null;

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
  login_announcement_title text not null default 'Welcome to UrbanConnect',
  login_announcement_body text not null default 'River Park marketplace updates, verification notices, and customer care messages will appear in your notifications.',
  subscription_exempt_account_email text not null default 'owner.admin@urbanconnect.com',
  updated_at timestamptz not null default now()
);

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
  stock_quantity integer not null default 0,
  reorder_level integer not null default 0,
  price numeric(12, 2) not null default 0,
  price_label text,
  response_time text not null,
  verified boolean not null default false,
  river_park_verified boolean not null default false,
  services text[] not null default '{}',
  tags text[] not null default '{}',
  contact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
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
  subtotal numeric(12, 2) not null default 0,
  service_fee numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
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
  business_id text not null,
  business_name text not null,
  owner_name text not null,
  owner_user_id text,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0
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
  user_role text not null check (user_role in ('resident', 'businessOwner')),
  sender_name text not null,
  sender_role text not null check (sender_role in ('resident', 'businessOwner', 'customerCare', 'owner', 'system')),
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
  audience text not null check (audience in ('resident', 'businessOwner')),
  title text not null,
  body text not null,
  context_type text check (context_type in ('order', 'listing', 'general')),
  context_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_name text not null,
  actor_role text not null check (actor_role in ('system', 'owner', 'customerCare')),
  action text not null,
  details text not null,
  created_at timestamptz not null default now()
);

truncate table
  public.notifications,
  public.support_messages,
  public.email_logs,
  public.subscription_payments,
  public.order_timeline_events,
  public.order_items,
  public.orders,
  public.businesses,
  public.owner_business_profiles,
  public.app_users,
  public.audit_logs
restart identity cascade;

delete from public.admin_users
where id not in ('admin-owner', 'admin-customer-care');

insert into public.estates (
  id,
  name,
  city,
  residents,
  businesses_live,
  average_response_time,
  clusters,
  amenities,
  updated_at
) values (
  'river-park',
  'River Park Estate',
  'Abuja',
  12680,
  0,
  '12 mins',
  array['Cluster 1', 'Cluster 3', 'Cluster 4', 'Cluster 5'],
  '[
    {
      "id": "amenity-clubhouse",
      "title": "Clubhouse and lounge",
      "description": "Resident gatherings, work-friendly seating, and small community events.",
      "icon": "business-outline"
    },
    {
      "id": "amenity-pool",
      "title": "Swimming pool",
      "description": "Family pool access with supervised maintenance windows every week.",
      "icon": "water-outline"
    },
    {
      "id": "amenity-gym",
      "title": "Fitness studio",
      "description": "Cardio, weights, and guided classes for River Park members.",
      "icon": "barbell-outline"
    },
    {
      "id": "amenity-parks",
      "title": "Parks and play areas",
      "description": "Open green spaces, children play corners, and shaded walking paths.",
      "icon": "leaf-outline"
    },
    {
      "id": "amenity-security",
      "title": "Gate and patrol security",
      "description": "Cluster gate control, resident verification, and evening patrol coverage.",
      "icon": "shield-checkmark-outline"
    }
  ]'::jsonb,
  now()
) on conflict (id) do update set
  name = excluded.name,
  city = excluded.city,
  residents = excluded.residents,
  businesses_live = excluded.businesses_live,
  average_response_time = excluded.average_response_time,
  clusters = excluded.clusters,
  amenities = excluded.amenities,
  updated_at = now();

insert into public.payment_plans (cycle, title, amount, description, updated_at) values
  (
    'weekly',
    'Weekly plan',
    4000,
    'Best for short promo bursts and small test listings.',
    '2026-05-19T08:00:00.000Z'
  ),
  (
    'monthly',
    'Monthly plan',
    15000,
    'Best for active sellers who want steady marketplace visibility.',
    '2026-05-19T08:00:00.000Z'
  )
on conflict (cycle) do update set
  title = excluded.title,
  amount = excluded.amount,
  description = excluded.description,
  updated_at = excluded.updated_at;

insert into public.security_settings (
  id,
  allow_resident_signups,
  allow_business_owner_signups,
  maintenance_mode,
  block_checkout,
  require_manual_listing_approval,
  session_timeout_minutes,
  max_login_attempts,
  login_announcement_enabled,
  login_announcement_title,
  login_announcement_body,
  subscription_exempt_account_email,
  updated_at
) values (
  'default',
  true,
  true,
  false,
  false,
  true,
  30,
  5,
  true,
  'Welcome to UrbanConnect',
  'River Park marketplace updates, verification notices, and customer care messages will appear in your notifications.',
  'owner.admin@urbanconnect.com',
  now()
) on conflict (id) do update set
  allow_resident_signups = excluded.allow_resident_signups,
  allow_business_owner_signups = excluded.allow_business_owner_signups,
  maintenance_mode = excluded.maintenance_mode,
  block_checkout = excluded.block_checkout,
  require_manual_listing_approval = excluded.require_manual_listing_approval,
  login_announcement_enabled = excluded.login_announcement_enabled,
  login_announcement_title = excluded.login_announcement_title,
  login_announcement_body = excluded.login_announcement_body,
  subscription_exempt_account_email = excluded.subscription_exempt_account_email,
  session_timeout_minutes = excluded.session_timeout_minutes,
  max_login_attempts = excluded.max_login_attempts,
  updated_at = now();

insert into public.admin_users (
  id,
  full_name,
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
) values
  (
    'admin-owner',
    'UrbanConnect Owner',
    'owner.admin@urbanconnect.com',
    crypt('password123', gen_salt('bf')),
    'owner',
    true,
    '2026-05-09T08:00:00.000Z',
    now()
  ),
  (
    'admin-customer-care',
    'UrbanConnect Customer Care',
    'care.admin@urbanconnect.com',
    crypt('password123', gen_salt('bf')),
    'customerCare',
    true,
    '2026-05-09T08:15:00.000Z',
    now()
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  password_hash = excluded.password_hash,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.audit_logs (
  id,
  actor_name,
  actor_role,
  action,
  details,
  created_at
) values (
  'audit-admin-only-reset',
  'System',
  'system',
  'Admin-only seed loaded',
  'Customer, seller, listing, order, support, email, and notification demo data was cleared. Admin accounts remain active.',
  now()
);

create or replace function public.verify_admin_login(
  admin_email text,
  admin_password text
)
returns table (
  id text,
  full_name text,
  email text,
  role text,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    admin_users.id,
    admin_users.full_name,
    admin_users.email,
    admin_users.role,
    admin_users.is_active,
    admin_users.created_at
  from public.admin_users
  where lower(admin_users.email) = lower(admin_email)
    and admin_users.password_hash = crypt(admin_password, admin_users.password_hash)
  limit 1;
$$;

grant execute on function public.verify_admin_login(text, text) to anon, authenticated;

create or replace function public.set_river_park_verification(
  target_user_id text,
  verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user public.app_users%rowtype;
begin
  select *
  into target_user
  from public.app_users
  where id = target_user_id
  limit 1;

  update public.app_users
  set
    river_park_verified = verified,
    updated_at = now()
  where id = target_user_id;

  update public.owner_business_profiles
  set
    river_park_verified = verified,
    updated_at = now()
  where owner_user_id = target_user_id
    or (
      target_user.email is not null
      and lower(account_email) = lower(target_user.email)
    )
    or (
      target_user.email is not null
      and lower(email) = lower(target_user.email)
    )
    or (
      target_user.full_name is not null
      and lower(account_name) = lower(target_user.full_name)
    )
    or (
      target_user.full_name is not null
      and lower(owner_name) = lower(target_user.full_name)
    );

  update public.businesses
  set
    river_park_verified = verified,
    updated_at = now()
  where owner_user_id = target_user_id
    or (
      target_user.email is not null
      and lower(owner_email) = lower(target_user.email)
    )
    or (
      target_user.full_name is not null
      and lower(owner_name) = lower(target_user.full_name)
    )
    or (
      target_user.business_name is not null
      and lower(owner_name) = lower(target_user.business_name)
    );
end;
$$;

grant execute on function public.set_river_park_verification(text, boolean) to anon, authenticated;

create or replace function public.delete_support_conversation(
  target_conversation_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.support_messages
  where conversation_id = target_conversation_id;
$$;

grant execute on function public.delete_support_conversation(text) to anon, authenticated;

create or replace function public.delete_business_listing(
  target_business_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.businesses
  where id = target_business_id;
$$;

grant execute on function public.delete_business_listing(text) to anon, authenticated;

commit;
