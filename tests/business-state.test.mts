import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canAdminEditSensitiveData,
  isPublicBusiness,
  isSubscriptionActive,
  isUserActive,
} from '../src/utils/businessState.ts';

test('only the owner role can edit sensitive admin data', () => {
  assert.equal(canAdminEditSensitiveData('owner'), true);
  assert.equal(canAdminEditSensitiveData('customerCare'), false);
});

test('suspended users and unverified listings are not active/public', () => {
  assert.equal(isUserActive('suspended'), false);
  assert.equal(isUserActive('active'), true);
  assert.equal(isPublicBusiness({ status: 'active', verified: true }), true);
  assert.equal(isPublicBusiness({ status: 'active', verified: false }), false);
  assert.equal(isPublicBusiness({ status: 'archived', verified: true }), false);
});

test('subscription expiry is enforced', () => {
  const now = Date.parse('2026-08-15T00:00:00.000Z');
  assert.equal(isSubscriptionActive('active', '2026-08-16T00:00:00.000Z', now), true);
  assert.equal(isSubscriptionActive('paid', '2026-08-14T00:00:00.000Z', now), false);
  assert.equal(isSubscriptionActive('pending', '2026-08-16T00:00:00.000Z', now), false);
});
