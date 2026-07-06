create table if not exists public.rider_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone_number text not null,
  vehicle_type text,
  plate_number text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_jobs (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  seller_key text not null,
  seller_user_id text,
  seller_name text not null,
  seller_type text not null check (seller_type in ('storeOwner', 'individualSeller')),
  pickup_address text not null,
  delivery_address text not null,
  item_subtotal numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  status text not null default 'available'
    check (
      status in (
        'available',
        'accepted',
        'pickedUp',
        'awaitingBuyerConfirmation',
        'completed',
        'cancelled'
      )
    ),
  rider_user_id uuid references public.rider_profiles(auth_user_id) on delete set null,
  seller_release_status text not null default 'held'
    check (seller_release_status in ('held', 'available', 'payoutPending', 'paid')),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  rider_confirmed_at timestamptz,
  buyer_confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, seller_key)
);

create index if not exists delivery_jobs_rider_queue_idx
  on public.delivery_jobs (status, created_at);

create index if not exists delivery_jobs_rider_owner_idx
  on public.delivery_jobs (rider_user_id, status, updated_at desc);

alter table public.rider_profiles enable row level security;
alter table public.delivery_jobs enable row level security;

drop policy if exists "Riders can read their profile" on public.rider_profiles;
create policy "Riders can read their profile"
  on public.rider_profiles for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists "Riders can read delivery queue" on public.delivery_jobs;
create policy "Riders can read delivery queue"
  on public.delivery_jobs for select
  to authenticated
  using (
    status = 'available'
    or rider_user_id = auth.uid()
    or exists (
      select 1
      from public.orders
      where orders.id = delivery_jobs.order_id
        and orders.user_id = auth.uid()::text
    )
  );

create or replace function public.register_rider_profile(
  rider_full_name text,
  rider_phone_number text,
  rider_vehicle_type text default null,
  rider_plate_number text default null
)
returns public.rider_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.rider_profiles;
  rider_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if auth.uid() is null then
    raise exception 'Authenticated rider account required';
  end if;

  if trim(coalesce(rider_full_name, '')) = ''
    or trim(coalesce(rider_phone_number, '')) = ''
    or trim(rider_email) = '' then
    raise exception 'Rider name, email, and phone number are required';
  end if;

  insert into public.rider_profiles (
    auth_user_id,
    full_name,
    email,
    phone_number,
    vehicle_type,
    plate_number,
    status,
    created_at,
    updated_at
  ) values (
    auth.uid(),
    trim(rider_full_name),
    lower(trim(rider_email)),
    trim(rider_phone_number),
    nullif(trim(coalesce(rider_vehicle_type, '')), ''),
    nullif(trim(coalesce(rider_plate_number, '')), ''),
    'pending',
    now(),
    now()
  )
  on conflict (auth_user_id) do update
  set
    full_name = excluded.full_name,
    phone_number = excluded.phone_number,
    vehicle_type = excluded.vehicle_type,
    plate_number = excluded.plate_number,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.refresh_delivery_jobs(target_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.orders
    where orders.id = target_order_id
      and orders.payment_status = 'paid'
      and orders.status <> 'cancelled'
  ) then
    return;
  end if;

  insert into public.delivery_jobs (
    id,
    order_id,
    seller_key,
    seller_user_id,
    seller_name,
    seller_type,
    pickup_address,
    delivery_address,
    item_subtotal,
    delivery_fee,
    seller_release_status,
    created_at,
    updated_at
  )
  select
    'delivery-' || target_order_id || '-' ||
      regexp_replace(
        lower(coalesce(items.owner_user_id, items.owner_name)),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
    target_order_id,
    coalesce(items.owner_user_id, items.owner_name),
    items.owner_user_id,
    items.owner_name,
    case
      when bool_or(coalesce('Individual seller' = any(businesses.tags), false))
        then 'individualSeller'
      else 'storeOwner'
    end,
    coalesce(
      nullif(min(businesses.address), ''),
      'Pickup address pending seller confirmation'
    ),
    orders.delivery_address,
    sum(items.line_total),
    orders.delivery_fee /
      nullif(count(*) over (partition by items.order_id), 0),
    case
      when bool_or(coalesce('Individual seller' = any(businesses.tags), false))
        then 'held'
      else 'available'
    end,
    now(),
    now()
  from public.order_items as items
  join public.orders as orders on orders.id = items.order_id
  left join public.businesses as businesses on businesses.id = items.business_id
  where items.order_id = target_order_id
  group by
    items.owner_user_id,
    items.owner_name,
    items.order_id,
    orders.delivery_address,
    orders.delivery_fee
  on conflict (order_id, seller_key) do update
  set
    pickup_address = excluded.pickup_address,
    delivery_address = excluded.delivery_address,
    item_subtotal = excluded.item_subtotal,
    delivery_fee = excluded.delivery_fee,
    updated_at = now();
end;
$$;

create or replace function public.refresh_delivery_jobs_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_delivery_jobs(new.order_id);
  return new;
end;
$$;

create or replace function public.refresh_delivery_jobs_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from new.payment_status then
    perform public.refresh_delivery_jobs(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_delivery_jobs_after_item on public.order_items;
create trigger refresh_delivery_jobs_after_item
after insert or update on public.order_items
for each row execute function public.refresh_delivery_jobs_from_item();

drop trigger if exists refresh_delivery_jobs_after_payment on public.orders;
create trigger refresh_delivery_jobs_after_payment
after update of payment_status on public.orders
for each row execute function public.refresh_delivery_jobs_from_order();

create or replace function public.rider_accept_delivery_job(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.delivery_jobs;
begin
  if not exists (
    select 1
    from public.rider_profiles
    where rider_profiles.auth_user_id = auth.uid()
      and rider_profiles.status = 'active'
  ) then
    raise exception 'Active rider account required';
  end if;

  update public.delivery_jobs
  set
    rider_user_id = auth.uid(),
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  where id = target_job_id
    and status = 'available'
    and rider_user_id is null
  returning * into result;

  if result.id is null then
    raise exception 'Delivery job is no longer available';
  end if;

  return result;
end;
$$;

create or replace function public.rider_mark_delivery_picked_up(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.delivery_jobs;
begin
  update public.delivery_jobs
  set
    status = 'pickedUp',
    picked_up_at = now(),
    updated_at = now()
  where id = target_job_id
    and rider_user_id = auth.uid()
    and status = 'accepted'
  returning * into result;

  if result.id is null then
    raise exception 'Accepted delivery job not found';
  end if;

  return result;
end;
$$;

create or replace function public.rider_mark_delivery_arrived(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.delivery_jobs;
begin
  update public.delivery_jobs
  set
    status = 'awaitingBuyerConfirmation',
    rider_confirmed_at = now(),
    updated_at = now()
  where id = target_job_id
    and rider_user_id = auth.uid()
    and status = 'pickedUp'
  returning * into result;

  if result.id is null then
    raise exception 'Picked-up delivery job not found';
  end if;

  return result;
end;
$$;

create or replace function public.buyer_confirm_delivery(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.delivery_jobs;
begin
  update public.delivery_jobs
  set
    buyer_confirmed_at = now(),
    status = 'completed',
    completed_at = now(),
    seller_release_status = case
      when seller_type = 'individualSeller' then 'available'
      else seller_release_status
    end,
    updated_at = now()
  where id = target_job_id
    and status = 'awaitingBuyerConfirmation'
    and rider_confirmed_at is not null
    and exists (
      select 1
      from public.orders
      where orders.id = delivery_jobs.order_id
        and orders.user_id = auth.uid()::text
    )
  returning * into result;

  if result.id is null then
    raise exception 'Delivery is not ready for buyer confirmation';
  end if;

  return result;
end;
$$;

revoke all on function public.rider_accept_delivery_job(text) from public;
revoke all on function public.rider_mark_delivery_picked_up(text) from public;
revoke all on function public.rider_mark_delivery_arrived(text) from public;
revoke all on function public.buyer_confirm_delivery(text) from public;
revoke all on function public.refresh_delivery_jobs(text) from public;
revoke all on function public.refresh_delivery_jobs_from_item() from public;
revoke all on function public.refresh_delivery_jobs_from_order() from public;
revoke all on function public.register_rider_profile(text, text, text, text) from public;

grant execute on function public.rider_accept_delivery_job(text) to authenticated;
grant execute on function public.rider_mark_delivery_picked_up(text) to authenticated;
grant execute on function public.rider_mark_delivery_arrived(text) to authenticated;
grant execute on function public.buyer_confirm_delivery(text) to authenticated;
grant execute on function public.register_rider_profile(text, text, text, text) to authenticated;
