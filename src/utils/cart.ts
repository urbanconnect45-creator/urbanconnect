import type { CartEntry } from '../types/business';

export const INDIVIDUAL_SELLER_MINIMUM_SUBTOTAL = 3000;

export function calculateProgressiveVat(subtotal: number) {
  if (!Number.isFinite(subtotal) || subtotal < 3000) {
    return 0;
  }

  if (subtotal < 10000) {
    return 500;
  }

  const higherBandIndex = Math.floor((subtotal - 10000) / 10000);

  return 1500 + higherBandIndex * 1000;
}

export function calculateSellerPackingSupport(subtotal: number) {
  if (!Number.isFinite(subtotal) || subtotal < 100) {
    return 0;
  }

  if (subtotal < 1000) {
    return 50;
  }

  if (subtotal < 5000) {
    return 100;
  }

  if (subtotal < 10000) {
    return 200;
  }

  if (subtotal < 20000) {
    return 300;
  }

  if (subtotal < 50000) {
    return 500;
  }

  return 800;
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
