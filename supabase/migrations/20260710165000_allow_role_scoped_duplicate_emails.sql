-- Allow the same visible email/phone to be used in different roles while
-- keeping each role account tied to its own Supabase Auth identity.

alter table public.app_users
  add column if not exists auth_email text;

update public.app_users
set
  email = lower(trim(email)),
  auth_email = lower(trim(coalesce(nullif(auth_email, ''), email)))
where auth_email is null
   or auth_email = ''
   or email <> lower(trim(email))
   or auth_email <> lower(trim(auth_email));

alter table public.app_users
  alter column auth_email set not null;

alter table public.app_users
  drop constraint if exists app_users_email_key;

alter table public.app_users
  drop constraint if exists app_users_phone_number_key;

drop index if exists public.app_users_email_lower_unique;
drop index if exists public.app_users_email_role_unique;
drop index if exists public.app_users_phone_role_unique;

create unique index app_users_email_role_unique
  on public.app_users (lower(email), role);

create unique index app_users_phone_role_unique
  on public.app_users (lower(phone_number), role);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.app_users'::regclass
      and conname = 'app_users_auth_email_key'
  ) then
    alter table public.app_users
      add constraint app_users_auth_email_key unique (auth_email);
  end if;
end $$;

create or replace function public.sync_auth_user_to_app_users()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_role text := nullif(trim(metadata->>'role'), '');
  normalized_auth_email text := lower(coalesce(new.email, ''));
  visible_email text := lower(coalesce(nullif(trim(metadata->>'account_email'), ''), new.email, ''));
  first_name text;
  last_name text;
  full_name text;
begin
  if normalized_auth_email = '' or visible_email = '' then
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
        split_part(visible_email, '@', 1)
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
    auth_email,
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
    visible_email,
    normalized_auth_email,
    coalesce(first_name, split_part(visible_email, '@', 1)),
    coalesce(
      last_name,
      case
        when profile_role = 'businessOwner' then 'Seller'
        when profile_role = 'dispatch' then 'Dispatch'
        else 'Resident'
      end
    ),
    coalesce(full_name, split_part(visible_email, '@', 1)),
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
  on conflict (auth_email) do update
  set
    id = excluded.id,
    email = excluded.email,
    first_name = coalesce(nullif(excluded.first_name, ''), public.app_users.first_name),
    last_name = coalesce(nullif(excluded.last_name, ''), public.app_users.last_name),
    full_name = coalesce(nullif(excluded.full_name, ''), public.app_users.full_name),
    phone_number = coalesce(nullif(excluded.phone_number, ''), public.app_users.phone_number),
    password_hash = 'supabase-auth-managed',
    role = excluded.role,
    estate_id = coalesce(nullif(excluded.estate_id, ''), public.app_users.estate_id),
    business_name = coalesce(excluded.business_name, public.app_users.business_name),
    business_cluster = coalesce(excluded.business_cluster, public.app_users.business_cluster),
    river_park_verified = public.app_users.river_park_verified or excluded.river_park_verified,
    status = 'active',
    updated_at = now();

  return new;
end;
$$;
