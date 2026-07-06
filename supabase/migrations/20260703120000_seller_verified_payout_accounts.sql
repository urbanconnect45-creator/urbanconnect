alter table public.owner_business_profiles
  add column if not exists payout_bank_code text,
  add column if not exists payout_bank_name text,
  add column if not exists payout_account_number text,
  add column if not exists payout_account_name text,
  add column if not exists payout_verified_at timestamptz;

create index if not exists owner_business_profiles_payout_lookup_idx
  on public.owner_business_profiles (owner_user_id, payout_verified_at);

