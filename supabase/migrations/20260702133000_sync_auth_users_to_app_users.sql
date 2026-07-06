create or replace function public.sync_auth_user_to_app_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  metadata_name text := trim(coalesce(metadata ->> 'full_name', metadata ->> 'name', ''));
  first_name_value text;
  last_name_value text;
  role_value text;
  estate_value text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  first_name_value := trim(
    coalesce(
      metadata ->> 'first_name',
      metadata ->> 'firstName',
      nullif(split_part(metadata_name, ' ', 1), ''),
      'View2Connect'
    )
  );

  last_name_value := trim(
    coalesce(
      metadata ->> 'last_name',
      metadata ->> 'lastName',
      nullif(regexp_replace(metadata_name, '^\S+\s*', ''), ''),
      'User'
    )
  );

  role_value := case
    when metadata ->> 'role' = 'businessOwner' then 'businessOwner'
    when metadata ->> 'role' = 'dispatch' then 'dispatch'
    else 'resident'
  end;

  select estates.id
  into estate_value
  from public.estates
  where estates.id = coalesce(nullif(metadata ->> 'estate_id', ''), 'river-park')
  limit 1;

  if estate_value is null then
    select estates.id
    into estate_value
    from public.estates
    order by estates.created_at nulls last, estates.id
    limit 1;
  end if;

  insert into public.app_users (
    id,
    first_name,
    last_name,
    full_name,
    email,
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
  ) values (
    new.id::text,
    first_name_value,
    last_name_value,
    coalesce(nullif(metadata_name, ''), trim(first_name_value || ' ' || last_name_value)),
    lower(coalesce(new.email, new.id::text || '@profile.invalid')),
    coalesce(
      nullif(new.phone, ''),
      nullif(metadata ->> 'phone_number', ''),
      'oauth-' || new.id::text
    ),
    'supabase-auth-managed',
    role_value,
    estate_value,
    nullif(metadata ->> 'business_name', ''),
    nullif(metadata ->> 'business_cluster', ''),
    role_value = 'resident',
    'active',
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (email) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    role = excluded.role,
    business_name = coalesce(excluded.business_name, public.app_users.business_name),
    business_cluster = coalesce(excluded.business_cluster, public.app_users.business_cluster),
    river_park_verified = excluded.river_park_verified,
    status = 'active',
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_auth_user_profile on auth.users;

create trigger sync_auth_user_profile
after insert or update of email, phone, raw_user_meta_data, email_confirmed_at
on auth.users
for each row
execute function public.sync_auth_user_to_app_users();

with auth_profiles as (
  select
    users.id::text as id,
    coalesce(users.raw_user_meta_data, '{}'::jsonb) as metadata,
    trim(
      coalesce(
        users.raw_user_meta_data ->> 'full_name',
        users.raw_user_meta_data ->> 'name',
        ''
      )
    ) as metadata_name,
    users.email,
    users.phone,
    users.created_at
  from auth.users as users
  where users.email_confirmed_at is not null
),
prepared_profiles as (
  select
    profiles.*,
    trim(
      coalesce(
        profiles.metadata ->> 'first_name',
        profiles.metadata ->> 'firstName',
        nullif(split_part(profiles.metadata_name, ' ', 1), ''),
        'View2Connect'
      )
    ) as first_name,
    trim(
      coalesce(
        profiles.metadata ->> 'last_name',
        profiles.metadata ->> 'lastName',
        nullif(regexp_replace(profiles.metadata_name, '^\S+\s*', ''), ''),
        'User'
      )
    ) as last_name,
    case
      when profiles.metadata ->> 'role' = 'businessOwner' then 'businessOwner'
      when profiles.metadata ->> 'role' = 'dispatch' then 'dispatch'
      else 'resident'
    end as role,
    coalesce(
      (
        select estates.id
        from public.estates
        where estates.id = nullif(profiles.metadata ->> 'estate_id', '')
        limit 1
      ),
      (
        select estates.id
        from public.estates
        where estates.id = 'river-park'
        limit 1
      ),
      (
        select estates.id
        from public.estates
        order by estates.created_at, estates.id
        limit 1
      )
    ) as estate_id
  from auth_profiles as profiles
)
insert into public.app_users (
  id,
  first_name,
  last_name,
  full_name,
  email,
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
select
  profiles.id,
  profiles.first_name,
  profiles.last_name,
  coalesce(
    nullif(profiles.metadata_name, ''),
    trim(profiles.first_name || ' ' || profiles.last_name)
  ),
  lower(coalesce(profiles.email, profiles.id || '@profile.invalid')),
  coalesce(
    nullif(profiles.phone, ''),
    nullif(profiles.metadata ->> 'phone_number', ''),
    'oauth-' || profiles.id
  ),
  'supabase-auth-managed',
  profiles.role,
  profiles.estate_id,
  nullif(profiles.metadata ->> 'business_name', ''),
  nullif(profiles.metadata ->> 'business_cluster', ''),
  profiles.role = 'resident',
  'active',
  coalesce(profiles.created_at, now()),
  now()
from prepared_profiles as profiles
on conflict (email) do update
set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  full_name = excluded.full_name,
  role = excluded.role,
  business_name = coalesce(excluded.business_name, public.app_users.business_name),
  business_cluster = coalesce(excluded.business_cluster, public.app_users.business_cluster),
  river_park_verified = excluded.river_park_verified,
  status = 'active',
  updated_at = now();
