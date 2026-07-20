import type { Business, BusinessContact, OwnerBusinessProfile } from '../types/business';
import { isPublicBusiness } from './businessState';

function normalizeKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function hasCustomerAdvertMarkers(business: Business) {
  return (
    business.listingAudience === 'customerAdvert' ||
    business.listingSource === 'customerAccount' ||
    business.tags.includes('Customer advertisement') ||
    business.tags.includes('Customer account advert') ||
    business.tags.includes('Advertiser')
  );
}

export function profileMatchesBusiness(profile: OwnerBusinessProfile, business: Business) {
  const profileKeys = [
    profile.ownerUserId,
    profile.accountEmail,
    profile.email,
    profile.accountName,
    profile.ownerName,
  ]
    .map(normalizeKey)
    .filter(Boolean);

  return [business.ownerUserId, business.ownerEmail, business.ownerName]
    .map(normalizeKey)
    .some((key) => Boolean(key && profileKeys.includes(key)));
}

export function isStoreOwnerListing(
  business: Business,
  ownerProfiles: OwnerBusinessProfile[],
) {
  return isStoreOwnerListingSource(business, ownerProfiles);
}

export function isStoreOwnerListingSource(
  business: Business,
  ownerProfiles: OwnerBusinessProfile[],
) {
  if (hasCustomerAdvertMarkers(business)) {
    return false;
  }

  if (business.listingSource === 'sellerPortal' || business.listingSource === 'adminCatalog') {
    return true;
  }

  if (business.listingAudience === 'storeProduct') {
    return true;
  }

  return (
    ownerProfiles.some((profile) => profileMatchesBusiness(profile, business)) ||
    business.tags.includes('Store owner') ||
    business.tags.includes('Priority store')
  );
}

export function isStoreOwnerProduct(
  business: Business,
  ownerProfiles: OwnerBusinessProfile[],
) {
  return (
    business.listingType === 'product' &&
    isPublicBusiness(business) &&
    isStoreOwnerListing(business, ownerProfiles)
  );
}

export function isCustomerAdvertisement(
  business: Business,
  ownerProfiles: OwnerBusinessProfile[],
) {
  return isPublicBusiness(business) && isCustomerAdvertisementSource(business, ownerProfiles);
}

export function isCustomerAdvertisementSource(
  business: Business,
  ownerProfiles: OwnerBusinessProfile[],
) {
  if (hasCustomerAdvertMarkers(business)) {
    return true;
  }

  return !isStoreOwnerListingSource(business, ownerProfiles);
}

export function getProfileContactForBusiness(
  business: Business,
  ownerProfiles: OwnerBusinessProfile[],
): BusinessContact {
  const profile = ownerProfiles.find((item) => profileMatchesBusiness(item, business));

  if (!profile) {
    return business.contact;
  }

  return {
    phone: profile.phone || business.contact.phone,
    email: profile.email || business.contact.email,
    ...(profile.whatsapp ? { whatsapp: profile.whatsapp } : {}),
    ...(profile.website ? { website: profile.website } : {}),
    ...(profile.instagram ? { instagram: profile.instagram } : {}),
    ...(profile.facebook ? { facebook: profile.facebook } : {}),
    ...(profile.x ? { x: profile.x } : {}),
    ...(profile.tiktok ? { tiktok: profile.tiktok } : {}),
  };
}

export function getAdvertiserProfileListings(
  businesses: Business[],
  ownerKey: string,
  ownerProfiles: OwnerBusinessProfile[],
) {
  const normalizedOwnerKey = normalizeKey(ownerKey);

  return businesses.filter((business) => {
    if (!isCustomerAdvertisement(business, ownerProfiles)) {
      return false;
    }

    return [business.ownerUserId, business.ownerEmail, business.ownerName]
      .map(normalizeKey)
      .some((key) => Boolean(key && key === normalizedOwnerKey));
  });
}
