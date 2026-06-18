import type { DynamicDepositAccount } from '../types/business';

export const MINIMUM_ADD_FUNDS_DEPOSIT = 2000;
export const DYNAMIC_DEPOSIT_EXPIRY_MINUTES = 30;
export const DYNAMIC_DEPOSIT_EXPIRY_MS = DYNAMIC_DEPOSIT_EXPIRY_MINUTES * 60 * 1000;
export const DYNAMIC_DEPOSIT_EXPIRY_SECONDS = DYNAMIC_DEPOSIT_EXPIRY_MINUTES * 60;

export const DEPOSIT_TIMEOUT_FAILURE_REASON =
  'Payment was not detected within 30 minutes.';

function toTime(value?: string) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

export function getDynamicDepositExpiresAt(createdAt?: string) {
  const createdTime = toTime(createdAt);
  const baseTime = Number.isFinite(createdTime) ? createdTime : Date.now();

  return new Date(baseTime + DYNAMIC_DEPOSIT_EXPIRY_MS).toISOString();
}

export function getDepositExpiryTime(deposit: Pick<DynamicDepositAccount, 'createdAt' | 'expiresAt'>) {
  const providerExpiry = toTime(deposit.expiresAt);

  if (Number.isFinite(providerExpiry)) {
    return providerExpiry;
  }

  const createdTime = toTime(deposit.createdAt);

  return Number.isFinite(createdTime) ? createdTime + DYNAMIC_DEPOSIT_EXPIRY_MS : Number.NaN;
}

export function isDepositExpired(deposit: DynamicDepositAccount, nowMs = Date.now()) {
  if (deposit.status !== 'pending') {
    return false;
  }

  const expiryTime = getDepositExpiryTime(deposit);

  return Number.isFinite(expiryTime) && expiryTime <= nowMs;
}

export function withDynamicDepositExpiry(deposit: DynamicDepositAccount) {
  if (deposit.expiresAt) {
    return deposit;
  }

  return {
    ...deposit,
    expiresAt: getDynamicDepositExpiresAt(deposit.createdAt),
  };
}

export function expirePendingDeposits(
  deposits: DynamicDepositAccount[],
  nowMs = Date.now(),
) {
  const updatedAt = new Date(nowMs).toISOString();
  const expiredDeposits: DynamicDepositAccount[] = [];
  const nextDeposits = deposits.map((deposit) => {
    if (!isDepositExpired(deposit, nowMs)) {
      return deposit;
    }

    const expiredDeposit: DynamicDepositAccount = {
      ...deposit,
      status: 'expired',
      failureReason: deposit.failureReason ?? DEPOSIT_TIMEOUT_FAILURE_REASON,
      updatedAt,
    };

    expiredDeposits.push(expiredDeposit);
    return expiredDeposit;
  });

  return { deposits: nextDeposits, expiredDeposits };
}

export function getDepositStatusLabel(status: DynamicDepositAccount['status']) {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'expired':
      return 'Failed';
    default:
      return 'Pending';
  }
}
