alter table public.security_settings
  alter column login_announcement_body
  set default 'Marketplace updates, verification notices, and customer care messages will appear in your notifications.';

update public.security_settings
set
  login_announcement_body = replace(login_announcement_body, 'River Park', 'UrbanConnect'),
  updated_at = now()
where login_announcement_body ilike '%river park%';

update public.estates
set
  name = 'UrbanConnect Marketplace',
  city = 'Nigeria',
  updated_at = now()
where id = 'river-park';

update public.businesses
set
  name = replace(name, 'River Park', 'UrbanConnect'),
  owner_name = replace(owner_name, 'River Park', 'UrbanConnect'),
  description = replace(description, 'River Park', 'local'),
  long_description = replace(long_description, 'River Park', 'local'),
  address = replace(replace(address, 'River Park Estate', ''), 'River Park', 'local'),
  updated_at = now()
where concat_ws(' ', name, owner_name, description, long_description, address) ilike '%river park%';

update public.owner_business_profiles
set
  account_name = replace(account_name, 'River Park', 'UrbanConnect'),
  owner_name = replace(owner_name, 'River Park', 'UrbanConnect'),
  address = replace(replace(address, 'River Park Estate', ''), 'River Park', 'local'),
  updated_at = now()
where concat_ws(' ', account_name, owner_name, address) ilike '%river park%';

update public.notifications
set
  title = replace(title, 'River Park', 'UrbanConnect'),
  body = replace(body, 'River Park', 'UrbanConnect')
where concat_ws(' ', title, body) ilike '%river park%';

update public.email_logs
set
  subject = replace(subject, 'River Park', 'UrbanConnect'),
  body = replace(body, 'River Park', 'UrbanConnect')
where concat_ws(' ', subject, body) ilike '%river park%';

update public.audit_logs
set
  action = replace(action, 'River Park', 'Seller'),
  details = replace(details, 'River Park', 'marketplace')
where concat_ws(' ', action, details) ilike '%river park%';

update public.support_messages
set
  text = replace(text, 'River Park', 'UrbanConnect'),
  context_label = replace(context_label, 'River Park', 'UrbanConnect')
where concat_ws(' ', text, context_label) ilike '%river park%';
