alter table public.owner_business_profiles
  add column if not exists opening_time text,
  add column if not exists closing_time text;
