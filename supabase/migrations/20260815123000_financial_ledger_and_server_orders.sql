-- Server-authoritative orders, stock finalization, and immutable wallet ledger.

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refundPending', 'refunded', 'reversed'));

alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests alter column status set default 'pending';
alter table public.withdrawal_requests add constraint withdrawal_requests_status_check
  check (status in ('pending', 'processing', 'paid', 'failed', 'reversed'));
alter table public.withdrawal_requests add column if not exists updated_at timestamptz not null default now();
alter table public.withdrawal_requests add column if not exists provider_reference text;
alter table public.withdrawal_requests add column if not exists failure_reason text;

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.app_users(id) on delete restrict,
  account_type text not null check (account_type in ('customer', 'seller', 'platform', 'clearing')),
  currency text not null default 'NGN' check (currency = 'NGN'),
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, account_type, currency)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  kind text not null check (kind in ('orderPayment', 'refund', 'deposit', 'withdrawal', 'reversal', 'adjustment')),
  order_id text references public.orders(id) on delete restrict,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  account_id uuid not null references public.wallet_accounts(id) on delete restrict,
  amount numeric(14, 2) not null check (amount <> 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, account_id)
);

create index if not exists wallet_ledger_account_created_idx
  on public.wallet_ledger_entries (account_id, created_at desc);

create or replace function public.reject_wallet_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Wallet ledger records are immutable' using errcode = '42501';
end;
$$;

drop trigger if exists wallet_transactions_immutable on public.wallet_transactions;
create trigger wallet_transactions_immutable before update or delete on public.wallet_transactions
for each row execute function public.reject_wallet_ledger_mutation();
drop trigger if exists wallet_entries_immutable on public.wallet_ledger_entries;
create trigger wallet_entries_immutable before update or delete on public.wallet_ledger_entries
for each row execute function public.reject_wallet_ledger_mutation();

alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_ledger_entries enable row level security;
revoke all on public.wallet_accounts, public.wallet_transactions, public.wallet_ledger_entries
  from anon, authenticated;
grant select on public.wallet_accounts, public.wallet_transactions, public.wallet_ledger_entries
  to authenticated;

create policy wallet_accounts_owner_read on public.wallet_accounts for select to authenticated
using (user_id = auth.uid()::text or public.is_view2connect_staff());
create policy wallet_transactions_owner_read on public.wallet_transactions for select to authenticated
using (
  public.is_view2connect_staff()
  or exists (
    select 1
    from public.wallet_ledger_entries as entries
    join public.wallet_accounts as accounts on accounts.id = entries.account_id
    where entries.transaction_id = wallet_transactions.id
      and accounts.user_id = auth.uid()::text
  )
);
create policy wallet_entries_owner_read on public.wallet_ledger_entries for select to authenticated
using (
  public.is_view2connect_staff()
  or exists (
    select 1 from public.wallet_accounts
    where wallet_accounts.id = wallet_ledger_entries.account_id
      and wallet_accounts.user_id = auth.uid()::text
  )
);

create or replace function public.calculate_view2connect_vat(subtotal numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when subtotal < 3000 then 0
    when subtotal < 10000 then 500
    else 1500 + floor((subtotal - 10000) / 10000) * 1000
  end
$$;

create or replace function public.calculate_seller_packing_support(subtotal numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when subtotal < 100 then 0
    when subtotal < 1000 then 50
    when subtotal < 5000 then 100
    when subtotal < 10000 then 200
    when subtotal < 20000 then 300
    when subtotal < 50000 then 500
    else 800
  end
$$;

create or replace function public.create_marketplace_order(
  p_items jsonb,
  p_delivery jsonb,
  p_payment_method text default 'flutterwave'
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer public.app_users%rowtype;
  product public.businesses%rowtype;
  item jsonb;
  quantity integer;
  subtotal_value numeric(12, 2) := 0;
  vat_value numeric(12, 2);
  support_value numeric(12, 2);
  order_id text := 'V2C-' || replace(gen_random_uuid()::text, '-', '');
  result public.orders;
begin
  if auth.uid() is null or public.current_app_role() <> 'resident' then
    raise exception 'An active customer account is required' using errcode = '42501';
  end if;

  if p_payment_method not in ('flutterwave', 'walletAccount') then
    raise exception 'Unsupported payment method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100 then
    raise exception 'Choose between 1 and 100 cart items';
  end if;

  if coalesce(trim(p_delivery->>'formattedAddress'), '') = ''
    or coalesce(trim(p_delivery->>'contactPhone'), '') = '' then
    raise exception 'Delivery address and contact phone are required';
  end if;

  select * into buyer from public.app_users where id = auth.uid()::text and status = 'active';

  for item in select value from jsonb_array_elements(p_items)
  loop
    quantity := greatest(0, coalesce((item->>'quantity')::integer, 0));
    if quantity < 1 then raise exception 'Every item needs a valid quantity'; end if;

    select * into product
    from public.businesses
    where id = item->>'businessId'
      and status = 'active'
      and verified = true
      and listing_type = 'product'
      and owner_user_id is not null
    for share;

    if product.id is null then raise exception 'A cart product is unavailable'; end if;
    if product.stock_quantity < quantity then
      raise exception 'Insufficient stock for %', product.name;
    end if;

    subtotal_value := subtotal_value + (product.price * quantity);
  end loop;

  vat_value := public.calculate_view2connect_vat(subtotal_value);
  support_value := public.calculate_seller_packing_support(subtotal_value);

  insert into public.orders (
    id, user_id, user_email, user_name, estate_id, delivery_address,
    delivery_cluster, delivery_contact_phone, delivery_country, delivery_state_region,
    delivery_city, delivery_area_district, delivery_street_name, delivery_building_info,
    delivery_landmark, delivery_latitude, delivery_longitude, delivery_place_id,
    delivery_location_source, delivery_instructions, note, subtotal, service_fee,
    seller_packing_support, delivery_fee, total_amount, payment_method, payment_status, status
  ) values (
    order_id, buyer.id, buyer.email, buyer.full_name, buyer.estate_id,
    trim(p_delivery->>'formattedAddress'),
    coalesce(nullif(trim(p_delivery->>'areaDistrict'), ''), nullif(trim(p_delivery->>'city'), ''), 'Delivery location'),
    trim(p_delivery->>'contactPhone'), p_delivery->>'country', p_delivery->>'stateRegion',
    p_delivery->>'city', p_delivery->>'areaDistrict', p_delivery->>'streetName',
    p_delivery->>'buildingInfo', p_delivery->>'landmark',
    nullif(p_delivery->>'latitude', '')::double precision,
    nullif(p_delivery->>'longitude', '')::double precision,
    p_delivery->>'placeId', coalesce(p_delivery->>'source', 'manual'),
    p_delivery->>'additionalInstructions', p_delivery->>'note', subtotal_value,
    vat_value, support_value, 0, subtotal_value + vat_value + support_value,
    p_payment_method, 'pending', 'placed'
  ) returning * into result;

  for item in select value from jsonb_array_elements(p_items)
  loop
    quantity := (item->>'quantity')::integer;
    select * into product from public.businesses where id = item->>'businessId';
    insert into public.order_items (
      order_id, business_id, business_name, owner_name, owner_user_id,
      sku, quantity, unit_price, line_total
    ) values (
      order_id, product.id, product.name, product.owner_name, product.owner_user_id,
      product.sku, quantity, product.price, product.price * quantity
    );
  end loop;

  insert into public.order_timeline_events (id, order_id, status, label, note)
  values (gen_random_uuid()::text, order_id, 'placed', 'Checkout created', 'Awaiting verified payment.');

  return result;
end;
$$;

revoke all on function public.create_marketplace_order(jsonb, jsonb, text) from public, anon;
grant execute on function public.create_marketplace_order(jsonb, jsonb, text) to authenticated;

create or replace function public.finalize_paid_order(p_order_id text, p_provider_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders%rowtype;
  line public.order_items%rowtype;
  available_stock integer;
  transaction_id uuid;
  clearing_account_id uuid;
  platform_account_id uuid;
  seller_account_id uuid;
  seller record;
  seller_index integer := 0;
  seller_count integer := 0;
  support_remaining numeric(14, 2);
  support_share numeric(14, 2);
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization required' using errcode = '42501';
  end if;

  select * into target_order from public.orders where id = p_order_id for update;
  if target_order.id is null then raise exception 'Order not found'; end if;
  if target_order.payment_status = 'paid' then return true; end if;
  if target_order.payment_status <> 'pending' then raise exception 'Order is not payable'; end if;

  for line in select * from public.order_items where order_id = p_order_id order by id
  loop
    select stock_quantity into available_stock
    from public.businesses where id = line.business_id for update;
    if available_stock is null or available_stock < line.quantity then
      update public.orders set payment_status = 'refundPending', status = 'cancelled', updated_at = now()
      where id = p_order_id;
      insert into public.order_timeline_events (id, order_id, status, label, note)
      values (gen_random_uuid()::text, p_order_id, 'cancelled', 'Refund required',
        'Payment succeeded after stock became unavailable.');
      return false;
    end if;
  end loop;

  for line in select * from public.order_items where order_id = p_order_id order by id
  loop
    update public.businesses
    set stock_quantity = stock_quantity - line.quantity, updated_at = now()
    where id = line.business_id;
  end loop;

  insert into public.wallet_accounts (user_id, account_type, currency)
  values (null, 'clearing', 'NGN')
  on conflict (user_id, account_type, currency) do nothing;
  select id into clearing_account_id from public.wallet_accounts
  where user_id is null and account_type = 'clearing' and currency = 'NGN';

  insert into public.wallet_accounts (user_id, account_type, currency)
  values (null, 'platform', 'NGN')
  on conflict (user_id, account_type, currency) do nothing;
  select id into platform_account_id from public.wallet_accounts
  where user_id is null and account_type = 'platform' and currency = 'NGN';

  insert into public.wallet_transactions (reference, kind, order_id, metadata)
  values (
    'flutterwave:' || p_provider_reference,
    'orderPayment',
    p_order_id,
    jsonb_build_object('provider', 'flutterwave', 'providerReference', p_provider_reference)
  ) returning id into transaction_id;

  insert into public.wallet_ledger_entries (transaction_id, account_id, amount)
  values (transaction_id, clearing_account_id, -target_order.total_amount);

  select count(*) into seller_count
  from (
    select owner_user_id from public.order_items
    where order_id = p_order_id group by owner_user_id
  ) as sellers;
  support_remaining := target_order.seller_packing_support;

  for seller in
    select owner_user_id, sum(line_total)::numeric(14, 2) as seller_subtotal
    from public.order_items
    where order_id = p_order_id
    group by owner_user_id
    order by owner_user_id
  loop
    if seller.owner_user_id is null then
      raise exception 'Order item is missing its seller account';
    end if;

    seller_index := seller_index + 1;
    support_share := case
      when seller_index = seller_count then support_remaining
      else round(target_order.seller_packing_support * seller.seller_subtotal / target_order.subtotal, 2)
    end;
    support_remaining := support_remaining - support_share;

    insert into public.wallet_accounts (user_id, account_type, currency)
    values (seller.owner_user_id, 'seller', 'NGN')
    on conflict (user_id, account_type, currency) do nothing;
    select id into seller_account_id from public.wallet_accounts
    where user_id = seller.owner_user_id and account_type = 'seller' and currency = 'NGN';

    insert into public.wallet_ledger_entries (transaction_id, account_id, amount)
    values (transaction_id, seller_account_id, seller.seller_subtotal + support_share);
  end loop;

  if target_order.service_fee > 0 then
    insert into public.wallet_ledger_entries (transaction_id, account_id, amount)
    values (transaction_id, platform_account_id, target_order.service_fee);
  end if;

  update public.orders set payment_status = 'paid', updated_at = now() where id = p_order_id;
  insert into public.order_timeline_events (id, order_id, status, label, note)
  values (gen_random_uuid()::text, p_order_id, 'placed', 'Payment confirmed',
    'Flutterwave payment was verified and stock was reserved.');

  return true;
end;
$$;

revoke all on function public.finalize_paid_order(text, text) from public, anon, authenticated;
grant execute on function public.finalize_paid_order(text, text) to service_role;
