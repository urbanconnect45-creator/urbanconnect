alter table public.dynamic_deposit_accounts
  add column if not exists paid_at timestamptz,
  add column if not exists provider_charge_id text,
  add column if not exists failure_reason text;
