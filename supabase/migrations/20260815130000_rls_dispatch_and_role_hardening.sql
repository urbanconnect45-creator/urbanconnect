-- Final authorization pass. Apply only after a verified production backup.

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check
  check (role in ('owner', 'admin', 'customerCare'));

alter table public.audit_logs drop constraint if exists audit_logs_actor_role_check;
alter table public.audit_logs add constraint audit_logs_actor_role_check
  check (actor_role in ('system', 'owner', 'admin', 'customerCare', 'resident', 'businessOwner', 'dispatch'));

create or replace function public.can_access_order(target_order_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_view2connect_staff(array['owner', 'admin', 'customerCare'])
    or exists (
      select 1 from public.orders
      where orders.id = target_order_id and orders.user_id = auth.uid()::text
    )
    or exists (
      select 1 from public.order_items
      where order_items.order_id = target_order_id
        and order_items.owner_user_id = auth.uid()::text
    )
$$;

revoke all on function public.can_access_order(text) from public, anon;
grant execute on function public.can_access_order(text) to authenticated;

drop policy if exists orders_participant_read on public.orders;
create policy orders_participant_read on public.orders for select to authenticated
using (public.can_access_order(id));
drop policy if exists order_items_participant_read on public.order_items;
create policy order_items_participant_read on public.order_items for select to authenticated
using (public.can_access_order(order_id));
drop policy if exists order_events_participant_read on public.order_timeline_events;
create policy order_events_participant_read on public.order_timeline_events for select to authenticated
using (public.can_access_order(order_id));

drop policy if exists owner_profiles_owner_or_staff_all on public.owner_business_profiles;
drop policy if exists owner_profiles_owner_or_staff_read on public.owner_business_profiles;
create policy owner_profiles_owner_or_staff_read on public.owner_business_profiles
for select to authenticated
using (
  owner_user_id = auth.uid()::text
  or public.is_view2connect_staff(array['owner', 'admin', 'customerCare'])
);
drop policy if exists owner_profiles_owner_insert on public.owner_business_profiles;
create policy owner_profiles_owner_insert on public.owner_business_profiles
for insert to authenticated
with check (owner_user_id = auth.uid()::text and public.current_app_role() = 'businessOwner');
drop policy if exists owner_profiles_owner_update on public.owner_business_profiles;
create policy owner_profiles_owner_update on public.owner_business_profiles
for update to authenticated
using (owner_user_id = auth.uid()::text and public.current_app_role() = 'businessOwner')
with check (owner_user_id = auth.uid()::text and public.current_app_role() = 'businessOwner');
drop policy if exists owner_profiles_owner_delete on public.owner_business_profiles;
create policy owner_profiles_owner_delete on public.owner_business_profiles
for delete to authenticated
using (owner_user_id = auth.uid()::text and public.current_app_role() = 'businessOwner');

drop policy if exists delivery_jobs_authorized_read on public.delivery_jobs;
create policy delivery_jobs_authorized_read on public.delivery_jobs for select to authenticated
using (
  public.is_view2connect_staff(array['owner', 'admin', 'customerCare'])
  or (
    public.current_app_role() = 'dispatch'
    and (status = 'available' or rider_user_id = auth.uid())
  )
  or public.can_access_order(order_id)
);

create or replace function public.is_active_dispatch_rider()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() = 'dispatch'
    and exists (
      select 1 from public.rider_profiles
      where rider_profiles.auth_user_id = auth.uid()
        and rider_profiles.status = 'active'
    )
$$;

revoke all on function public.is_active_dispatch_rider() from public, anon;
grant execute on function public.is_active_dispatch_rider() to authenticated;

create or replace function public.rider_accept_delivery_job(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare result public.delivery_jobs;
begin
  if not public.is_active_dispatch_rider() then
    raise exception 'Complete dispatch verification before accepting deliveries' using errcode = '42501';
  end if;
  update public.delivery_jobs
  set rider_user_id = auth.uid(), status = 'accepted', accepted_at = now(), updated_at = now()
  where id = target_job_id and status = 'available' and rider_user_id is null
  returning * into result;
  if result.id is null then raise exception 'Delivery job is no longer available'; end if;
  return result;
end;
$$;

create or replace function public.rider_mark_delivery_picked_up(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare result public.delivery_jobs;
begin
  if not public.is_active_dispatch_rider() then
    raise exception 'Active dispatch verification is required' using errcode = '42501';
  end if;
  update public.delivery_jobs
  set status = 'pickedUp', picked_up_at = now(), updated_at = now()
  where id = target_job_id and rider_user_id = auth.uid() and status = 'accepted'
  returning * into result;
  if result.id is null then raise exception 'Accepted delivery job not found'; end if;
  return result;
end;
$$;

create or replace function public.rider_mark_delivery_arrived(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare result public.delivery_jobs;
begin
  if not public.is_active_dispatch_rider() then
    raise exception 'Active dispatch verification is required' using errcode = '42501';
  end if;
  update public.delivery_jobs
  set status = 'awaitingBuyerConfirmation', rider_confirmed_at = now(), updated_at = now()
  where id = target_job_id and rider_user_id = auth.uid() and status = 'pickedUp'
  returning * into result;
  if result.id is null then raise exception 'Picked-up delivery job not found'; end if;
  return result;
end;
$$;

create or replace function public.register_rider_profile(
  rider_full_name text,
  rider_phone_number text,
  rider_vehicle_type text default null,
  rider_plate_number text default null
)
returns public.rider_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.rider_profiles;
  rider_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if auth.uid() is null or public.current_app_role() <> 'dispatch' then
    raise exception 'Authenticated dispatch account required' using errcode = '42501';
  end if;
  if trim(coalesce(rider_full_name, '')) = ''
    or trim(coalesce(rider_phone_number, '')) = ''
    or trim(rider_email) = '' then
    raise exception 'Rider name, email, and phone number are required';
  end if;
  insert into public.rider_profiles (
    auth_user_id, full_name, email, phone_number, vehicle_type, plate_number,
    status, created_at, updated_at
  ) values (
    auth.uid(), trim(rider_full_name), lower(trim(rider_email)),
    trim(rider_phone_number), nullif(trim(coalesce(rider_vehicle_type, '')), ''),
    nullif(trim(coalesce(rider_plate_number, '')), ''), 'pending', now(), now()
  )
  on conflict (auth_user_id) do update
  set full_name = excluded.full_name,
      phone_number = excluded.phone_number,
      vehicle_type = excluded.vehicle_type,
      plate_number = excluded.plate_number,
      updated_at = now()
  returning * into result;
  return result;
end;
$$;

revoke all on function public.rider_accept_delivery_job(text) from public, anon;
revoke all on function public.rider_mark_delivery_picked_up(text) from public, anon;
revoke all on function public.rider_mark_delivery_arrived(text) from public, anon;
revoke all on function public.register_rider_profile(text, text, text, text) from public, anon;
grant execute on function public.rider_accept_delivery_job(text) to authenticated;
grant execute on function public.rider_mark_delivery_picked_up(text) to authenticated;
grant execute on function public.rider_mark_delivery_arrived(text) to authenticated;
grant execute on function public.register_rider_profile(text, text, text, text) to authenticated;

create or replace function public.audit_delivery_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := coalesce(public.current_app_role(), public.current_admin_role(), 'system');
  actor_name text;
begin
  if old.status is not distinct from new.status then return new; end if;
  select coalesce(app_users.full_name, admin_users.full_name, 'View2Connect system')
  into actor_name
  from (select 1) as seed
  left join public.app_users on app_users.id = auth.uid()::text
  left join public.admin_users on admin_users.auth_user_id = auth.uid();
  insert into public.audit_logs (id, actor_id, actor_name, actor_role, action, details)
  values (
    gen_random_uuid()::text, auth.uid(), coalesce(actor_name, 'View2Connect system'), actor_role,
    'Delivery status changed',
    format('job_id=%s from=%s to=%s', new.id, old.status, new.status)
  );
  return new;
end;
$$;

drop trigger if exists audit_delivery_status_change on public.delivery_jobs;
create trigger audit_delivery_status_change
after update of status on public.delivery_jobs
for each row execute function public.audit_delivery_status_change();
