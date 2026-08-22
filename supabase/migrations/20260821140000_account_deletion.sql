create or replace function public.anonymize_user_account_for_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_identity text := 'deleted-' || replace(target_user_id::text, '-', '');
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  update public.businesses
  set status = 'archived',
      verified = false,
      river_park_verified = false,
      owner_name = 'Deleted user',
      owner_email = null,
      contact = '{}'::jsonb,
      updated_at = now()
  where owner_user_id = target_user_id::text;

  update public.owner_business_profiles
  set account_name = 'Deleted user',
      account_email = deleted_identity || '@deleted.view2connect.invalid',
      owner_name = 'Deleted user',
      phone = '',
      whatsapp = null,
      email = deleted_identity || '@deleted.view2connect.invalid',
      website = null,
      instagram = null,
      facebook = null,
      x = null,
      tiktok = null,
      address = 'Removed',
      cover_image = null,
      profile_image = null,
      bio = null,
      gallery_images = null,
      gallery_videos = null,
      payout_bank_code = null,
      payout_bank_name = null,
      payout_account_number = null,
      payout_account_name = null,
      payout_verified_at = null,
      river_park_verified = false,
      updated_at = now()
  where owner_user_id = target_user_id::text;

  update public.rider_profiles
  set full_name = 'Deleted user',
      email = deleted_identity || '@deleted.view2connect.invalid',
      phone_number = deleted_identity,
      vehicle_type = null,
      plate_number = null,
      status = 'suspended',
      updated_at = now()
  where auth_user_id = target_user_id;

  delete from public.customer_cart_items where user_id = target_user_id::text;
  delete from public.customer_delivery_locations where user_id = target_user_id::text;
  delete from public.notifications where user_id = target_user_id::text;
  delete from public.listing_messages
  where sender_user_id = target_user_id::text or recipient_user_id = target_user_id::text;

  update public.support_messages
  set user_name = 'Deleted user',
      sender_name = case when sender_role in ('resident', 'businessOwner', 'dispatch')
        then 'Deleted user' else sender_name end
  where user_id = target_user_id::text;

  update public.app_users
  set first_name = 'Deleted',
      last_name = 'User',
      full_name = 'Deleted user',
      email = deleted_identity || '@deleted.view2connect.invalid',
      auth_email = null,
      phone_number = deleted_identity,
      password_hash = null,
      business_name = null,
      business_cluster = null,
      river_park_verified = false,
      status = 'suspended',
      updated_at = now()
  where id = target_user_id::text;
end;
$$;

revoke all on function public.anonymize_user_account_for_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.anonymize_user_account_for_deletion(uuid)
  to service_role;
