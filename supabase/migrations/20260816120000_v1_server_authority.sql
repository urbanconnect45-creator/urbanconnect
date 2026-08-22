-- Close launch-blocking gaps where the client previously appeared to save sensitive
-- operations without an authoritative database write.

alter table public.rider_profiles
  add column if not exists whatsapp text,
  add column if not exists address text,
  add column if not exists profile_image text,
  add column if not exists bio text;

create or replace function public.update_my_dispatch_profile(
  rider_full_name text,
  rider_email text,
  rider_phone_number text,
  rider_whatsapp text default '',
  rider_address text default '',
  rider_profile_image text default '',
  rider_bio text default ''
)
returns public.rider_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.rider_profiles%rowtype;
  normalized_name text := trim(coalesce(rider_full_name, ''));
  normalized_email text := lower(trim(coalesce(rider_email, '')));
  normalized_phone text := trim(coalesce(rider_phone_number, ''));
  first_space integer;
begin
  if auth.uid() is null or public.current_app_role() <> 'dispatch' then
    raise exception 'Authenticated dispatch account required' using errcode = '42501';
  end if;

  if normalized_name = '' then
    raise exception 'Dispatch name is required';
  end if;
  if normalized_email = '' or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid dispatch contact email';
  end if;
  if length(regexp_replace(normalized_phone, '[^0-9]', '', 'g')) < 10 then
    raise exception 'Enter a valid dispatch phone number';
  end if;

  update public.rider_profiles
  set full_name = normalized_name,
      email = normalized_email,
      phone_number = normalized_phone,
      whatsapp = nullif(trim(coalesce(rider_whatsapp, '')), ''),
      address = nullif(trim(coalesce(rider_address, '')), ''),
      profile_image = nullif(trim(coalesce(rider_profile_image, '')), ''),
      bio = nullif(trim(coalesce(rider_bio, '')), ''),
      updated_at = now()
  where auth_user_id = auth.uid()
  returning * into result;

  if result.auth_user_id is null then
    raise exception 'Dispatch rider profile was not found';
  end if;

  first_space := position(' ' in normalized_name);
  update public.app_users
  set first_name = case
        when first_space > 0 then left(normalized_name, first_space - 1)
        else normalized_name
      end,
      last_name = case
        when first_space > 0 then trim(substr(normalized_name, first_space + 1))
        else last_name
      end,
      full_name = normalized_name,
      phone_number = normalized_phone,
      business_cluster = nullif(trim(coalesce(rider_address, '')), ''),
      updated_at = now()
  where id = auth.uid()::text and role = 'dispatch';

  return result;
end;
$$;

revoke all on function public.update_my_dispatch_profile(text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.update_my_dispatch_profile(text, text, text, text, text, text, text)
  to authenticated;

alter table public.security_settings
  add column if not exists minimum_withdrawal_amount numeric(12, 2) not null default 1000,
  add column if not exists maximum_withdrawal_amount numeric(12, 2) not null default 1000000,
  add column if not exists vat_tier_one_amount numeric(12, 2) not null default 500,
  add column if not exists vat_tier_two_base_amount numeric(12, 2) not null default 1500,
  add column if not exists vat_additional_band_amount numeric(12, 2) not null default 1000,
  add column if not exists packing_tier_one_amount numeric(12, 2) not null default 50,
  add column if not exists packing_tier_two_amount numeric(12, 2) not null default 100,
  add column if not exists packing_tier_three_amount numeric(12, 2) not null default 200,
  add column if not exists packing_tier_four_amount numeric(12, 2) not null default 300,
  add column if not exists packing_tier_five_amount numeric(12, 2) not null default 500,
  add column if not exists packing_tier_six_amount numeric(12, 2) not null default 800;

alter table public.security_settings
  drop constraint if exists security_settings_withdrawal_limits_check;
alter table public.security_settings
  add constraint security_settings_withdrawal_limits_check check (
    minimum_withdrawal_amount >= 0
    and maximum_withdrawal_amount >= minimum_withdrawal_amount
  );

alter table public.security_settings
  drop constraint if exists security_settings_checkout_fees_check;
alter table public.security_settings
  add constraint security_settings_checkout_fees_check check (
    vat_tier_one_amount >= 0
    and vat_tier_two_base_amount >= 0
    and vat_additional_band_amount >= 0
    and packing_tier_one_amount >= 0
    and packing_tier_two_amount >= 0
    and packing_tier_three_amount >= 0
    and packing_tier_four_amount >= 0
    and packing_tier_five_amount >= 0
    and packing_tier_six_amount >= 0
  );

create or replace function public.calculate_view2connect_vat(subtotal numeric)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare settings public.security_settings%rowtype;
begin
  select * into settings from public.security_settings where id = 'default';
  return case
    when subtotal < 3000 then 0
    when subtotal < 10000 then coalesce(settings.vat_tier_one_amount, 500)
    else coalesce(settings.vat_tier_two_base_amount, 1500)
      + floor((subtotal - 10000) / 10000)
        * coalesce(settings.vat_additional_band_amount, 1000)
  end;
end;
$$;

create or replace function public.calculate_seller_packing_support(subtotal numeric)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare settings public.security_settings%rowtype;
begin
  select * into settings from public.security_settings where id = 'default';
  return case
    when subtotal < 100 then 0
    when subtotal < 1000 then coalesce(settings.packing_tier_one_amount, 50)
    when subtotal < 5000 then coalesce(settings.packing_tier_two_amount, 100)
    when subtotal < 10000 then coalesce(settings.packing_tier_three_amount, 200)
    when subtotal < 20000 then coalesce(settings.packing_tier_four_amount, 300)
    when subtotal < 50000 then coalesce(settings.packing_tier_five_amount, 500)
    else coalesce(settings.packing_tier_six_amount, 800)
  end;
end;
$$;

alter table public.orders
  add column if not exists inventory_restored_at timestamptz;
alter table public.orders
  add column if not exists provider_transaction_id text,
  add column if not exists provider_reference text,
  add column if not exists refund_provider_reference text,
  add column if not exists refund_status text,
  add column if not exists refund_reason text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refunded_at timestamptz;

alter table public.delivery_jobs
  add column if not exists seller_ready_at timestamptz;

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
    new.verified := not coalesce(
      (select require_manual_listing_approval from public.security_settings where id = 'default'),
      true
    );
    new.river_park_verified := coalesce(
      (select river_park_verified from public.app_users where id = auth.uid()::text),
      false
    );
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

create or replace function public.enforce_store_product_order_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.businesses
    where id = new.business_id
      and status = 'active'
      and verified = true
      and listing_type = 'product'
      and listing_audience = 'storeProduct'
      and listing_source in ('sellerPortal', 'adminCatalog')
      and owner_user_id is not null
  ) then
    raise exception 'Only an approved Seller Portal product can be ordered';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_store_product_order_item on public.order_items;
create trigger enforce_store_product_order_item
before insert or update of business_id on public.order_items
for each row execute function public.enforce_store_product_order_item();

alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;
alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('resident', 'businessOwner', 'dispatch', 'customerCare', 'admin', 'owner', 'system'));

grant insert, update on public.security_settings, public.payment_plans to authenticated;
grant insert, update on public.subscription_payments to authenticated;

create or replace function public.protect_subscription_payment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      new.owner_user_id := auth.uid()::text;
      new.status := 'pending';
      new.paid_at := null;
    else
      new.owner_user_id := old.owner_user_id;
      new.status := old.status;
      new.paid_at := old.paid_at;
      new.amount := old.amount;
      new.currency := old.currency;
      new.reference := old.reference;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_subscription_payment_status on public.subscription_payments;
create trigger protect_subscription_payment_status
before insert or update on public.subscription_payments
for each row execute function public.protect_subscription_payment_status();

drop policy if exists subscription_payments_owner_insert on public.subscription_payments;
create policy subscription_payments_owner_insert on public.subscription_payments
for insert to authenticated
with check (owner_user_id = auth.uid()::text);

drop policy if exists subscription_payments_owner_update on public.subscription_payments;
create policy subscription_payments_owner_update on public.subscription_payments
for update to authenticated
using (owner_user_id = auth.uid()::text)
with check (owner_user_id = auth.uid()::text);

create table if not exists public.admin_security_controls (
  id text primary key default 'default',
  pin_hash bytea not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.admin_security_controls enable row level security;
revoke all on public.admin_security_controls from public, anon, authenticated;

create table if not exists public.admin_action_authorizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now()
);

alter table public.admin_action_authorizations enable row level security;
revoke all on public.admin_action_authorizations from public, anon, authenticated;

create or replace function public.set_admin_action_pin(admin_pin text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare changed_at timestamptz := now();
begin
  if public.current_admin_role() <> 'owner' then
    raise exception 'Only the owner admin can set the admin PIN' using errcode = '42501';
  end if;
  if admin_pin !~ '^\d{4}$' then
    raise exception 'Admin PIN must be exactly 4 digits';
  end if;

  insert into public.admin_security_controls (id, pin_hash, updated_at, updated_by)
  values (
    'default',
    extensions.digest(convert_to(admin_pin, 'UTF8'), 'sha256'),
    changed_at,
    auth.uid()
  )
  on conflict (id) do update set
    pin_hash = excluded.pin_hash,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  return changed_at;
end;
$$;

create or replace function public.verify_admin_action_pin(admin_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin_is_valid boolean;
begin
  delete from public.admin_action_authorizations where user_id = auth.uid();
  select public.is_view2connect_staff(array['owner', 'admin', 'customerCare'])
    and exists (
      select 1 from public.admin_security_controls
      where id = 'default'
        and pin_hash = extensions.digest(convert_to(admin_pin, 'UTF8'), 'sha256')
    ) into pin_is_valid;

  if pin_is_valid then
    insert into public.admin_action_authorizations (user_id, verified_at)
    values (auth.uid(), now())
    on conflict (user_id) do update set verified_at = excluded.verified_at;
  end if;

  return pin_is_valid;
end;
$$;

create or replace function public.has_recent_admin_action_authorization()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.is_view2connect_staff(array['owner', 'admin', 'customerCare'])
    and exists (
      select 1 from public.admin_action_authorizations
      where user_id = auth.uid()
        and verified_at >= now() - interval '2 minutes'
    )
$$;

create or replace function public.get_admin_action_pin_status()
returns table (configured boolean, updated_at timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select
    exists (select 1 from public.admin_security_controls where id = 'default'),
    (select controls.updated_at from public.admin_security_controls as controls where id = 'default')
  where public.is_view2connect_staff(array['owner', 'admin', 'customerCare'])
$$;

revoke all on function public.set_admin_action_pin(text) from public, anon;
revoke all on function public.verify_admin_action_pin(text) from public, anon;
revoke all on function public.get_admin_action_pin_status() from public, anon;
revoke all on function public.has_recent_admin_action_authorization() from public, anon;
grant execute on function public.set_admin_action_pin(text) to authenticated;
grant execute on function public.verify_admin_action_pin(text) to authenticated;
grant execute on function public.get_admin_action_pin_status() to authenticated;
grant execute on function public.has_recent_admin_action_authorization() to authenticated;

create or replace function public.delete_support_conversation(target_conversation_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_view2connect_staff(array['owner', 'customerCare'])
    or not public.has_recent_admin_action_authorization() then
    raise exception 'Confirm the Admin PIN before deleting support messages' using errcode = '42501';
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
declare
  listing_owner_id text;
begin
  select owner_user_id into listing_owner_id from public.businesses where id = target_business_id;
  if listing_owner_id = auth.uid()::text then
    delete from public.businesses where id = target_business_id;
    return;
  end if;
  if public.current_admin_role() <> 'owner'
    or not public.has_recent_admin_action_authorization() then
    raise exception 'Confirm the owner Admin PIN before deleting this listing' using errcode = '42501';
  end if;
  delete from public.businesses where id = target_business_id;
end;
$$;

drop policy if exists businesses_owner_delete on public.businesses;
create policy businesses_owner_delete on public.businesses for delete to authenticated
using (
  owner_user_id = auth.uid()::text
  or (
    public.current_admin_role() = 'owner'
    and public.has_recent_admin_action_authorization()
  )
);

drop policy if exists security_settings_owner_insert on public.security_settings;
create policy security_settings_owner_insert on public.security_settings
for insert to authenticated
with check (public.current_admin_role() = 'owner' and public.has_recent_admin_action_authorization());

drop policy if exists security_settings_owner_update on public.security_settings;
create policy security_settings_owner_update on public.security_settings
for update to authenticated
using (public.current_admin_role() = 'owner' and public.has_recent_admin_action_authorization())
with check (public.current_admin_role() = 'owner' and public.has_recent_admin_action_authorization());

drop policy if exists payment_plans_owner_insert on public.payment_plans;
create policy payment_plans_owner_insert on public.payment_plans
for insert to authenticated
with check (public.current_admin_role() = 'owner' and public.has_recent_admin_action_authorization());

drop policy if exists payment_plans_owner_update on public.payment_plans;
create policy payment_plans_owner_update on public.payment_plans
for update to authenticated
using (public.current_admin_role() = 'owner' and public.has_recent_admin_action_authorization())
with check (public.current_admin_role() = 'owner' and public.has_recent_admin_action_authorization());

create or replace function public.admin_set_app_user_status(
  target_user_id text,
  target_status text
)
returns public.app_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.app_users%rowtype;
begin
  if public.current_admin_role() <> 'owner' then
    raise exception 'Only the owner admin can change account status' using errcode = '42501';
  end if;
  if not public.has_recent_admin_action_authorization() then
    raise exception 'Confirm the Admin PIN before changing account status' using errcode = '42501';
  end if;

  if target_status not in ('active', 'suspended') then
    raise exception 'Unsupported account status';
  end if;

  update public.app_users
  set status = target_status, updated_at = now()
  where id = target_user_id
  returning * into result;

  if result.id is null then
    raise exception 'Account not found';
  end if;

  if result.role = 'dispatch' then
    update public.rider_profiles
    set
      status = case when target_status = 'active' then 'active' else 'suspended' end,
      updated_at = now()
    where auth_user_id::text = result.id;
  end if;

  insert into public.audit_logs (id, actor_id, actor_name, actor_role, action, details)
  select
    'audit-user-status-' || replace(gen_random_uuid()::text, '-', ''),
    auth.uid(),
    admins.full_name,
    admins.role,
    case when target_status = 'suspended' then 'User suspended' else 'User restored' end,
    result.full_name || ' was marked ' || target_status || '.'
  from public.admin_users as admins
  where admins.auth_user_id = auth.uid();

  return result;
end;
$$;

revoke all on function public.admin_set_app_user_status(text, text) from public, anon;
grant execute on function public.admin_set_app_user_status(text, text) to authenticated;

create or replace function public.staff_reply_to_support(
  target_conversation_id text,
  target_message_id text,
  reply_text text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.admin_users%rowtype;
  conversation public.support_messages%rowtype;
begin
  if not public.is_view2connect_staff(array['owner', 'admin', 'customerCare']) then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;
  if not public.has_recent_admin_action_authorization() then
    raise exception 'Confirm the Admin PIN before replying' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(reply_text, '')), '') is null then
    raise exception 'A reply is required';
  end if;

  select * into actor from public.admin_users
  where auth_user_id = auth.uid() and is_active = true;
  select * into conversation from public.support_messages
  where conversation_id = target_conversation_id
  order by created_at asc
  limit 1;
  if conversation.id is null then raise exception 'Support conversation not found'; end if;

  insert into public.support_messages (
    id, conversation_id, user_id, user_name, user_role,
    sender_name, sender_role, text, created_at
  ) values (
    target_message_id,
    target_conversation_id,
    conversation.user_id,
    conversation.user_name,
    conversation.user_role,
    actor.full_name,
    actor.role,
    trim(reply_text),
    now()
  ) on conflict (id) do nothing;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  ) values (
    'notification-support-reply-' || target_message_id,
    conversation.user_id,
    conversation.user_name,
    conversation.user_role,
    'Customer care replied',
    trim(reply_text),
    'general',
    target_conversation_id
  ) on conflict (id) do nothing;

  insert into public.audit_logs (
    id, actor_id, actor_name, actor_role, action, details
  ) values (
    'audit-support-reply-' || target_message_id,
    auth.uid(),
    actor.full_name,
    actor.role,
    'Support reply sent',
    'A reply was sent in support conversation ' || target_conversation_id || '.'
  ) on conflict (id) do nothing;

  return true;
end;
$$;

revoke all on function public.staff_reply_to_support(text, text, text) from public, anon;
grant execute on function public.staff_reply_to_support(text, text, text) to authenticated;

create or replace function public.mark_my_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()::text and read_at is null;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

revoke all on function public.mark_my_notifications_read() from public, anon;
grant execute on function public.mark_my_notifications_read() to authenticated;

create or replace function public.admin_review_store_application(
  target_user_id text,
  review_decision text,
  review_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  applicant public.app_users%rowtype;
  actor public.admin_users%rowtype;
  notification_title text;
begin
  if public.current_admin_role() <> 'owner' then
    raise exception 'Only the owner admin can review store applications' using errcode = '42501';
  end if;
  if not public.has_recent_admin_action_authorization() then
    raise exception 'Confirm the Admin PIN before reviewing store applications' using errcode = '42501';
  end if;
  if review_decision not in ('approved', 'changesRequested') then
    raise exception 'Unsupported store application decision';
  end if;
  if nullif(trim(coalesce(review_message, '')), '') is null then
    raise exception 'A review message is required';
  end if;

  select * into applicant
  from public.app_users
  where id = target_user_id and role = 'businessOwner'
  for update;
  if applicant.id is null then raise exception 'Store-owner account not found'; end if;

  select * into actor from public.admin_users where auth_user_id = auth.uid();
  notification_title := case
    when review_decision = 'approved' then 'Store application approved'
    else 'Store application changes requested'
  end;

  if review_decision = 'approved' then
    update public.app_users
    set status = 'active', river_park_verified = true, updated_at = now()
    where id = applicant.id;

    insert into public.owner_business_profiles (
      id, owner_user_id, account_name, account_email, owner_name,
      phone, whatsapp, email, address, river_park_verified, updated_at
    ) values (
      applicant.id,
      applicant.id,
      coalesce(nullif(trim(applicant.business_name), ''), applicant.full_name),
      applicant.email,
      coalesce(nullif(trim(applicant.business_name), ''), applicant.full_name),
      applicant.phone_number,
      applicant.phone_number,
      applicant.email,
      coalesce(applicant.business_cluster, ''),
      true,
      now()
    )
    on conflict (owner_user_id) do update set
      river_park_verified = true,
      updated_at = now();

    update public.businesses
    set river_park_verified = true, status = 'active', updated_at = now()
    where owner_user_id = applicant.id;
  end if;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body,
    context_type, context_id
  ) values (
    'notification-store-review-' || replace(gen_random_uuid()::text, '-', ''),
    applicant.id,
    applicant.full_name,
    'businessOwner',
    notification_title,
    trim(review_message),
    'general',
    'store-application-' || applicant.id
  );

  insert into public.audit_logs (
    id, actor_id, actor_name, actor_role, action, details
  ) values (
    'audit-store-review-' || replace(gen_random_uuid()::text, '-', ''),
    auth.uid(),
    actor.full_name,
    actor.role,
    notification_title,
    coalesce(nullif(trim(applicant.business_name), ''), applicant.full_name) || ': ' || trim(review_message)
  );

  return true;
end;
$$;

revoke all on function public.admin_review_store_application(text, text, text) from public, anon;
grant execute on function public.admin_review_store_application(text, text, text) to authenticated;

create or replace function public.admin_set_listing_verification(
  target_business_id text,
  target_verified boolean,
  admin_pin text
)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.admin_users%rowtype;
  result public.businesses%rowtype;
  target_audience text;
begin
  if not public.is_view2connect_staff(array['owner', 'customerCare']) then
    raise exception 'Listing moderation access is required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.admin_security_controls
    where id = 'default'
      and pin_hash = extensions.digest(convert_to(admin_pin, 'UTF8'), 'sha256')
  ) then
    raise exception 'Wrong admin PIN' using errcode = '42501';
  end if;

  select * into actor
  from public.admin_users
  where auth_user_id = auth.uid() and is_active = true;

  update public.businesses
  set verified = target_verified,
      status = 'active',
      updated_at = now()
  where id = target_business_id
  returning * into result;

  if result.id is null then
    raise exception 'Listing not found';
  end if;

  target_audience := case
    when result.listing_source = 'customerAccount' or result.listing_audience = 'customerAdvert'
      then 'resident'
    else 'businessOwner'
  end;

  if result.owner_user_id is not null then
    insert into public.notifications (
      id, user_id, user_name, audience, title, body, context_type, context_id
    ) values (
      'notification-listing-review-' || replace(gen_random_uuid()::text, '-', ''),
      result.owner_user_id,
      result.owner_name,
      target_audience,
      case when target_verified then 'Listing approved' else 'Listing returned to pending' end,
      case
        when target_verified then result.name || ' has been approved and can now appear in View2Connect.'
        else result.name || ' was moved back to pending. Please contact customer care for more information.'
      end,
      'listing',
      result.id
    );
  end if;

  insert into public.audit_logs (id, actor_id, actor_name, actor_role, action, details)
  values (
    'audit-listing-review-' || replace(gen_random_uuid()::text, '-', ''),
    auth.uid(),
    actor.full_name,
    actor.role,
    case when target_verified then 'Listing verified' else 'Listing verification revoked' end,
    result.name || ' was marked ' || case when target_verified then 'verified.' else 'pending.' end
  );

  return result;
end;
$$;

revoke all on function public.admin_set_listing_verification(text, boolean, text) from public, anon;
grant execute on function public.admin_set_listing_verification(text, boolean, text) to authenticated;

create or replace function public.sync_owner_profile_listing_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.businesses
  set owner_name = coalesce(nullif(trim(new.owner_name), ''), owner_name),
      owner_email = coalesce(nullif(trim(new.email), ''), owner_email),
      address = coalesce(nullif(trim(new.address), ''), address),
      contact =
        (coalesce(contact, '{}'::jsonb) - array[
          'phone', 'email', 'whatsapp', 'website', 'instagram', 'facebook', 'x', 'tiktok'
        ])
        || jsonb_strip_nulls(jsonb_build_object(
          'phone', nullif(trim(new.phone), ''),
          'email', nullif(trim(new.email), ''),
          'whatsapp', nullif(trim(new.whatsapp), ''),
          'website', nullif(trim(new.website), ''),
          'instagram', nullif(trim(new.instagram), ''),
          'facebook', nullif(trim(new.facebook), ''),
          'x', nullif(trim(new.x), ''),
          'tiktok', nullif(trim(new.tiktok), '')
        )),
      updated_at = now()
  where owner_user_id = new.owner_user_id;

  return new;
end;
$$;

drop trigger if exists sync_owner_profile_listing_contact on public.owner_business_profiles;
create trigger sync_owner_profile_listing_contact
after insert or update of owner_name, phone, whatsapp, email, website, instagram, facebook, x, tiktok, address
on public.owner_business_profiles
for each row execute function public.sync_owner_profile_listing_contact();

create or replace function public.admin_update_order_status(
  target_order_id text,
  target_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders%rowtype;
  line public.order_items%rowtype;
begin
  if not public.is_view2connect_staff(array['owner', 'admin', 'customerCare']) then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;
  if not public.has_recent_admin_action_authorization() then
    raise exception 'Confirm the Admin PIN before changing an order' using errcode = '42501';
  end if;

  if target_status not in ('placed', 'packed', 'outForDelivery', 'delivered', 'cancelled') then
    raise exception 'Unsupported order status';
  end if;

  select * into target_order from public.orders where id = target_order_id for update;
  if target_order.id is null then raise exception 'Order not found'; end if;
  if target_order.status = target_status then return true; end if;

  if target_status <> 'cancelled' and target_order.payment_status <> 'paid' then
    raise exception 'Only paid orders can move through fulfilment';
  end if;

  if not (
    (target_order.status = 'placed' and target_status in ('packed', 'cancelled'))
    or (target_order.status = 'packed' and target_status in ('outForDelivery', 'cancelled'))
    or (target_order.status = 'outForDelivery' and target_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Invalid order status transition from % to %', target_order.status, target_status;
  end if;

  if target_status = 'cancelled' and target_order.payment_status = 'paid'
    and target_order.inventory_restored_at is null then
    for line in select * from public.order_items where order_id = target_order_id
    loop
      update public.businesses
      set stock_quantity = stock_quantity + line.quantity, updated_at = now()
      where id = line.business_id;
    end loop;
  end if;

  update public.orders
  set
    status = target_status,
    payment_status = case
      when target_status = 'cancelled' and payment_status = 'paid' then 'refundPending'
      else payment_status
    end,
    inventory_restored_at = case
      when target_status = 'cancelled' then coalesce(inventory_restored_at, now())
      else inventory_restored_at
    end,
    updated_at = now()
  where id = target_order_id;

  insert into public.order_timeline_events (id, order_id, status, label, note)
  values (
    gen_random_uuid()::text,
    target_order_id,
    target_status,
    case target_status
      when 'packed' then 'Packed by seller'
      when 'outForDelivery' then 'Out for delivery'
      when 'delivered' then 'Delivered'
      else 'Order cancelled'
    end,
    case
      when target_status = 'cancelled' and target_order.payment_status = 'paid'
        then 'Inventory was restored and the payment requires a provider refund.'
      else 'Order progress was updated by authorized staff.'
    end
  );

  insert into public.notifications (
    id, user_id, user_name, audience, title, body,
    context_type, context_id
  ) values (
    'notification-order-status-' || target_order_id || '-' || target_status,
    target_order.user_id,
    target_order.user_name,
    'resident',
    case
      when target_status = 'packed' then 'Order packed'
      when target_status = 'outForDelivery' then 'Order out for delivery'
      when target_status = 'delivered' then 'Order delivered'
      else 'Order cancelled'
    end,
    case
      when target_status = 'cancelled' and target_order.payment_status = 'paid'
        then 'Your order was cancelled and its payment is pending a refund.'
      else 'Order ' || target_order_id || ' is now ' || target_status || '.'
    end,
    'order',
    target_order_id
  ) on conflict (id) do nothing;

  return true;
end;
$$;

revoke all on function public.admin_update_order_status(text, text) from public, anon;
grant execute on function public.admin_update_order_status(text, text) to authenticated;

create or replace function public.finalize_order_refund(
  target_order_id text,
  target_refund_reference text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders%rowtype;
  original_transaction_id uuid;
  refund_transaction_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization required' using errcode = '42501';
  end if;

  select * into target_order from public.orders where id = target_order_id for update;
  if target_order.id is null then raise exception 'Order not found'; end if;
  if target_order.payment_status = 'refunded' then return true; end if;
  if target_order.payment_status <> 'refundPending' then
    raise exception 'Order is not awaiting a refund';
  end if;

  select id into original_transaction_id
  from public.wallet_transactions
  where order_id = target_order_id and kind = 'orderPayment' and status = 'posted'
  order by created_at asc
  limit 1;
  if original_transaction_id is null then
    raise exception 'Original order ledger transaction not found';
  end if;

  insert into public.wallet_transactions (reference, kind, order_id, metadata)
  values (
    'flutterwave-refund:' || target_refund_reference,
    'refund',
    target_order_id,
    jsonb_build_object('provider', 'flutterwave', 'refundReference', target_refund_reference)
  )
  on conflict (reference) do nothing
  returning id into refund_transaction_id;

  if refund_transaction_id is null then
    select id into refund_transaction_id from public.wallet_transactions
    where reference = 'flutterwave-refund:' || target_refund_reference;
  end if;

  insert into public.wallet_ledger_entries (transaction_id, account_id, amount)
  select refund_transaction_id, account_id, -amount
  from public.wallet_ledger_entries
  where transaction_id = original_transaction_id
  on conflict (transaction_id, account_id) do nothing;

  update public.orders
  set
    payment_status = 'refunded',
    refund_status = 'completed',
    refund_provider_reference = target_refund_reference,
    refunded_at = now(),
    updated_at = now()
  where id = target_order_id;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  ) values (
    'notification-order-refunded-' || target_order_id,
    target_order.user_id,
    target_order.user_name,
    'resident',
    'Refund completed',
    'Flutterwave completed the refund for order ' || target_order_id || '.',
    'order',
    target_order_id
  ) on conflict (id) do nothing;

  insert into public.audit_logs (id, actor_name, actor_role, action, details)
  values (
    'audit-order-refunded-' || target_order_id,
    'Flutterwave webhook',
    'system',
    'Order refund completed',
    'Order ' || target_order_id || ' was refunded and its ledger entries were reversed.'
  ) on conflict (id) do nothing;

  return true;
end;
$$;

revoke all on function public.finalize_order_refund(text, text) from public, anon, authenticated;
grant execute on function public.finalize_order_refund(text, text) to service_role;

drop policy if exists delivery_jobs_authorized_read on public.delivery_jobs;
create policy delivery_jobs_authorized_read on public.delivery_jobs for select to authenticated
using (
  public.is_view2connect_staff(array['owner', 'admin', 'customerCare'])
  or (
    public.current_app_role() = 'dispatch'
    and ((status = 'available' and seller_ready_at is not null) or rider_user_id = auth.uid())
  )
  or public.can_access_order(order_id)
);

create or replace function public.seller_mark_order_ready(target_order_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders%rowtype;
  affected_count integer;
  all_ready boolean;
begin
  if auth.uid() is null or public.current_app_role() <> 'businessOwner' then
    raise exception 'A store-owner account is required' using errcode = '42501';
  end if;

  select * into target_order from public.orders where id = target_order_id for update;
  if target_order.id is null then raise exception 'Order not found'; end if;
  if target_order.payment_status <> 'paid' or target_order.status not in ('placed', 'packed') then
    raise exception 'Only paid orders awaiting collection can be marked ready';
  end if;

  update public.delivery_jobs
  set seller_ready_at = coalesce(seller_ready_at, now()), updated_at = now()
  where order_id = target_order_id
    and seller_user_id = auth.uid()::text
    and status = 'available';
  get diagnostics affected_count = row_count;

  if affected_count = 0 and not exists (
    select 1 from public.delivery_jobs
    where order_id = target_order_id and seller_user_id = auth.uid()::text and seller_ready_at is not null
  ) then
    raise exception 'No seller delivery job was found for this order';
  end if;

  select not exists (
    select 1 from public.delivery_jobs
    where order_id = target_order_id and seller_ready_at is null and status <> 'cancelled'
  ) into all_ready;

  if all_ready and target_order.status = 'placed' then
    update public.orders set status = 'packed', updated_at = now() where id = target_order_id;
    insert into public.order_timeline_events (id, order_id, status, label, note)
    values (
      gen_random_uuid()::text,
      target_order_id,
      'packed',
      'Ready for dispatch',
      'Every seller has prepared their items for collection.'
    );
  end if;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body,
    context_type, context_id
  )
  select
    'notification-order-ready-dispatch-' || target_order_id || '-' || riders.id,
    riders.id,
    riders.full_name,
    'dispatch',
    'Delivery available',
    'A seller has prepared items for order ' || target_order_id || '.',
    'order',
    target_order_id
  from public.app_users as riders
  where riders.role = 'dispatch' and riders.status = 'active'
  on conflict (id) do nothing;

  return all_ready;
end;
$$;

revoke all on function public.seller_mark_order_ready(text) from public, anon;
grant execute on function public.seller_mark_order_ready(text) to authenticated;

create or replace function public.rider_accept_delivery_job(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.delivery_jobs;
  target_order public.orders%rowtype;
begin
  if not public.is_active_dispatch_rider() then
    raise exception 'Complete dispatch verification before accepting deliveries' using errcode = '42501';
  end if;
  update public.delivery_jobs
  set rider_user_id = auth.uid(), status = 'accepted', accepted_at = now(), updated_at = now()
  where id = target_job_id
    and status = 'available'
    and seller_ready_at is not null
    and rider_user_id is null
  returning * into result;
  if result.id is null then raise exception 'Delivery job is not ready or is no longer available'; end if;

  select * into target_order from public.orders where id = result.order_id;
  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  ) values (
    'notification-delivery-accepted-buyer-' || result.id,
    target_order.user_id,
    target_order.user_name,
    'resident',
    'Dispatch rider assigned',
    'A rider accepted the delivery from ' || result.seller_name || ' for order ' || result.order_id || '.',
    'order',
    result.order_id
  ) on conflict (id) do nothing;

  if result.seller_user_id is not null then
    insert into public.notifications (
      id, user_id, user_name, audience, title, body, context_type, context_id
    ) values (
      'notification-delivery-accepted-seller-' || result.id,
      result.seller_user_id,
      result.seller_name,
      case when result.seller_type = 'individualSeller' then 'resident' else 'businessOwner' end,
      'Rider assigned',
      'A dispatch rider accepted your pickup for order ' || result.order_id || '.',
      'order',
      result.order_id
    ) on conflict (id) do nothing;
  end if;

  return result;
end;
$$;

revoke all on function public.rider_accept_delivery_job(text) from public, anon;
grant execute on function public.rider_accept_delivery_job(text) to authenticated;

create or replace function public.rider_mark_delivery_picked_up(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.delivery_jobs;
  target_order public.orders%rowtype;
  all_jobs_in_transit boolean;
begin
  if not public.is_active_dispatch_rider() then
    raise exception 'An active dispatch rider account is required' using errcode = '42501';
  end if;

  update public.delivery_jobs
  set status = 'pickedUp', picked_up_at = now(), updated_at = now()
  where id = target_job_id
    and rider_user_id = auth.uid()
    and status = 'accepted'
  returning * into result;
  if result.id is null then raise exception 'Accepted delivery job not found'; end if;

  select * into target_order from public.orders where id = result.order_id for update;
  select not exists (
    select 1 from public.delivery_jobs
    where order_id = result.order_id
      and status not in ('pickedUp', 'awaitingBuyerConfirmation', 'completed', 'cancelled')
  ) into all_jobs_in_transit;

  if all_jobs_in_transit and target_order.status = 'packed' then
    update public.orders set status = 'outForDelivery', updated_at = now()
    where id = result.order_id;
    insert into public.order_timeline_events (id, order_id, status, label, note)
    values (
      'timeline-dispatch-picked-up-' || result.order_id,
      result.order_id,
      'outForDelivery',
      'Out for delivery',
      'All seller pickups for this order are now in transit.'
    ) on conflict (id) do nothing;
  end if;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  ) values (
    'notification-delivery-picked-up-' || result.id,
    target_order.user_id,
    target_order.user_name,
    'resident',
    'Order picked up',
    'Your items from ' || result.seller_name || ' are on the way.',
    'order',
    result.order_id
  ) on conflict (id) do nothing;

  return result;
end;
$$;

create or replace function public.rider_mark_delivery_arrived(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.delivery_jobs;
  target_order public.orders%rowtype;
begin
  if not public.is_active_dispatch_rider() then
    raise exception 'An active dispatch rider account is required' using errcode = '42501';
  end if;

  update public.delivery_jobs
  set status = 'awaitingBuyerConfirmation', rider_confirmed_at = now(), updated_at = now()
  where id = target_job_id
    and rider_user_id = auth.uid()
    and status = 'pickedUp'
  returning * into result;
  if result.id is null then raise exception 'Picked-up delivery job not found'; end if;

  select * into target_order from public.orders where id = result.order_id;
  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  ) values (
    'notification-delivery-arrived-' || result.id,
    target_order.user_id,
    target_order.user_name,
    'resident',
    'Rider has arrived',
    'Confirm receipt of the delivery from ' || result.seller_name || ' in your order details.',
    'order',
    result.order_id
  ) on conflict (id) do nothing;

  return result;
end;
$$;

create or replace function public.buyer_confirm_delivery(target_job_id text)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.delivery_jobs;
  target_order public.orders%rowtype;
  all_jobs_completed boolean;
begin
  if auth.uid() is null or public.current_app_role() <> 'resident' then
    raise exception 'A customer account is required' using errcode = '42501';
  end if;

  update public.delivery_jobs
  set
    buyer_confirmed_at = now(),
    status = 'completed',
    completed_at = now(),
    seller_release_status = 'available',
    updated_at = now()
  where id = target_job_id
    and status = 'awaitingBuyerConfirmation'
    and rider_confirmed_at is not null
    and exists (
      select 1 from public.orders
      where orders.id = delivery_jobs.order_id
        and orders.user_id = auth.uid()::text
    )
  returning * into result;
  if result.id is null then raise exception 'Delivery is not ready for buyer confirmation'; end if;

  select * into target_order from public.orders where id = result.order_id for update;
  select not exists (
    select 1 from public.delivery_jobs
    where order_id = result.order_id and status <> 'completed'
  ) into all_jobs_completed;

  if all_jobs_completed and target_order.status in ('packed', 'outForDelivery') then
    update public.orders set status = 'delivered', updated_at = now()
    where id = result.order_id and payment_status = 'paid';
    insert into public.order_timeline_events (id, order_id, status, label, note)
    values (
      'timeline-buyer-confirmed-' || result.order_id,
      result.order_id,
      'delivered',
      'Delivery confirmed',
      'The buyer confirmed receipt of every delivery in this order.'
    ) on conflict (id) do nothing;
  end if;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  ) values (
    'notification-delivery-confirmed-buyer-' || result.id,
    target_order.user_id,
    target_order.user_name,
    'resident',
    'Delivery confirmed',
    'You confirmed the delivery from ' || result.seller_name || '.',
    'order',
    result.order_id
  ) on conflict (id) do nothing;

  if result.seller_user_id is not null then
    insert into public.notifications (
      id, user_id, user_name, audience, title, body, context_type, context_id
    ) values (
      'notification-delivery-confirmed-seller-' || result.id,
      result.seller_user_id,
      result.seller_name,
      case when result.seller_type = 'individualSeller' then 'resident' else 'businessOwner' end,
      'Delivery completed',
      'The buyer confirmed delivery for order ' || result.order_id || '. Your earnings are now available.',
      'order',
      result.order_id
    ) on conflict (id) do nothing;
  end if;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  )
  select
    'notification-delivery-confirmed-rider-' || result.id,
    result.rider_user_id::text,
    riders.full_name,
    'dispatch',
    'Delivery completed',
    'The buyer confirmed delivery for order ' || result.order_id || '.',
    'order',
    result.order_id
  from public.rider_profiles as riders
  where riders.auth_user_id = result.rider_user_id
  on conflict (id) do nothing;

  return result;
end;
$$;

revoke all on function public.rider_mark_delivery_picked_up(text) from public, anon;
revoke all on function public.rider_mark_delivery_arrived(text) from public, anon;
revoke all on function public.buyer_confirm_delivery(text) from public, anon;
grant execute on function public.rider_mark_delivery_picked_up(text) to authenticated;
grant execute on function public.rider_mark_delivery_arrived(text) to authenticated;
grant execute on function public.buyer_confirm_delivery(text) to authenticated;

create or replace function public.seller_available_withdrawal_balance(target_user_id text)
returns numeric
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  delivered_earnings numeric(14, 2) := 0;
  committed_withdrawals numeric(14, 2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_user_id <> auth.uid()::text and not public.is_view2connect_staff(array['owner', 'admin', 'customerCare']) then
    raise exception 'Not authorized to view this balance' using errcode = '42501';
  end if;

  with seller_order_totals as (
    select
      orders.id,
      orders.subtotal,
      orders.seller_packing_support,
      sum(items.line_total)::numeric(14, 2) as seller_subtotal
    from public.orders
    join public.order_items as items on items.order_id = orders.id
    where items.owner_user_id = target_user_id
      and orders.payment_status = 'paid'
      and orders.status = 'delivered'
    group by orders.id, orders.subtotal, orders.seller_packing_support
  )
  select coalesce(sum(
    seller_subtotal + case
      when subtotal > 0 then round(seller_packing_support * seller_subtotal / subtotal, 2)
      else 0
    end
  ), 0)
  into delivered_earnings
  from seller_order_totals;

  select coalesce(sum(amount), 0)
  into committed_withdrawals
  from public.withdrawal_requests
  where owner_user_id = target_user_id
    and status in ('pending', 'processing', 'paid');

  return greatest(0, delivered_earnings - committed_withdrawals);
end;
$$;

revoke all on function public.seller_available_withdrawal_balance(text) from public, anon;
grant execute on function public.seller_available_withdrawal_balance(text) to authenticated;

create or replace function public.request_seller_withdrawal(requested_amount numeric)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller public.app_users%rowtype;
  payout public.owner_business_profiles%rowtype;
  settings public.security_settings%rowtype;
  available_balance numeric(14, 2);
  result public.withdrawal_requests%rowtype;
begin
  if auth.uid() is null or public.current_app_role() <> 'businessOwner' then
    raise exception 'An active store-owner account is required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select * into seller
  from public.app_users
  where id = auth.uid()::text and role = 'businessOwner' and status = 'active';

  if seller.id is null then
    raise exception 'Your store-owner account is not active' using errcode = '42501';
  end if;

  select * into payout
  from public.owner_business_profiles
  where owner_user_id = seller.id
  order by updated_at desc nulls last
  limit 1;

  if payout.owner_user_id is null
    or payout.payout_verified_at is null
    or nullif(trim(coalesce(payout.payout_bank_name, '')), '') is null
    or nullif(trim(coalesce(payout.payout_account_number, '')), '') is null
    or nullif(trim(coalesce(payout.payout_account_name, '')), '') is null then
    raise exception 'Verify and save a payout bank account before withdrawing';
  end if;

  select * into settings from public.security_settings where id = 'default';

  if requested_amount < coalesce(settings.minimum_withdrawal_amount, 1000) then
    raise exception 'The minimum withdrawal is %', coalesce(settings.minimum_withdrawal_amount, 1000);
  end if;

  if requested_amount > coalesce(settings.maximum_withdrawal_amount, 1000000) then
    raise exception 'The maximum withdrawal is %', coalesce(settings.maximum_withdrawal_amount, 1000000);
  end if;

  available_balance := public.seller_available_withdrawal_balance(seller.id);
  if requested_amount > available_balance then
    raise exception 'Withdrawal amount exceeds the available delivered earnings balance';
  end if;

  insert into public.withdrawal_requests (
    id, owner_user_id, owner_name, owner_email, bank_name, account_number,
    account_name, kyc_type, kyc_last4, kyc_reference, amount, status
  ) values (
    'withdrawal-' || replace(gen_random_uuid()::text, '-', ''),
    seller.id,
    coalesce(nullif(trim(payout.owner_name), ''), seller.full_name),
    seller.email,
    payout.payout_bank_name,
    payout.payout_account_number,
    payout.payout_account_name,
    'bvn',
    right(regexp_replace(payout.payout_account_number, '\D', '', 'g'), 4),
    'Payout account verified by Flutterwave',
    round(requested_amount, 2),
    'pending'
  ) returning * into result;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body,
    context_type, context_id
  ) values (
    'notification-withdrawal-' || result.id,
    seller.id,
    seller.full_name,
    'businessOwner',
    'Withdrawal submitted',
    'Your withdrawal request is pending payout review.',
    'general',
    result.id
  ) on conflict (id) do nothing;

  return result;
end;
$$;

revoke all on function public.request_seller_withdrawal(numeric) from public, anon;
grant execute on function public.request_seller_withdrawal(numeric) to authenticated;

create or replace function public.admin_update_withdrawal_status(
  target_withdrawal_id text,
  target_status text,
  target_provider_reference text default null,
  target_failure_reason text default null
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.withdrawal_requests%rowtype;
  result public.withdrawal_requests%rowtype;
  transaction_id uuid;
  seller_account_id uuid;
  clearing_account_id uuid;
begin
  if public.current_admin_role() <> 'owner' then
    raise exception 'Only the owner admin can process withdrawals' using errcode = '42501';
  end if;
  if not public.has_recent_admin_action_authorization() then
    raise exception 'Confirm the Admin PIN before processing withdrawals' using errcode = '42501';
  end if;

  if target_status not in ('processing', 'paid', 'failed', 'reversed') then
    raise exception 'Unsupported withdrawal status';
  end if;

  select * into existing
  from public.withdrawal_requests
  where id = target_withdrawal_id
  for update;

  if existing.id is null then raise exception 'Withdrawal not found'; end if;
  if existing.status = 'paid' and target_status <> 'reversed' then
    raise exception 'A paid withdrawal cannot be changed';
  end if;
  if target_status = 'paid' and nullif(trim(coalesce(target_provider_reference, '')), '') is null then
    raise exception 'A payout provider reference is required before marking this withdrawal paid';
  end if;

  update public.withdrawal_requests
  set
    status = target_status,
    provider_reference = nullif(trim(coalesce(target_provider_reference, provider_reference)), ''),
    failure_reason = nullif(trim(coalesce(target_failure_reason, '')), ''),
    updated_at = now()
  where id = target_withdrawal_id
  returning * into result;

  if target_status = 'paid' and existing.status <> 'paid' then
    insert into public.wallet_accounts (user_id, account_type, currency)
    values (existing.owner_user_id, 'seller', 'NGN')
    on conflict (user_id, account_type, currency) do nothing;
    select id into seller_account_id from public.wallet_accounts
    where user_id = existing.owner_user_id and account_type = 'seller' and currency = 'NGN';

    insert into public.wallet_accounts (user_id, account_type, currency)
    values (null, 'clearing', 'NGN')
    on conflict (user_id, account_type, currency) do nothing;
    select id into clearing_account_id from public.wallet_accounts
    where user_id is null and account_type = 'clearing' and currency = 'NGN';

    insert into public.wallet_transactions (reference, kind, status, metadata)
    values (
      'withdrawal:' || existing.id,
      'withdrawal',
      'posted',
      jsonb_build_object('providerReference', target_provider_reference)
    )
    on conflict (reference) do nothing
    returning id into transaction_id;

    if transaction_id is not null then
      insert into public.wallet_ledger_entries (transaction_id, account_id, amount)
      values
        (transaction_id, seller_account_id, -existing.amount),
        (transaction_id, clearing_account_id, existing.amount);
    end if;
  end if;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body,
    context_type, context_id
  ) values (
    'notification-withdrawal-' || result.id || '-' || target_status,
    result.owner_user_id,
    result.owner_name,
    'businessOwner',
    case
      when target_status = 'processing' then 'Withdrawal processing'
      when target_status = 'paid' then 'Withdrawal paid'
      when target_status = 'failed' then 'Withdrawal needs attention'
      else 'Withdrawal reversed'
    end,
    case
      when target_status = 'processing' then 'Your payout is being processed.'
      when target_status = 'paid' then 'Your payout has been sent to your verified bank account.'
      when target_status = 'failed' then coalesce(nullif(trim(target_failure_reason), ''), 'The payout could not be completed.')
      else 'The payout was reversed. Contact support if you need help.'
    end,
    'general',
    result.id
  ) on conflict (id) do nothing;

  return result;
end;
$$;

revoke all on function public.admin_update_withdrawal_status(text, text, text, text) from public, anon;
grant execute on function public.admin_update_withdrawal_status(text, text, text, text) to authenticated;

create or replace function public.sync_paid_order_side_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    delete from public.customer_cart_items as cart
    where cart.user_id = new.user_id
      and exists (
        select 1 from public.order_items as items
        where items.order_id = new.id and items.business_id = cart.business_id
      );

    insert into public.notifications (
      id, user_id, user_name, audience, title, body,
      context_type, context_id
    ) values (
      'notification-order-paid-buyer-' || new.id,
      new.user_id,
      new.user_name,
      'resident',
      'Payment confirmed',
      'Your order ' || new.id || ' is paid and has been sent to the seller.',
      'order',
      new.id
    ) on conflict (id) do nothing;

    insert into public.notifications (
      id, user_id, user_name, audience, title, body,
      context_type, context_id
    )
    select
      'notification-order-paid-seller-' || new.id || '-' || sellers.owner_user_id,
      sellers.owner_user_id,
      sellers.owner_name,
      'businessOwner',
      'New paid order',
      'Order ' || new.id || ' is paid. Prepare the purchased items for collection.',
      'order',
      new.id
    from (
      select owner_user_id, max(owner_name) as owner_name
      from public.order_items
      where order_id = new.id and owner_user_id is not null
      group by owner_user_id
    ) as sellers
    join public.app_users as users on users.id = sellers.owner_user_id
    on conflict (id) do nothing;

  end if;

  return new;
end;
$$;

drop trigger if exists sync_paid_order_side_effects on public.orders;
create trigger sync_paid_order_side_effects
after update of payment_status on public.orders
for each row execute function public.sync_paid_order_side_effects();

create or replace function public.credit_paid_dynamic_deposit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_id uuid;
  customer_account_id uuid;
  clearing_account_id uuid;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    insert into public.wallet_accounts (user_id, account_type, currency)
    values (new.user_id, 'customer', 'NGN')
    on conflict (user_id, account_type, currency) do nothing;
    select id into customer_account_id from public.wallet_accounts
    where user_id = new.user_id and account_type = 'customer' and currency = 'NGN';

    insert into public.wallet_accounts (user_id, account_type, currency)
    values (null, 'clearing', 'NGN')
    on conflict (user_id, account_type, currency) do nothing;
    select id into clearing_account_id from public.wallet_accounts
    where user_id is null and account_type = 'clearing' and currency = 'NGN';

    insert into public.wallet_transactions (reference, kind, status, metadata)
    values (
      'deposit:' || new.reference,
      'deposit',
      'posted',
      jsonb_build_object('provider', new.provider, 'providerReference', new.provider_reference)
    )
    on conflict (reference) do nothing
    returning id into transaction_id;

    if transaction_id is not null then
      insert into public.wallet_ledger_entries (transaction_id, account_id, amount)
      values
        (transaction_id, customer_account_id, new.amount),
        (transaction_id, clearing_account_id, -new.amount);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists credit_paid_dynamic_deposit on public.dynamic_deposit_accounts;
create trigger credit_paid_dynamic_deposit
after update of status on public.dynamic_deposit_accounts
for each row execute function public.credit_paid_dynamic_deposit();

create or replace function public.set_my_catalog_management_access(allowed boolean)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.app_users%rowtype;
  result public.notifications%rowtype;
begin
  select * into account
  from public.app_users
  where id = auth.uid()::text
    and role = 'businessOwner'
    and status = 'active';

  if not found then
    raise exception 'Only an active store owner can change catalog access' using errcode = '42501';
  end if;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body,
    context_type, context_id, created_at, read_at
  ) values (
    'notification-catalog-management-' || account.id,
    account.id,
    account.full_name,
    'businessOwner',
    case when allowed then 'Catalog management access granted' else 'Catalog management access revoked' end,
    case
      when allowed then 'You allowed View2Connect Admin to create and update products for your store. You can revoke this permission from your seller profile.'
      else 'View2Connect Admin can no longer create or update products for your store.'
    end,
    'general',
    'catalog-management-' || account.id,
    now(),
    null
  )
  on conflict (id) do update set
    user_name = excluded.user_name,
    title = excluded.title,
    body = excluded.body,
    created_at = excluded.created_at,
    read_at = null
  returning * into result;

  insert into public.audit_logs (id, actor_name, actor_role, action, details, created_at)
  values (
    'audit-catalog-management-' || account.id || '-' || extract(epoch from now())::bigint,
    account.full_name,
    'businessOwner',
    case when allowed then 'Catalog management access granted' else 'Catalog management access revoked' end,
    coalesce(account.business_name, account.full_name) ||
      case when allowed then ' granted Admin catalog access.' else ' revoked Admin catalog access.' end,
    now()
  );

  return result;
end;
$$;

revoke all on function public.set_my_catalog_management_access(boolean) from public, anon;
grant execute on function public.set_my_catalog_management_access(boolean) to authenticated;

create or replace function public.admin_upsert_catalog_product(
  target_product jsonb,
  admin_pin text
)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_id text := nullif(trim(target_product->>'id'), '');
  product_name text := nullif(trim(target_product->>'name'), '');
  product_description text := nullif(trim(target_product->>'description'), '');
  product_image text := nullif(trim(target_product->>'image_url'), '');
  product_owner_id text := nullif(trim(target_product->>'owner_user_id'), '');
  product_estate_id text := nullif(trim(target_product->>'estate_id'), '');
  product_price numeric;
  product_tags text[];
  product_services text[];
  owner_account public.app_users%rowtype;
  owner_profile public.owner_business_profiles%rowtype;
  existing public.businesses%rowtype;
  result public.businesses%rowtype;
begin
  if public.current_admin_role() <> 'owner'
    or not coalesce(public.verify_admin_action_pin(admin_pin), false) then
    raise exception 'Confirm the owner Admin PIN before changing a catalog' using errcode = '42501';
  end if;

  begin
    product_price := (target_product->>'price')::numeric;
  exception when others then
    raise exception 'Enter a valid product price';
  end;

  if product_id is null or product_name is null or product_description is null
    or product_image is null or product_estate_id is null or product_price <= 0 then
    raise exception 'Complete the catalog product name, description, image, estate, and price';
  end if;

  if not exists (select 1 from public.estates where id = product_estate_id) then
    raise exception 'The selected estate does not exist';
  end if;

  select * into existing from public.businesses where id = product_id;
  if found and existing.listing_source <> 'adminCatalog'
    and not ('Admin managed catalog' = any(existing.tags)) then
    raise exception 'This listing is not an Admin-managed catalog product' using errcode = '42501';
  end if;

  if product_owner_id is not null then
    select * into owner_account
    from public.app_users
    where id = product_owner_id and role = 'businessOwner' and status = 'active';
    if not found then
      raise exception 'The selected store owner is not active';
    end if;

    if not exists (
      select 1 from public.notifications
      where user_id = product_owner_id
        and context_type = 'general'
        and context_id = 'catalog-management-' || product_owner_id
        and title = 'Catalog management access granted'
    ) then
      raise exception 'This store owner has not granted catalog management access' using errcode = '42501';
    end if;

    select * into owner_profile
    from public.owner_business_profiles
    where owner_user_id = product_owner_id
    limit 1;
  end if;

  select coalesce(array_agg(value), '{}'::text[])
  into product_tags
  from jsonb_array_elements_text(coalesce(target_product->'tags', '[]'::jsonb)) as entries(value);
  select coalesce(array_agg(value), '{}'::text[])
  into product_services
  from jsonb_array_elements_text(coalesce(target_product->'services', '[]'::jsonb)) as entries(value);

  if product_owner_id is not null and not ('Admin managed catalog' = any(product_tags)) then
    product_tags := array_append(product_tags, 'Admin managed catalog');
  elsif product_owner_id is null and not ('Central catalog' = any(product_tags)) then
    product_tags := array_append(product_tags, 'Central catalog');
  end if;

  insert into public.businesses (
    id, estate_id, listing_type, listing_source, listing_audience, status,
    subscription_cycle, subscription_status, verified_amount,
    subscription_paid_at, subscription_next_billing_at, subscription_item_count,
    name, owner_name, owner_user_id, owner_email, cluster, category,
    description, long_description, image_url, media, address, sku,
    stock_quantity, reorder_level, price, price_label, response_time,
    verified, river_park_verified, services, tags, contact, created_at, updated_at
  ) values (
    product_id,
    product_estate_id,
    'product',
    case when product_owner_id is null then 'adminCatalog' else 'sellerPortal' end,
    'storeProduct',
    case when product_owner_id is null then 'archived' else 'active' end,
    nullif(target_product->>'subscription_cycle', ''),
    coalesce(nullif(target_product->>'subscription_status', ''), 'active'),
    coalesce(nullif(target_product->>'verified_amount', '')::numeric, 0),
    nullif(target_product->>'subscription_paid_at', '')::timestamptz,
    nullif(target_product->>'subscription_next_billing_at', '')::timestamptz,
    coalesce(nullif(target_product->>'subscription_item_count', '')::integer, 0),
    product_name,
    case when product_owner_id is null then 'View2Connect Catalog' else owner_account.full_name end,
    product_owner_id,
    case when product_owner_id is null then 'catalog@view2connect.ng' else owner_account.email end,
    coalesce(
      case when product_owner_id is null then null else owner_account.business_cluster end,
      nullif(target_product->>'cluster', ''),
      'Nigeria'
    ),
    coalesce(nullif(target_product->>'category', ''), 'Food & Groceries'),
    product_description,
    coalesce(nullif(target_product->>'long_description', ''), product_description),
    product_image,
    case
      when jsonb_typeof(target_product->'media') = 'array' then target_product->'media'
      else '[]'::jsonb
    end,
    coalesce(
      case when product_owner_id is null then null else owner_profile.address end,
      nullif(target_product->>'address', ''),
      'Nigeria'
    ),
    nullif(target_product->>'sku', ''),
    greatest(coalesce(nullif(target_product->>'stock_quantity', '')::integer, 0), 0),
    greatest(coalesce(nullif(target_product->>'reorder_level', '')::integer, 0), 0),
    product_price,
    nullif(target_product->>'price_label', ''),
    coalesce(nullif(target_product->>'response_time', ''), 'Available from participating stores'),
    case when product_owner_id is null then false else coalesce(owner_account.river_park_verified, false) end,
    case when product_owner_id is null then false else coalesce(owner_account.river_park_verified, false) end,
    product_services,
    product_tags,
    coalesce(target_product->'contact', '{}'::jsonb),
    coalesce(existing.created_at, now()),
    now()
  )
  on conflict (id) do update set
    estate_id = excluded.estate_id,
    listing_type = excluded.listing_type,
    listing_source = excluded.listing_source,
    listing_audience = excluded.listing_audience,
    status = excluded.status,
    subscription_cycle = excluded.subscription_cycle,
    subscription_status = excluded.subscription_status,
    verified_amount = excluded.verified_amount,
    subscription_paid_at = excluded.subscription_paid_at,
    subscription_next_billing_at = excluded.subscription_next_billing_at,
    subscription_item_count = excluded.subscription_item_count,
    name = excluded.name,
    owner_name = excluded.owner_name,
    owner_user_id = excluded.owner_user_id,
    owner_email = excluded.owner_email,
    cluster = excluded.cluster,
    category = excluded.category,
    description = excluded.description,
    long_description = excluded.long_description,
    image_url = excluded.image_url,
    media = excluded.media,
    address = excluded.address,
    sku = excluded.sku,
    stock_quantity = excluded.stock_quantity,
    reorder_level = excluded.reorder_level,
    price = excluded.price,
    price_label = excluded.price_label,
    response_time = excluded.response_time,
    verified = excluded.verified,
    river_park_verified = excluded.river_park_verified,
    services = excluded.services,
    tags = excluded.tags,
    contact = excluded.contact,
    updated_at = excluded.updated_at
  returning * into result;

  insert into public.audit_logs (id, actor_name, actor_role, action, details, created_at)
  values (
    'audit-admin-catalog-' || product_id || '-' || extract(epoch from now())::bigint,
    coalesce((select full_name from public.admin_users where auth_user_id = auth.uid()), 'View2Connect Owner'),
    'owner',
    case when existing.id is null then 'Catalog product created' else 'Catalog product updated' end,
    product_name || case
      when product_owner_id is null then ' was saved to the central catalog.'
      else ' was saved to the seller-managed catalog.'
    end,
    now()
  );

  return result;
end;
$$;

revoke all on function public.admin_upsert_catalog_product(jsonb, text) from public, anon;
grant execute on function public.admin_upsert_catalog_product(jsonb, text) to authenticated;

alter table public.virtual_accounts
  add column if not exists id_document_path text,
  add column if not exists id_document_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'urbanconnect-private-documents',
  'urbanconnect-private-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists urbanconnect_private_documents_read on storage.objects;
create policy urbanconnect_private_documents_read on storage.objects for select to authenticated
using (
  bucket_id = 'urbanconnect-private-documents'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.is_view2connect_staff(array['owner', 'customerCare'])
  )
);

drop policy if exists urbanconnect_private_documents_insert on storage.objects;
create policy urbanconnect_private_documents_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'urbanconnect-private-documents'
  and (storage.foldername(name))[1] = 'seller-identity'
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists urbanconnect_private_documents_update on storage.objects;
create policy urbanconnect_private_documents_update on storage.objects for update to authenticated
using (
  bucket_id = 'urbanconnect-private-documents'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'urbanconnect-private-documents'
  and (storage.foldername(name))[1] = 'seller-identity'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists urbanconnect_private_documents_delete on storage.objects;
create policy urbanconnect_private_documents_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'urbanconnect-private-documents'
  and (storage.foldername(name))[2] = auth.uid()::text
);
