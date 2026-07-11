import type { AdminRole } from '../types/auth';
import type { Business, BusinessStatus, BusinessSubscriptionStatus } from '../types/business';
import type { UserStatus } from '../types/auth';

export function getUserStatusLabel(status?: UserStatus) {
  return status === 'suspended' ? 'Suspended' : 'Active';
}

export function isUserActive(status?: UserStatus) {
  return status !== 'suspended';
}

export function getBusinessStatusLabel(status?: BusinessStatus) {
  return status === 'archived' ? 'Archived' : 'Active';
}

export function isBusinessArchived(status?: BusinessStatus) {
  return status === 'archived';
}

export function isSubscriptionActive(
  status?: BusinessSubscriptionStatus | string,
  nextBillingAt?: string,
  now = Date.now(),
) {
  if (status !== 'paid' && status !== 'active') {
    return false;
  }

  if (!nextBillingAt) {
    return true;
  }

  const endTime = new Date(nextBillingAt).getTime();

  return Number.isFinite(endTime) && endTime > now;
}

export function isPublicBusiness(
  business: Pick<Business, 'status' | 'verified'>,
) {
  return !isBusinessArchived(business.status) && Boolean(business.verified);
}

export function getBusinessPriorityScore(
  business: Pick<Business, 'subscriptionStatus' | 'subscriptionCycle' | 'verifiedAmount' | 'createdAt'>,
) {
  const hasPaidPlacement = (business.verifiedAmount ?? 0) > 0;
  const paidScore =
    business.subscriptionStatus === 'paid'
      ? 1000
      : business.subscriptionStatus === 'active' && hasPaidPlacement
        ? 900
        : 0;
  const planScore = hasPaidPlacement ? (business.subscriptionCycle === 'monthly' ? 200 : 80) : 0;
  const amountScore = Math.min(500, Math.round((business.verifiedAmount ?? 0) / 1000));
  const recencyScore = Math.max(0, 100 - Math.floor((Date.now() - new Date(business.createdAt).getTime()) / 86400000));

  return paidScore + planScore + amountScore + recencyScore;
}

export function canAdminEditSensitiveData(role: AdminRole) {
  return role === 'owner';
}
