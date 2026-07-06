-- UrbanConnect live data cleanup
-- Purpose: clear all customer/seller/demo account data while leaving schema,
-- admin accounts, payment plans, security settings, estates, functions, and policies intact.
--
-- Run this in Supabase SQL Editor when you want to reduce live database rows.
-- It does not recreate or alter structure.
--
-- Supabase does not allow deleting Storage objects directly from SQL.
-- After this query succeeds, empty the `urbanconnect-listing-media` bucket
-- from the Supabase Storage dashboard to free file/object space.

begin;

do $$
declare
  table_name text;
  cleanup_tables text[] := array[
    'public.notifications',
    'public.support_messages',
    'public.email_logs',
    'public.dynamic_deposit_accounts',
    'public.virtual_accounts',
    'public.withdrawal_requests',
    'public.subscription_payments',
    'public.order_timeline_events',
    'public.order_items',
    'public.orders',
    'public.businesses',
    'public.owner_business_profiles',
    'public.app_users',
    'public.audit_logs'
  ];
begin
  foreach table_name in array cleanup_tables loop
    if to_regclass(table_name) is not null then
      execute format('truncate table %s restart identity cascade', table_name);
    end if;
  end loop;
end $$;

-- Keep only platform admin identities if an admin email was ever created in Supabase Auth.
-- The app's admin login is stored in public.admin_users and is not removed above.
delete from auth.users
where coalesce(lower(email), '') not in (
  'owner.admin@urbanconnect.com',
  'care.admin@urbanconnect.com'
);

insert into public.audit_logs (
  id,
  actor_name,
  actor_role,
  action,
  details,
  created_at
) values (
  'audit-live-data-cleanup-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
  'System',
  'system',
  'Live account data cleanup',
  'All non-admin app users, listings, orders, payments, wallet records, support messages, notifications, email logs, and listing media metadata were cleared. Admin users, settings, plans, estates, and schema were preserved.',
  now()
);

commit;
