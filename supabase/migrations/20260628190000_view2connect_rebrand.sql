alter table public.security_settings
  alter column login_announcement_title
  set default 'Welcome to View2Connect';

update public.security_settings
set
  login_announcement_title = replace(login_announcement_title, 'UrbanConnect', 'View2Connect'),
  login_announcement_body = replace(login_announcement_body, 'UrbanConnect', 'View2Connect'),
  updated_at = now()
where concat_ws(' ', login_announcement_title, login_announcement_body) ilike '%urbanconnect%';

update public.estates
set
  name = replace(name, 'UrbanConnect', 'View2Connect'),
  updated_at = now()
where name ilike '%urbanconnect%';

update public.admin_users
set
  full_name = replace(full_name, 'UrbanConnect', 'View2Connect'),
  updated_at = now()
where full_name ilike '%urbanconnect%';

update public.app_users
set
  business_name = replace(business_name, 'UrbanConnect', 'View2Connect'),
  updated_at = now()
where business_name ilike '%urbanconnect%';

update public.owner_business_profiles
set
  account_name = replace(account_name, 'UrbanConnect', 'View2Connect'),
  owner_name = replace(owner_name, 'UrbanConnect', 'View2Connect'),
  updated_at = now()
where concat_ws(' ', account_name, owner_name) ilike '%urbanconnect%';

update public.businesses
set
  name = replace(name, 'UrbanConnect', 'View2Connect'),
  owner_name = replace(owner_name, 'UrbanConnect', 'View2Connect'),
  description = replace(description, 'UrbanConnect', 'View2Connect'),
  long_description = replace(long_description, 'UrbanConnect', 'View2Connect'),
  updated_at = now()
where concat_ws(' ', name, owner_name, description, long_description) ilike '%urbanconnect%';

update public.notifications
set
  title = replace(title, 'UrbanConnect', 'View2Connect'),
  body = replace(body, 'UrbanConnect', 'View2Connect')
where concat_ws(' ', title, body) ilike '%urbanconnect%';

update public.email_logs
set
  recipient_name = replace(recipient_name, 'UrbanConnect', 'View2Connect'),
  subject = replace(subject, 'UrbanConnect', 'View2Connect'),
  body = replace(body, 'UrbanConnect', 'View2Connect')
where concat_ws(' ', recipient_name, subject, body) ilike '%urbanconnect%';

update public.audit_logs
set
  actor_name = replace(actor_name, 'UrbanConnect', 'View2Connect'),
  action = replace(action, 'UrbanConnect', 'View2Connect'),
  details = replace(details, 'UrbanConnect', 'View2Connect')
where concat_ws(' ', actor_name, action, details) ilike '%urbanconnect%';

update public.support_messages
set
  sender_name = replace(sender_name, 'UrbanConnect', 'View2Connect'),
  text = replace(text, 'UrbanConnect', 'View2Connect'),
  context_label = replace(context_label, 'UrbanConnect', 'View2Connect')
where concat_ws(' ', sender_name, text, context_label) ilike '%urbanconnect%';
