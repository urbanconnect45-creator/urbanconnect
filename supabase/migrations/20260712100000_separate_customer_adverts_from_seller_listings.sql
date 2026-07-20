alter table public.businesses
  add column if not exists listing_source text,
  add column if not exists listing_audience text;

update public.businesses
set
  listing_source = 'customerAccount',
  listing_audience = 'customerAdvert'
where
  tags::text ilike '%Customer advertisement%'
  or tags::text ilike '%Customer account advert%'
  or tags::text ilike '%Advertiser%';

update public.businesses as businesses
set
  listing_source = 'customerAccount',
  listing_audience = 'customerAdvert'
from public.app_users as app_users
where
  businesses.owner_user_id = app_users.id
  and app_users.role = 'resident';

update public.businesses as businesses
set
  listing_source = 'sellerPortal',
  listing_audience = 'storeProduct'
from public.app_users as app_users
where
  businesses.owner_user_id = app_users.id
  and app_users.role = 'businessOwner'
  and not (
    businesses.tags::text ilike '%Customer advertisement%'
    or businesses.tags::text ilike '%Customer account advert%'
    or businesses.tags::text ilike '%Advertiser%'
  );

update public.businesses
set
  listing_source = coalesce(
    listing_source,
    case
      when tags::text ilike '%Customer advertisement%'
        or tags::text ilike '%Customer account advert%'
        or tags::text ilike '%Advertiser%'
        then 'customerAccount'
      when tags::text ilike '%Central catalog%'
        then 'adminCatalog'
      else 'sellerPortal'
    end
  ),
  listing_audience = coalesce(
    listing_audience,
    case
      when tags::text ilike '%Customer advertisement%'
        or tags::text ilike '%Customer account advert%'
        or tags::text ilike '%Advertiser%'
        then 'customerAdvert'
      else 'storeProduct'
    end
  );

alter table public.businesses
  drop constraint if exists businesses_listing_source_check;

alter table public.businesses
  add constraint businesses_listing_source_check
  check (listing_source is null or listing_source in ('sellerPortal', 'customerAccount', 'adminCatalog'));

alter table public.businesses
  drop constraint if exists businesses_listing_audience_check;

alter table public.businesses
  add constraint businesses_listing_audience_check
  check (listing_audience is null or listing_audience in ('storeProduct', 'customerAdvert'));

create or replace view public.seller_portal_listings as
select *
from public.businesses
where
  not (
    listing_audience = 'customerAdvert'
    or listing_source = 'customerAccount'
    or tags::text ilike '%Customer advertisement%'
    or tags::text ilike '%Customer account advert%'
    or tags::text ilike '%Advertiser%'
  )
  and (
    listing_audience = 'storeProduct'
    or listing_source in ('sellerPortal', 'adminCatalog')
    or tags::text ilike '%Store owner%'
    or tags::text ilike '%Seller portal listing%'
    or tags::text ilike '%Admin managed catalog%'
  );

create or replace view public.customer_account_adverts as
select *
from public.businesses
where
  listing_audience = 'customerAdvert'
  or listing_source = 'customerAccount'
  or tags::text ilike '%Customer advertisement%'
  or tags::text ilike '%Customer account advert%'
  or tags::text ilike '%Advertiser%';
