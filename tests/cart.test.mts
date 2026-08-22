import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateProgressiveVat,
  calculateSellerPackingSupport,
} from '../src/utils/cart.ts';

test('progressive VAT uses the configured subtotal bands', () => {
  assert.equal(calculateProgressiveVat(2_999), 0);
  assert.equal(calculateProgressiveVat(3_000), 500);
  assert.equal(calculateProgressiveVat(9_999), 500);
  assert.equal(calculateProgressiveVat(10_000), 1_500);
  assert.equal(calculateProgressiveVat(19_999), 1_500);
  assert.equal(calculateProgressiveVat(20_000), 2_500);
});

test('seller packing support uses the configured subtotal bands', () => {
  assert.equal(calculateSellerPackingSupport(99), 0);
  assert.equal(calculateSellerPackingSupport(100), 50);
  assert.equal(calculateSellerPackingSupport(999), 50);
  assert.equal(calculateSellerPackingSupport(1_000), 100);
  assert.equal(calculateSellerPackingSupport(5_000), 200);
  assert.equal(calculateSellerPackingSupport(10_000), 300);
  assert.equal(calculateSellerPackingSupport(20_000), 500);
  assert.equal(calculateSellerPackingSupport(50_000), 800);
});

test('admin-controlled fee amounts preserve the established subtotal thresholds', () => {
  const settings = {
    vatTierOneAmount: 600,
    vatTierTwoBaseAmount: 1_700,
    vatAdditionalBandAmount: 1_100,
    packingTierOneAmount: 60,
    packingTierTwoAmount: 120,
    packingTierThreeAmount: 240,
    packingTierFourAmount: 360,
    packingTierFiveAmount: 600,
    packingTierSixAmount: 900,
  };

  assert.equal(calculateProgressiveVat(3_000, settings), 600);
  assert.equal(calculateProgressiveVat(20_000, settings), 2_800);
  assert.equal(calculateSellerPackingSupport(5_000, settings), 240);
  assert.equal(calculateSellerPackingSupport(50_000, settings), 900);
});

test('fee helpers reject invalid monetary inputs safely', () => {
  assert.equal(calculateProgressiveVat(Number.NaN), 0);
  assert.equal(calculateSellerPackingSupport(Number.POSITIVE_INFINITY), 0);
});
