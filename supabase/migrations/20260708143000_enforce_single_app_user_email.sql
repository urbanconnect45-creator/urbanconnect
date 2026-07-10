-- Enforce one app account per email and keep OAuth sync from changing roles.

do $$
begin
  update public.app_users
  set
    email = lower(trim(email)),
    updated_at = now()
  where email <> lower(trim(email));

  with ranked as (
    select
      app_users.id,
      row_number() over (
        partition by lower(app_users.email)
        order by
          case
            when exists (
              select 1
              from auth.users
              where lower(coalesce(auth.users.email, '')) = lower(app_users.email)
                and auth.users.id::text = app_users.id
            )
            then 0
            else 1
          end,
          case when app_users.status = 'active' then 0 else 1 end,
          app_users.created_at nulls last,
          app_users.id
      ) as email_rank
    from public.app_users
  )
  update public.app_users as app_users
  set
    email = concat(
      regexp_replace(split_part(app_users.email, '@', 1), '[^a-zA-Z0-9._-]+', '-', 'g'),
      '+duplicate-',
      regexp_replace(app_users.id, '[^a-zA-Z0-9]+', '', 'g'),
      '@view2connect.invalid'
    ),
    status = 'suspended',
    updated_at = now()
  from ranked
  where ranked.id = app_users.id
    and ranked.email_rank > 1;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.app_users'::regclass
      and conname = 'app_users_email_key'
  ) then
    alter table public.app_users
      add constraint app_users_email_key unique (email);
  end if;
end $$;

create unique index if not exists app_users_email_lower_unique
  on public.app_users (lower(email));

create or replace function public.sync_auth_user_to_app_users()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_role text := coalesce(metadata->>'role', 'resident');
  normalized_email text := lower(coalesce(new.email, ''));
  first_name text;
  last_name text;
  full_name text;
begin
  if normalized_email = '' then
    return new;
  end if;

  if profile_role not in ('resident', 'businessOwner', 'dispatch') then
    profile_role := 'resident';
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
    coalesce(last_name, case when profile_role = 'businessOwner' then 'Seller' else 'Resident' end),
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
