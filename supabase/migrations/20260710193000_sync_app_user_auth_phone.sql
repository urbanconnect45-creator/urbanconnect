create or replace function public.normalize_supabase_phone(raw_phone text)
returns text
language sql
immutable
as $$
  select case
    when trim(coalesce(raw_phone, '')) ~ '^\+[1-9][0-9]{7,14}$'
      then trim(coalesce(raw_phone, ''))
    when length(regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g')) = 11
      and regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g') like '0%'
      then '+234' || substring(regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g') from 2)
    when length(regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g')) = 13
      and regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g') like '234%'
      then '+' || regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g')
    when length(regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g')) = 10
      then '+234' || regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g')
    else null
  end;
$$;

create or replace function public.sync_app_user_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_metadata jsonb;
  next_phone text;
  profile_phone_count integer := 0;
  auth_phone_taken boolean := false;
begin
  next_metadata :=
    coalesce(
      (
        select raw_user_meta_data
        from auth.users
        where auth.users.id::text = new.id
      ),
      '{}'::jsonb
    ) ||
    jsonb_strip_nulls(
      jsonb_build_object(
        'account_email', new.email,
        'phone_number', new.phone_number,
        'role', new.role,
        'user_number', new.user_number,
        'full_name', new.full_name,
        'first_name', new.first_name,
        'last_name', new.last_name,
        'business_name', new.business_name,
        'business_cluster', new.business_cluster
      )
    );

  next_phone := public.normalize_supabase_phone(new.phone_number);

  if next_phone is not null then
    select count(*)
    into profile_phone_count
    from public.app_users
    where public.normalize_supabase_phone(phone_number) = next_phone;

    select exists (
      select 1
      from auth.users existing_auth_user
      where existing_auth_user.id::text <> new.id
        and existing_auth_user.phone = next_phone
    )
    into auth_phone_taken;
  end if;

  update auth.users
  set
    raw_user_meta_data = next_metadata,
    phone = case
      when next_phone is not null
        and profile_phone_count = 1
        and not auth_phone_taken
        and coalesce(auth.users.phone, '') = ''
        then next_phone
      else auth.users.phone
    end,
    phone_confirmed_at = case
      when next_phone is not null
        and profile_phone_count = 1
        and not auth_phone_taken
        and coalesce(auth.users.phone, '') = ''
        then coalesce(auth.users.phone_confirmed_at, now())
      else auth.users.phone_confirmed_at
    end
  where auth.users.id::text = new.id
    and (
      auth.users.raw_user_meta_data is distinct from next_metadata
      or (
        next_phone is not null
        and profile_phone_count = 1
        and not auth_phone_taken
        and coalesce(auth.users.phone, '') = ''
      )
    );

  return new;
end;
$$;
