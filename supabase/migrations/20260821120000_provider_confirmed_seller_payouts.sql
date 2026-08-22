-- Seller payouts become provider-authoritative. A browser/admin session can start
-- or fail a payout, while only the service-role webhook can record paid status.

alter table public.withdrawal_requests
  add column if not exists bank_code text,
  add column if not exists provider_transfer_id text,
  add column if not exists provider_status text;

update public.withdrawal_requests as withdrawals
set bank_code = profiles.payout_bank_code
from public.owner_business_profiles as profiles
where profiles.owner_user_id = withdrawals.owner_user_id
  and withdrawals.bank_code is null
  and profiles.payout_bank_code is not null;

create unique index if not exists withdrawal_provider_transfer_id_unique
  on public.withdrawal_requests (provider_transfer_id)
  where provider_transfer_id is not null;

create index if not exists withdrawal_provider_reference_idx
  on public.withdrawal_requests (provider_reference)
  where provider_reference is not null;

create or replace function public.populate_withdrawal_bank_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(new.bank_code, '')), '') is null then
    select profiles.payout_bank_code
    into new.bank_code
    from public.owner_business_profiles as profiles
    where profiles.owner_user_id = new.owner_user_id
      and profiles.payout_verified_at is not null
    order by profiles.updated_at desc nulls last
    limit 1;
  end if;

  if nullif(trim(coalesce(new.bank_code, '')), '') is null then
    raise exception 'The verified payout account is missing its bank code';
  end if;

  return new;
end;
$$;

drop trigger if exists populate_withdrawal_bank_code on public.withdrawal_requests;
create trigger populate_withdrawal_bank_code
before insert on public.withdrawal_requests
for each row execute function public.populate_withdrawal_bank_code();

create or replace function public.protect_provider_paid_withdrawal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'paid'
    and old.status is distinct from 'paid'
    and auth.role() <> 'service_role' then
    raise exception 'Paid status requires Flutterwave confirmation' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_provider_paid_withdrawal on public.withdrawal_requests;
create trigger protect_provider_paid_withdrawal
before update on public.withdrawal_requests
for each row execute function public.protect_provider_paid_withdrawal();

create or replace function public.finalize_flutterwave_withdrawal(
  target_withdrawal_id text,
  target_transfer_id text,
  target_provider_reference text,
  target_provider_status text,
  target_amount numeric,
  target_currency text
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.withdrawal_requests%rowtype;
  result public.withdrawal_requests%rowtype;
  ledger_transaction_id uuid;
  seller_account_id uuid;
  clearing_account_id uuid;
  normalized_status text := lower(trim(coalesce(target_provider_status, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization required' using errcode = '42501';
  end if;
  if normalized_status not in ('success', 'successful', 'succeeded') then
    raise exception 'Flutterwave has not confirmed this payout';
  end if;
  if upper(trim(coalesce(target_currency, ''))) <> 'NGN' then
    raise exception 'Flutterwave payout currency does not match NGN';
  end if;

  select * into existing
  from public.withdrawal_requests
  where id = target_withdrawal_id
  for update;

  if existing.id is null then raise exception 'Withdrawal not found'; end if;
  if existing.status = 'paid' then return existing; end if;
  if existing.status = 'reversed' then raise exception 'A reversed withdrawal cannot be paid'; end if;
  if round(target_amount, 2) <> round(existing.amount, 2) then
    raise exception 'Flutterwave payout amount does not match the withdrawal';
  end if;
  if nullif(trim(coalesce(target_transfer_id, '')), '') is null
    or nullif(trim(coalesce(target_provider_reference, '')), '') is null then
    raise exception 'Flutterwave transfer identifiers are required';
  end if;

  update public.withdrawal_requests
  set status = 'paid',
      provider_transfer_id = trim(target_transfer_id),
      provider_reference = trim(target_provider_reference),
      provider_status = normalized_status,
      failure_reason = null,
      updated_at = now()
  where id = target_withdrawal_id
  returning * into result;

  insert into public.wallet_accounts (user_id, account_type, currency)
  values (existing.owner_user_id, 'seller', 'NGN')
  on conflict (user_id, account_type, currency) do nothing;
  select id into seller_account_id
  from public.wallet_accounts
  where user_id = existing.owner_user_id and account_type = 'seller' and currency = 'NGN';

  insert into public.wallet_accounts (user_id, account_type, currency)
  values (null, 'clearing', 'NGN')
  on conflict (user_id, account_type, currency) do nothing;
  select id into clearing_account_id
  from public.wallet_accounts
  where user_id is null and account_type = 'clearing' and currency = 'NGN';

  insert into public.wallet_transactions (reference, kind, status, metadata)
  values (
    'withdrawal:' || existing.id,
    'withdrawal',
    'posted',
    jsonb_build_object(
      'provider', 'flutterwave',
      'providerReference', trim(target_provider_reference),
      'providerTransferId', trim(target_transfer_id)
    )
  )
  on conflict (reference) do nothing
  returning id into ledger_transaction_id;

  if ledger_transaction_id is null then
    select id into ledger_transaction_id
    from public.wallet_transactions
    where reference = 'withdrawal:' || existing.id;
  end if;

  insert into public.wallet_ledger_entries (transaction_id, account_id, amount)
  values
    (ledger_transaction_id, seller_account_id, -existing.amount),
    (ledger_transaction_id, clearing_account_id, existing.amount)
  on conflict (transaction_id, account_id) do nothing;

  insert into public.notifications (
    id, user_id, user_name, audience, title, body, context_type, context_id
  ) values (
    'notification-withdrawal-' || existing.id || '-paid',
    existing.owner_user_id,
    existing.owner_name,
    'businessOwner',
    'Withdrawal paid',
    'Flutterwave confirmed that your payout was sent to your verified bank account.',
    'general',
    existing.id
  ) on conflict (id) do nothing;

  insert into public.audit_logs (id, actor_name, actor_role, action, details)
  values (
    'audit-withdrawal-provider-' || existing.id,
    'Flutterwave webhook',
    'system',
    'Withdrawal paid by provider confirmation',
    'Withdrawal ' || existing.id || ' was confirmed by Flutterwave transfer ' || trim(target_transfer_id) || '.'
  ) on conflict (id) do nothing;

  return result;
end;
$$;

revoke all on function public.finalize_flutterwave_withdrawal(text, text, text, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.finalize_flutterwave_withdrawal(text, text, text, text, numeric, text)
  to service_role;

create or replace function public.fail_flutterwave_withdrawal(
  target_withdrawal_id text,
  target_transfer_id text,
  target_provider_reference text,
  target_provider_status text,
  target_failure_reason text
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = ''
as $$
declare result public.withdrawal_requests%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization required' using errcode = '42501';
  end if;

  update public.withdrawal_requests
  set status = 'failed',
      provider_transfer_id = coalesce(nullif(trim(target_transfer_id), ''), provider_transfer_id),
      provider_reference = coalesce(nullif(trim(target_provider_reference), ''), provider_reference),
      provider_status = lower(trim(coalesce(target_provider_status, 'failed'))),
      failure_reason = coalesce(nullif(trim(target_failure_reason), ''), 'Flutterwave reported that the payout failed.'),
      updated_at = now()
  where id = target_withdrawal_id and status <> 'paid'
  returning * into result;

  if result.id is null then raise exception 'Withdrawal not found or already paid'; end if;
  return result;
end;
$$;

revoke all on function public.fail_flutterwave_withdrawal(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_flutterwave_withdrawal(text, text, text, text, text)
  to service_role;
