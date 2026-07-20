alter table public.owner_business_profiles
  add column if not exists bio text,
  add column if not exists open_days text[] default '{}';
