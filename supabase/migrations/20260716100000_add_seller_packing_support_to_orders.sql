alter table public.orders
  add column if not exists seller_packing_support numeric not null default 0;