-- View2Connect authorization baseline. Apply only after a verified backup.

alter table public.admin_users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

alter table public.account_signup_verifications
  drop constraint if exists account_signup_verifications_pkey;
alter table public.account_signup_verifications
  add primary key (email, role);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select users.role
  from public.app_users as users
  where users.id = auth.uid()::text
    and users.status = 'active'
  limit 1
$$;

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select admins.role
  from public.admin_users as admins
  where admins.auth_user_id = auth.uid()
    and admins.is_active
  limit 1
$$;

create or replace function public.is_view2connect_staff(allowed_roles text[] default array['owner', 'customerCare'])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_admin_role() = any(allowed_roles), false)
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_admin_role() from public;
revoke all on function public.is_view2connect_staff(text[]) from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.is_view2connect_staff(text[]) to authenticated;

drop function if exists public.verify_admin_login(text, text);

create or replace function public.get_my_admin_profile()
returns table (
  id text,
  full_name text,
  email text,
  role text,
  is_active boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select admins.id, admins.full_name, admins.email, admins.role,
    admins.is_active, admins.created_at
  from public.admin_users as admins
  where admins.auth_user_id = auth.uid()
    and admins.is_active
  limit 1
$$;

revoke all on function public.get_my_admin_profile() from public, anon;
grant execute on function public.get_my_admin_profile() to authenticated;

create or replace function public.set_river_park_verification(
  target_user_id text,
  verified boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_view2connect_staff(array['owner', 'customerCare']) then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  update public.app_users
  set river_park_verified = verified, updated_at = now()
  where id = target_user_id;

  update public.owner_business_profiles
  set river_park_verified = verified, updated_at = now()
  where owner_user_id = target_user_id;

  update public.businesses
  set river_park_verified = verified, updated_at = now()
  where owner_user_id = target_user_id;

  insert into public.audit_logs (id, actor_id, actor_name, actor_role, action, details)
  select gen_random_uuid()::text, auth.uid(), admins.full_name, admins.role,
    'Account verification changed',
    format('user_id=%s verified=%s', target_user_id, verified)
  from public.admin_users as admins
  where admins.auth_user_id = auth.uid();
end;
$$;

revoke all on function public.set_river_park_verification(text, boolean) from public, anon;
grant execute on function public.set_river_park_verification(text, boolean) to authenticated;

create or replace function public.delete_support_conversation(target_conversation_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_view2connect_staff(array['owner', 'customerCare']) then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  delete from public.support_messages where conversation_id = target_conversation_id;
end;
$$;

create or replace function public.delete_business_listing(target_business_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_view2connect_staff(array['owner']) then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;

  delete from public.businesses where id = target_business_id;
end;
$$;

revoke all on function public.delete_support_conversation(text) from public, anon;
revoke all on function public.delete_business_listing(text) from public, anon;
grant execute on function public.delete_support_conversation(text) to authenticated;
grant execute on function public.delete_business_listing(text) to authenticated;

create or replace function public.protect_business_moderation_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  app_role text := public.current_app_role();
begin
  if auth.role() = 'service_role' or public.is_view2connect_staff(array['owner', 'customerCare']) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.owner_user_id := auth.uid()::text;
    new.verified := false;
    new.river_park_verified := false;
    if app_role = 'resident' then
      new.listing_source := 'customerAccount';
      new.listing_audience := 'customerAdvert';
    elsif app_role = 'businessOwner' then
      new.listing_source := 'sellerPortal';
      new.listing_audience := 'storeProduct';
    else
      raise exception 'This account role cannot create listings' using errcode = '42501';
    end if;
  else
    new.owner_user_id := old.owner_user_id;
    new.verified := old.verified;
    new.river_park_verified := old.river_park_verified;
    new.listing_source := old.listing_source;
    new.listing_audience := old.listing_audience;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_business_moderation_fields on public.businesses;
create trigger protect_business_moderation_fields
before insert or update on public.businesses
for each row execute function public.protect_business_moderation_fields();

create or replace function public.protect_payout_account_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and auth.role() <> 'service_role'
    and not public.is_view2connect_staff(array['owner']) then
    new.payout_bank_code := old.payout_bank_code;
    new.payout_bank_name := old.payout_bank_name;
    new.payout_account_number := old.payout_account_number;
    new.payout_account_name := old.payout_account_name;
    new.payout_verified_at := old.payout_verified_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_payout_account_fields on public.owner_business_profiles;
create trigger protect_payout_account_fields
before update on public.owner_business_profiles
for each row execute function public.protect_payout_account_fields();

alter table public.estates enable row level security;
alter table public.admin_users enable row level security;
alter table public.app_users enable row level security;
alter table public.payment_plans enable row level security;
alter table public.security_settings enable row level security;
alter table public.owner_business_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_timeline_events enable row level security;
alter table public.email_logs enable row level security;
alter table public.support_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.virtual_accounts enable row level security;
alter table public.dynamic_deposit_accounts enable row level security;
alter table public.seller_signup_verifications enable row level security;
alter table public.account_signup_verifications enable row level security;
alter table public.seller_applications enable row level security;
alter table public.rider_profiles enable row level security;
alter table public.delivery_jobs enable row level security;
alter table public.customer_cart_items enable row level security;
alter table public.customer_delivery_locations enable row level security;
alter table public.listing_messages enable row level security;

revoke all on public.admin_users from anon, authenticated;
revoke all on public.app_users from anon, authenticated;
revoke all on public.orders, public.order_items, public.order_timeline_events from anon, authenticated;
revoke all on public.email_logs, public.audit_logs from anon, authenticated;
revoke all on public.withdrawal_requests, public.virtual_accounts, public.dynamic_deposit_accounts from anon, authenticated;
revoke all on public.seller_signup_verifications, public.account_signup_verifications from anon, authenticated;

grant select on public.estates, public.payment_plans, public.security_settings, public.businesses to anon, authenticated;
grant select on public.app_users, public.admin_users to authenticated;
grant update (first_name, last_name, full_name, phone_number, business_name, business_cluster, updated_at)
  on public.app_users to authenticated;
grant select, insert, update, delete on public.owner_business_profiles, public.businesses to authenticated;
grant select on public.orders, public.order_items, public.order_timeline_events to authenticated;
grant select, insert, update, delete on public.customer_cart_items, public.customer_delivery_locations to authenticated;
grant select, insert on public.listing_messages, public.support_messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.subscription_payments, public.withdrawal_requests, public.virtual_accounts,
  public.dynamic_deposit_accounts, public.email_logs, public.audit_logs to authenticated;
grant select on public.seller_applications, public.rider_profiles, public.delivery_jobs to authenticated;
grant update on public.rider_profiles to authenticated;

drop policy if exists estates_public_read on public.estates;
create policy estates_public_read on public.estates for select to anon, authenticated using (true);
drop policy if exists payment_plans_public_read on public.payment_plans;
create policy payment_plans_public_read on public.payment_plans for select to anon, authenticated using (true);
drop policy if exists security_settings_public_read on public.security_settings;
create policy security_settings_public_read on public.security_settings for select to anon, authenticated using (true);

drop policy if exists app_users_own_or_staff_read on public.app_users;
create policy app_users_own_or_staff_read on public.app_users for select to authenticated
using (id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists app_users_own_update on public.app_users;
create policy app_users_own_update on public.app_users for update to authenticated
using (id = auth.uid()::text) with check (id = auth.uid()::text);

drop policy if exists admin_users_staff_read on public.admin_users;
create policy admin_users_staff_read on public.admin_users for select to authenticated
using (auth_user_id = auth.uid() or public.current_admin_role() = 'owner');

drop policy if exists owner_profiles_owner_or_staff_all on public.owner_business_profiles;
create policy owner_profiles_owner_or_staff_all on public.owner_business_profiles for all to authenticated
using (owner_user_id = auth.uid()::text or public.is_view2connect_staff())
with check (owner_user_id = auth.uid()::text or public.is_view2connect_staff());

drop policy if exists businesses_public_or_owner_read on public.businesses;
create policy businesses_public_or_owner_read on public.businesses for select to anon, authenticated
using (
  (status = 'active' and verified = true)
  or owner_user_id = auth.uid()::text
  or public.is_view2connect_staff()
);
drop policy if exists businesses_owner_insert on public.businesses;
create policy businesses_owner_insert on public.businesses for insert to authenticated
with check (owner_user_id = auth.uid()::text and public.current_app_role() in ('resident', 'businessOwner'));
drop policy if exists businesses_owner_update on public.businesses;
create policy businesses_owner_update on public.businesses for update to authenticated
using (owner_user_id = auth.uid()::text or public.is_view2connect_staff())
with check (owner_user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists businesses_owner_delete on public.businesses;
create policy businesses_owner_delete on public.businesses for delete to authenticated
using (owner_user_id = auth.uid()::text or public.current_admin_role() = 'owner');

drop policy if exists orders_participant_read on public.orders;
create policy orders_participant_read on public.orders for select to authenticated
using (
  user_id = auth.uid()::text
  or public.is_view2connect_staff()
  or exists (
    select 1 from public.order_items
    where order_items.order_id = orders.id
      and order_items.owner_user_id = auth.uid()::text
  )
);
drop policy if exists order_items_participant_read on public.order_items;
create policy order_items_participant_read on public.order_items for select to authenticated
using (
  owner_user_id = auth.uid()::text
  or public.is_view2connect_staff()
  or exists (
    select 1 from public.orders
    where orders.id = order_items.order_id and orders.user_id = auth.uid()::text
  )
);
drop policy if exists order_events_participant_read on public.order_timeline_events;
create policy order_events_participant_read on public.order_timeline_events for select to authenticated
using (
  public.is_view2connect_staff()
  or exists (
    select 1 from public.orders
    where orders.id = order_timeline_events.order_id
      and (
        orders.user_id = auth.uid()::text
        or exists (
          select 1 from public.order_items
          where order_items.order_id = orders.id
            and order_items.owner_user_id = auth.uid()::text
        )
      )
  )
);

drop policy if exists cart_owner_all on public.customer_cart_items;
create policy cart_owner_all on public.customer_cart_items for all to authenticated
using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists delivery_location_owner_all on public.customer_delivery_locations;
create policy delivery_location_owner_all on public.customer_delivery_locations for all to authenticated
using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists listing_messages_participant_read on public.listing_messages;
create policy listing_messages_participant_read on public.listing_messages for select to authenticated
using (sender_user_id = auth.uid()::text or recipient_user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists listing_messages_sender_insert on public.listing_messages;
create policy listing_messages_sender_insert on public.listing_messages for insert to authenticated
with check (sender_user_id = auth.uid()::text and recipient_user_id is distinct from auth.uid()::text);

drop policy if exists support_messages_participant_read on public.support_messages;
create policy support_messages_participant_read on public.support_messages for select to authenticated
using (user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists support_messages_user_insert on public.support_messages;
create policy support_messages_user_insert on public.support_messages for insert to authenticated
with check (user_id = auth.uid()::text and sender_role = public.current_app_role());

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications for select to authenticated
using (user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications for update to authenticated
using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

drop policy if exists subscription_payments_owner_read on public.subscription_payments;
create policy subscription_payments_owner_read on public.subscription_payments for select to authenticated
using (owner_user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists withdrawal_owner_read on public.withdrawal_requests;
create policy withdrawal_owner_read on public.withdrawal_requests for select to authenticated
using (owner_user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists virtual_account_owner_read on public.virtual_accounts;
create policy virtual_account_owner_read on public.virtual_accounts for select to authenticated
using (owner_user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists dynamic_deposit_owner_read on public.dynamic_deposit_accounts;
create policy dynamic_deposit_owner_read on public.dynamic_deposit_accounts for select to authenticated
using (user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists email_logs_recipient_or_staff_read on public.email_logs;
create policy email_logs_recipient_or_staff_read on public.email_logs for select to authenticated
using (
  public.is_view2connect_staff()
  or exists (
    select 1 from public.app_users
    where app_users.id = auth.uid()::text
      and lower(app_users.email) = lower(email_logs.recipient_email)
  )
);
drop policy if exists audit_logs_staff_read on public.audit_logs;
create policy audit_logs_staff_read on public.audit_logs for select to authenticated
using (public.is_view2connect_staff());

drop policy if exists seller_applications_owner_or_staff_read on public.seller_applications;
create policy seller_applications_owner_or_staff_read on public.seller_applications for select to authenticated
using (profile_user_id = auth.uid()::text or public.is_view2connect_staff());
drop policy if exists rider_profiles_owner_or_staff_read on public.rider_profiles;
create policy rider_profiles_owner_or_staff_read on public.rider_profiles for select to authenticated
using (auth_user_id = auth.uid() or public.is_view2connect_staff());
drop policy if exists rider_profiles_owner_update on public.rider_profiles;
create policy rider_profiles_owner_update on public.rider_profiles for update to authenticated
using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

drop policy if exists delivery_jobs_authorized_read on public.delivery_jobs;
create policy delivery_jobs_authorized_read on public.delivery_jobs for select to authenticated
using (
  public.is_view2connect_staff()
  or (public.current_app_role() = 'dispatch' and (status = 'available' or rider_user_id = auth.uid()))
  or seller_user_id = auth.uid()::text
  or exists (
    select 1 from public.orders
    where orders.id = delivery_jobs.order_id and orders.user_id = auth.uid()::text
  )
);

drop policy if exists "Allow public withdrawal request reads" on public.withdrawal_requests;
drop policy if exists "Allow public withdrawal request writes" on public.withdrawal_requests;
drop policy if exists "Allow public virtual account reads" on public.virtual_accounts;
drop policy if exists "Allow public virtual account upserts" on public.virtual_accounts;
drop policy if exists "Allow public virtual account updates" on public.virtual_accounts;
drop policy if exists "Allow public dynamic deposit reads" on public.dynamic_deposit_accounts;
drop policy if exists "Allow public dynamic deposit upserts" on public.dynamic_deposit_accounts;
drop policy if exists "Allow public dynamic deposit updates" on public.dynamic_deposit_accounts;

create or replace view public.public_owner_business_profiles
with (security_barrier = true)
as
select
  id, owner_user_id, account_name, account_email, owner_name, phone, whatsapp, email, website,
  instagram, facebook, x, tiktok, address, cover_image, profile_image, bio,
  gallery_images, gallery_videos, opening_time, closing_time, open_days,
  subscription_cycle, subscription_status, verified_amount, subscription_paid_at,
  subscription_next_billing_at, subscription_item_count, river_park_verified, updated_at
from public.owner_business_profiles
where river_park_verified = true;

revoke all on public.public_owner_business_profiles from public;
grant select on public.public_owner_business_profiles to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'urbanconnect-listing-media',
  'urbanconnect-listing-media',
  true,
  31457280,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'text/plain'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "UrbanConnect listing media upload" on storage.objects;
drop policy if exists "UrbanConnect listing media update" on storage.objects;
drop policy if exists urbanconnect_media_owner_insert on storage.objects;
create policy urbanconnect_media_owner_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'urbanconnect-listing-media'
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(storage.extension(name)) in (
    'jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'
  )
);
drop policy if exists urbanconnect_media_owner_update on storage.objects;
create policy urbanconnect_media_owner_update on storage.objects for update to authenticated
using (bucket_id = 'urbanconnect-listing-media' and owner_id = auth.uid()::text)
with check (bucket_id = 'urbanconnect-listing-media' and owner_id = auth.uid()::text);
drop policy if exists urbanconnect_media_owner_delete on storage.objects;
create policy urbanconnect_media_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'urbanconnect-listing-media' and owner_id = auth.uid()::text);
