create table if not exists public.customer_cart_items (
  user_id text not null references public.app_users(id) on delete cascade,
  business_id text not null references public.businesses(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

create index if not exists customer_cart_items_user_updated_idx
  on public.customer_cart_items (user_id, updated_at desc);

create table if not exists public.customer_delivery_locations (
  user_id text primary key references public.app_users(id) on delete cascade,
  formatted_address text not null,
  country text,
  state_region text,
  city text,
  area_district text,
  street_name text,
  building_info text,
  landmark text,
  latitude double precision,
  longitude double precision,
  additional_instructions text,
  place_id text,
  source text not null default 'manual'
    check (source in ('manual', 'search', 'gps', 'pin')),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_messages (
  id text primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  sender_user_id text references public.app_users(id) on delete set null,
  recipient_user_id text references public.app_users(id) on delete set null,
  sender_name text not null,
  sender_type text not null check (sender_type in ('resident', 'owner')),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists listing_messages_business_created_idx
  on public.listing_messages (business_id, created_at asc);

create index if not exists listing_messages_sender_recipient_idx
  on public.listing_messages (sender_user_id, recipient_user_id, created_at desc);

alter table public.orders
  add column if not exists delivery_country text,
  add column if not exists delivery_state_region text,
  add column if not exists delivery_city text,
  add column if not exists delivery_area_district text,
  add column if not exists delivery_street_name text,
  add column if not exists delivery_building_info text,
  add column if not exists delivery_landmark text,
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision,
  add column if not exists delivery_place_id text,
  add column if not exists delivery_location_source text
    check (delivery_location_source in ('manual', 'search', 'gps', 'pin')),
  add column if not exists delivery_instructions text;
