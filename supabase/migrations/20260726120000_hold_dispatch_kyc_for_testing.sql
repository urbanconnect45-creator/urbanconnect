-- Temporarily pause dispatch KYC enforcement for live end-to-end testing.
-- Only authenticated app_users with role = dispatch can accept jobs.

create or replace function public.rider_accept_delivery_job(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.delivery_jobs;
begin
  if auth.uid() is null then
    raise exception 'Authenticated dispatch account required';
  end if;

  if not exists (
    select 1
    from public.app_users
    where app_users.id = auth.uid()::text
      and app_users.role = 'dispatch'
      and coalesce(app_users.status, 'active') = 'active'
  ) then
    raise exception 'Dispatch account required';
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

grant execute on function public.rider_accept_delivery_job(text) to authenticated;
create or replace function public.refresh_delivery_jobs_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
    and new.status <> 'cancelled'
    and (
      tg_op = 'INSERT'
      or (tg_op = 'UPDATE' and old.payment_status is distinct from new.payment_status)
    ) then
    perform public.refresh_delivery_jobs(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_delivery_jobs_after_payment on public.orders;
create trigger refresh_delivery_jobs_after_payment
after insert or update of payment_status on public.orders
for each row execute function public.refresh_delivery_jobs_from_order();

create or replace function public.get_order_delivery_jobs(target_order_id text)
returns table (
  id text,
  order_id text,
  seller_name text,
  delivery_address text,
  delivery_contact_phone text,
  status text,
  rider_user_id uuid,
  rider_full_name text,
  rider_phone_number text,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  rider_confirmed_at timestamptz,
  buyer_confirmed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authenticated account required';
  end if;

  if not exists (
    select 1
    from public.orders
    where orders.id = target_order_id
      and (
        orders.user_id = auth.uid()::text
        or exists (
          select 1
          from public.order_items
          where order_items.order_id = orders.id
            and order_items.owner_user_id = auth.uid()::text
        )
      )
  ) then
    raise exception 'Order delivery updates not found';
  end if;

  return query
  select
    jobs.id,
    jobs.order_id,
    jobs.seller_name,
    jobs.delivery_address,
    jobs.delivery_contact_phone,
    jobs.status::text,
    jobs.rider_user_id,
    coalesce(rider_profiles.full_name, app_users.full_name) as rider_full_name,
    coalesce(rider_profiles.phone_number, app_users.phone_number) as rider_phone_number,
    jobs.accepted_at,
    jobs.picked_up_at,
    jobs.rider_confirmed_at,
    jobs.buyer_confirmed_at,
    jobs.completed_at,
    jobs.updated_at
  from public.delivery_jobs as jobs
  left join public.rider_profiles as rider_profiles
    on rider_profiles.auth_user_id = jobs.rider_user_id
  left join public.app_users as app_users
    on app_users.id = jobs.rider_user_id::text
  where jobs.order_id = target_order_id
  order by jobs.created_at asc;
end;
$$;

revoke all on function public.get_order_delivery_jobs(text) from public;
grant execute on function public.get_order_delivery_jobs(text) to authenticated;
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

  update public.orders
  set
    status = 'delivered',
    updated_at = now()
  where id = result.order_id
    and user_id = auth.uid()::text
    and not exists (
      select 1
      from public.delivery_jobs
      where delivery_jobs.order_id = result.order_id
        and delivery_jobs.status <> 'completed'
    );

  return result;
end;
$$;

grant execute on function public.buyer_confirm_delivery(text) to authenticated;
