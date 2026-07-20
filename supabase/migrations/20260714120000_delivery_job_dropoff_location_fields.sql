alter table public.delivery_jobs
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

update public.delivery_jobs as jobs
set
  delivery_country = orders.delivery_country,
  delivery_state_region = orders.delivery_state_region,
  delivery_city = orders.delivery_city,
  delivery_area_district = orders.delivery_area_district,
  delivery_street_name = orders.delivery_street_name,
  delivery_building_info = orders.delivery_building_info,
  delivery_landmark = orders.delivery_landmark,
  delivery_latitude = orders.delivery_latitude,
  delivery_longitude = orders.delivery_longitude,
  delivery_place_id = orders.delivery_place_id,
  delivery_location_source = orders.delivery_location_source,
  delivery_instructions = orders.delivery_instructions,
  updated_at = now()
from public.orders
where orders.id = jobs.order_id;

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
    delivery_country,
    delivery_state_region,
    delivery_city,
    delivery_area_district,
    delivery_street_name,
    delivery_building_info,
    delivery_landmark,
    delivery_latitude,
    delivery_longitude,
    delivery_place_id,
    delivery_location_source,
    delivery_instructions,
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
    orders.delivery_country,
    orders.delivery_state_region,
    orders.delivery_city,
    orders.delivery_area_district,
    orders.delivery_street_name,
    orders.delivery_building_info,
    orders.delivery_landmark,
    orders.delivery_latitude,
    orders.delivery_longitude,
    orders.delivery_place_id,
    orders.delivery_location_source,
    orders.delivery_instructions,
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
    orders.delivery_country,
    orders.delivery_state_region,
    orders.delivery_city,
    orders.delivery_area_district,
    orders.delivery_street_name,
    orders.delivery_building_info,
    orders.delivery_landmark,
    orders.delivery_latitude,
    orders.delivery_longitude,
    orders.delivery_place_id,
    orders.delivery_location_source,
    orders.delivery_instructions,
    orders.delivery_fee
  on conflict (order_id, seller_key) do update
  set
    pickup_address = excluded.pickup_address,
    delivery_address = excluded.delivery_address,
    delivery_country = excluded.delivery_country,
    delivery_state_region = excluded.delivery_state_region,
    delivery_city = excluded.delivery_city,
    delivery_area_district = excluded.delivery_area_district,
    delivery_street_name = excluded.delivery_street_name,
    delivery_building_info = excluded.delivery_building_info,
    delivery_landmark = excluded.delivery_landmark,
    delivery_latitude = excluded.delivery_latitude,
    delivery_longitude = excluded.delivery_longitude,
    delivery_place_id = excluded.delivery_place_id,
    delivery_location_source = excluded.delivery_location_source,
    delivery_instructions = excluded.delivery_instructions,
    item_subtotal = excluded.item_subtotal,
    delivery_fee = excluded.delivery_fee,
    updated_at = now();
end;
$$;
