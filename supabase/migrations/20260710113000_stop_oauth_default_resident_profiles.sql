-- OAuth callbacks carry the intended portal in the redirect URL, not in
-- auth.raw_user_meta_data. Do not let the auth trigger create a resident
-- profile before the app can enforce the requested role.

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('resident', 'businessOwner', 'dispatch'));

create or replace function public.sync_auth_user_to_app_users()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_role text := nullif(trim(metadata->>'role'), '');
  normalized_email text := lower(coalesce(new.email, ''));
  first_name text;
  last_name text;
  full_name text;
begin
  if normalized_email = '' then
    return new;
  end if;

  if profile_role is null or profile_role not in ('resident', 'businessOwner', 'dispatch') then
    return new;
  end if;

  first_name := nullif(trim(coalesce(metadata->>'first_name', metadata->>'firstName', '')), '');
  last_name := nullif(trim(coalesce(metadata->>'last_name', metadata->>'lastName', '')), '');
  full_name := nullif(
    trim(
      coalesce(
        metadata->>'full_name',
        metadata->>'name',
        concat_ws(' ', first_name, last_name),
        split_part(normalized_email, '@', 1)
      )
    ),
    ''
  );

  if first_name is null and full_name is not null then
    first_name := split_part(full_name, ' ', 1);
  end if;

  if last_name is null and full_name is not null then
    last_name := nullif(trim(replace(full_name, coalesce(first_name, ''), '')), '');
  end if;

  insert into public.app_users (
    id,
    email,
    first_name,
    last_name,
    full_name,
    phone_number,
    password_hash,
    role,
    estate_id,
    business_name,
    business_cluster,
    river_park_verified,
    status,
    created_at,
    updated_at
  )
  values (
    new.id::text,
    normalized_email,
    coalesce(first_name, split_part(normalized_email, '@', 1)),
    coalesce(
      last_name,
      case
        when profile_role = 'businessOwner' then 'Seller'
        when profile_role = 'dispatch' then 'Dispatch'
        else 'Resident'
      end
    ),
    coalesce(full_name, split_part(normalized_email, '@', 1)),
    coalesce(nullif(trim(coalesce(new.phone, metadata->>'phone_number', metadata->>'phoneNumber', '')), ''), '+2340000000000'),
    'supabase-auth-managed',
    profile_role,
    coalesce(metadata->>'estate_id', metadata->>'estateId', 'river-park'),
    nullif(trim(coalesce(metadata->>'business_name', metadata->>'businessName', '')), ''),
    nullif(trim(coalesce(metadata->>'business_cluster', metadata->>'businessCluster', '')), ''),
    true,
    'active',
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (email) do update
  set
    first_name = coalesce(nullif(excluded.first_name, ''), public.app_users.first_name),
    last_name = coalesce(nullif(excluded.last_name, ''), public.app_users.last_name),
    full_name = coalesce(nullif(excluded.full_name, ''), public.app_users.full_name),
    phone_number = coalesce(nullif(excluded.phone_number, ''), public.app_users.phone_number),
    password_hash = 'supabase-auth-managed',
    estate_id = coalesce(nullif(excluded.estate_id, ''), public.app_users.estate_id),
    business_name = coalesce(excluded.business_name, public.app_users.business_name),
    business_cluster = coalesce(excluded.business_cluster, public.app_users.business_cluster),
    river_park_verified = public.app_users.river_park_verified or excluded.river_park_verified,
    status = 'active',
    updated_at = now();

  return new;
end;
$$;
