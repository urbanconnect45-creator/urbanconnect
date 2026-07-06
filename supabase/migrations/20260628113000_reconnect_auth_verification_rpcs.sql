create extension if not exists pgcrypto with schema extensions;

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
set search_path = public, extensions
as $$
  select
    admins.id,
    admins.full_name,
    admins.email,
    admins.role,
    admins.is_active,
    admins.created_at
  from public.admin_users as admins
  where lower(admins.email) = lower(admin_email)
    and admins.password_hash = extensions.crypt(admin_password, admins.password_hash)
  limit 1;
$$;

revoke all on function public.verify_admin_login(text, text) from public;
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
  select users.*
  into target_user
  from public.app_users as users
  where users.id = set_river_park_verification.target_user_id
  limit 1;

  update public.app_users as users
  set
    river_park_verified = set_river_park_verification.verified,
    updated_at = now()
  where users.id = set_river_park_verification.target_user_id;

  update public.owner_business_profiles as profiles
  set
    river_park_verified = set_river_park_verification.verified,
    updated_at = now()
  where profiles.owner_user_id = set_river_park_verification.target_user_id
    or (
      target_user.email is not null
      and lower(profiles.account_email) = lower(target_user.email)
    )
    or (
      target_user.email is not null
      and lower(profiles.email) = lower(target_user.email)
    )
    or (
      target_user.full_name is not null
      and lower(profiles.account_name) = lower(target_user.full_name)
    )
    or (
      target_user.full_name is not null
      and lower(profiles.owner_name) = lower(target_user.full_name)
    );

  update public.businesses as listings
  set
    river_park_verified = set_river_park_verification.verified,
    updated_at = now()
  where listings.owner_user_id = set_river_park_verification.target_user_id
    or (
      target_user.email is not null
      and lower(listings.owner_email) = lower(target_user.email)
    )
    or (
      target_user.full_name is not null
      and lower(listings.owner_name) = lower(target_user.full_name)
    )
    or (
      target_user.business_name is not null
      and lower(listings.owner_name) = lower(target_user.business_name)
    );
end;
$$;

revoke all on function public.set_river_park_verification(text, boolean) from public;
grant execute on function public.set_river_park_verification(text, boolean) to anon, authenticated;
