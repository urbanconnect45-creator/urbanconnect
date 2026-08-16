import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBuyerWalletBalance,
  getPaidDepositTotal,
  getPaidWithdrawalTotal,
} from '../src/utils/wallet.ts';

const user = {
  id: 'customer-1',
  firstName: 'Test',
  lastName: 'Buyer',
  fullName: 'Test Buyer',
  email: 'buyer@example.com',
  phoneNumber: '+2348000000000',
  role: 'resident' as const,
  estateId: 'river-park',
  createdAt: '2026-08-15T00:00:00.000Z',
};

test('wallet totals include only paid records belonging to the account', () => {
  const deposits = [
    { id: 'd1', userId: user.id, amount: 2_000, status: 'paid' },
    { id: 'd2', userId: user.id, amount: 8_000, status: 'pending' },
    { id: 'd3', userId: 'someone-else', amount: 9_000, status: 'paid' },
  ] as never[];
  const withdrawals = [
    { id: 'w1', ownerUserId: user.id, amount: 500, status: 'paid' },
    { id: 'w2', ownerUserId: user.id, amount: 700, status: 'processing' },
  ] as never[];

  assert.equal(getPaidDepositTotal(deposits, user), 2_000);
  assert.equal(getPaidWithdrawalTotal(withdrawals, user), 500);
});

test('wallet balance ignores unpaid orders and never becomes negative', () => {
  const orders = [
    {
      id: 'o1',
      paymentMethod: 'walletAccount',
      paymentStatus: 'paid',
      status: 'placed',
      totalAmount: 1_200,
    },
    {
      id: 'o2',
      paymentMethod: 'flutterwave',
      paymentStatus: 'paid',
      status: 'placed',
      totalAmount: 9_999,
    },
  ] as never[];

  assert.equal(getBuyerWalletBalance(orders, [], 2_000), 800);
  assert.equal(getBuyerWalletBalance(orders, [], 100), 0);
});
