import type { CartEntry } from '../types/business';

export const INDIVIDUAL_SELLER_MINIMUM_SUBTOTAL = 3000;

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
