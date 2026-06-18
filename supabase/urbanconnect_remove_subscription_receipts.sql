-- Removes the old receipt/proof columns after subscriptions moved to account balance payments.
alter table if exists public.owner_business_profiles
  drop column if exists payment_proof_url,
  drop column if exists payment_proof_submitted_at;

alter table if exists public.businesses
  drop column if exists payment_proof_url,
  drop column if exists payment_proof_submitted_at;
