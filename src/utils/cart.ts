import type { CartEntry, SecuritySettings } from '../types/business';

export const INDIVIDUAL_SELLER_MINIMUM_SUBTOTAL = 3000;

type CheckoutFeeSettings = Pick<
  SecuritySettings,
  | 'vatTierOneAmount'
  | 'vatTierTwoBaseAmount'
  | 'vatAdditionalBandAmount'
  | 'packingTierOneAmount'
  | 'packingTierTwoAmount'
  | 'packingTierThreeAmount'
  | 'packingTierFourAmount'
  | 'packingTierFiveAmount'
  | 'packingTierSixAmount'
>;

const defaultCheckoutFeeSettings: CheckoutFeeSettings = {
  vatTierOneAmount: 500,
  vatTierTwoBaseAmount: 1500,
  vatAdditionalBandAmount: 1000,
  packingTierOneAmount: 50,
  packingTierTwoAmount: 100,
  packingTierThreeAmount: 200,
  packingTierFourAmount: 300,
  packingTierFiveAmount: 500,
  packingTierSixAmount: 800,
};

export function calculateProgressiveVat(
  subtotal: number,
  settings: CheckoutFeeSettings = defaultCheckoutFeeSettings,
) {
  if (!Number.isFinite(subtotal) || subtotal < 3000) {
    return 0;
  }

  if (subtotal < 10000) {
    return settings.vatTierOneAmount;
  }

  const higherBandIndex = Math.floor((subtotal - 10000) / 10000);

  return settings.vatTierTwoBaseAmount + higherBandIndex * settings.vatAdditionalBandAmount;
}

export function calculateSellerPackingSupport(
  subtotal: number,
  settings: CheckoutFeeSettings = defaultCheckoutFeeSettings,
) {
  if (!Number.isFinite(subtotal) || subtotal < 100) {
    return 0;
  }

  if (subtotal < 1000) {
    return settings.packingTierOneAmount;
  }

  if (subtotal < 5000) {
    return settings.packingTierTwoAmount;
  }

  if (subtotal < 10000) {
    return settings.packingTierThreeAmount;
  }

  if (subtotal < 20000) {
    return settings.packingTierFourAmount;
  }

  if (subtotal < 50000) {
    return settings.packingTierFiveAmount;
  }

  return settings.packingTierSixAmount;
}

export type IndividualSellerMinimumIssue = {
  sellerId: string;
  sellerName: string;
  subtotal: number;
  amountRemaining: number;
};

export function getIndividualSellerMinimumIssues(
  entries: CartEntry[],
): IndividualSellerMinimumIssue[] {
  const sellerTotals = new Map<
    string,
    { sellerId: string; sellerName: string; subtotal: number }
  >();

  entries
    .filter((entry) => entry.business.tags.includes('Individual seller'))
    .forEach((entry) => {
      const sellerId =
        entry.business.ownerUserId ??
        entry.business.ownerEmail ??
        entry.business.ownerName;
      const current = sellerTotals.get(sellerId);

      sellerTotals.set(sellerId, {
        sellerId,
        sellerName: entry.business.ownerName,
        subtotal: (current?.subtotal ?? 0) + entry.lineTotal,
      });
    });

  return Array.from(sellerTotals.values())
    .filter((seller) => seller.subtotal < INDIVIDUAL_SELLER_MINIMUM_SUBTOTAL)
    .map((seller) => ({
      ...seller,
      amountRemaining: INDIVIDUAL_SELLER_MINIMUM_SUBTOTAL - seller.subtotal,
    }));
}
