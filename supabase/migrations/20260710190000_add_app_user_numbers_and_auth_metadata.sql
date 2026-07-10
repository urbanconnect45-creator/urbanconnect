alter table public.app_users
  add column if not exists user_number bigint;

create sequence if not exists public.app_users_user_number_seq
  as bigint
  minvalue 0
  start with 0;

alter sequence public.app_users_user_number_seq
  owned by public.app_users.user_number;

with numbered_users as (
  select
    id,
    row_number() over (order by created_at nulls last, id) - 1 as next_user_number
  from public.app_users
  where user_number is null
)
update public.app_users
set user_number = numbered_users.next_user_number
from numbered_users
where public.app_users.id = numbered_users.id;

select setval(
  'public.app_users_user_number_seq',
  greatest(coalesce((select max(user_number) + 1 from public.app_users), 0), 0),
  false
);

alter table public.app_users
  alter column user_number set default nextval('public.app_users_user_number_seq'::regclass);

alter table public.app_users
  alter column user_number set not null;

create unique index if not exists app_users_user_number_key
  on public.app_users (user_number);

create or replace function public.sync_app_user_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_metadata jsonb;
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

  update auth.users
  set raw_user_meta_data = next_metadata
  where auth.users.id::text = new.id
    and auth.users.raw_user_meta_data is distinct from next_metadata;

  return new;
end;
$$;

drop trigger if exists sync_app_user_auth_metadata on public.app_users;
create trigger sync_app_user_auth_metadata
after insert or update of
  email,
  phone_number,
  role,
  user_number,
  full_name,
  first_name,
  last_name,
  business_name,
  business_cluster
on public.app_users
for each row execute function public.sync_app_user_auth_metadata();

update auth.users
set raw_user_meta_data =
  coalesce(auth.users.raw_user_meta_data, '{}'::jsonb) ||
  jsonb_strip_nulls(
    jsonb_build_object(
      'account_email', app_users.email,
      'phone_number', app_users.phone_number,
      'role', app_users.role,
      'user_number', app_users.user_number,
      'full_name', app_users.full_name,
      'first_name', app_users.first_name,
      'last_name', app_users.last_name,
      'business_name', app_users.business_name,
      'business_cluster', app_users.business_cluster
    )
  )
from public.app_users
where auth.users.id::text = app_users.id;

with normalized_profiles as (
  select
    id,
    case
      when phone_number ~ '^\+[1-9][0-9]{7,14}$' then phone_number
      when length(phone_digits) = 11 and phone_digits like '0%' then '+234' || substring(phone_digits from 2)
      when length(phone_digits) = 13 and phone_digits like '234%' then '+' || phone_digits
      when length(phone_digits) = 10 then '+234' || phone_digits
      else null
    end as auth_phone
  from (
    select
      id,
      trim(coalesce(phone_number, '')) as phone_number,
      regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') as phone_digits
    from public.app_users
  ) profiles
),
unique_phone_profiles as (
  select
    *,
    count(*) over (partition by auth_phone) as matching_profile_count
  from normalized_profiles
  where auth_phone is not null
)
update auth.users
set
  phone = unique_phone_profiles.auth_phone,
  phone_confirmed_at = coalesce(auth.users.phone_confirmed_at, now())
from unique_phone_profiles
where auth.users.id::text = unique_phone_profiles.id
  and unique_phone_profiles.matching_profile_count = 1
  and coalesce(auth.users.phone, '') = ''
  and not exists (
    select 1
    from auth.users existing_auth_user
    where existing_auth_user.id <> auth.users.id
      and existing_auth_user.phone = unique_phone_profiles.auth_phone
  );
