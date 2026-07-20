import type { Business, SubscriptionPayment } from '../types/business';

export type CustomerSubscriptionPayload = {
  amountBeforeDiscount?: number;
  discountAmount?: number;
  durationLabel?: string;
  durationMinutes?: number;
  durationMonths?: number;
  nextBillingAt?: string;
  planTitle?: string;
  subscriptionType?: string;
};

export function parseCustomerSubscriptionPayload(payment: SubscriptionPayment) {
  try {
    const payload = payment.rawPayload
      ? (JSON.parse(payment.rawPayload) as CustomerSubscriptionPayload)
      : {};

    return payload.subscriptionType === 'customerBenefits' ? payload : undefined;
  } catch {
    return undefined;
  }
}

export function isCustomerBenefitPaymentActive(payment: SubscriptionPayment, now = Date.now()) {
  if (payment.status !== 'paid') {
    return false;
  }

  const payload = parseCustomerSubscriptionPayload(payment);
  const endTime = payload?.nextBillingAt ? new Date(payload.nextBillingAt).getTime() : 0;

  return Number.isFinite(endTime) && endTime > now;
}

export function hasActiveCustomerAdvertPromotion(
  advert: Business,
  payments: SubscriptionPayment[],
  now = Date.now(),
) {
  return payments.some((payment) => {
    if (!isCustomerBenefitPaymentActive(payment, now)) {
      return false;
    }

    const ownerMatches =
      Boolean(advert.ownerUserId && payment.ownerUserId === advert.ownerUserId) ||
      Boolean(
        advert.ownerEmail &&
          payment.ownerEmail.trim().toLowerCase() === advert.ownerEmail.trim().toLowerCase(),
      );

    return ownerMatches;
  });
}
