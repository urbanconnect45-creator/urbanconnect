import type { Business, OwnerBusinessProfile } from '../types/business';
import { isPublicBusiness } from './businessState';

function normalizeKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
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
  return isPublicBusiness(business) && !isStoreOwnerListing(business, ownerProfiles);
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
