alter table public.owner_business_profiles
  add column if not exists facebook text,
  add column if not exists x text,
  add column if not exists tiktok text;
