-- Adds Flutterwave live checkout as a first-class order payment method.

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('walletAccount', 'flutterwave', 'bankTransfer', 'cashOnDelivery'));
