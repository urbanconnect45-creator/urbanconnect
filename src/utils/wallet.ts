import type { AppUser } from '../types/auth';
import type { DynamicDepositAccount, Order, SubscriptionPayment } from '../types/business';

export const DEMO_WALLET_BALANCE = 200000;
export const BUSINESS_OWNER_DEFAULT_WALLET_BALANCE = 0;

const TEST_ACCOUNT_BALANCES: Record<string, number> = {
  'business.tomi.stone.086729@urbanconnect.test': 50000,
  'danielkenneth616@gmail.com': 50000,
};

function normalizeWalletKey(value?: string | null) {
  return value?.trim().toLowerCase();
}

export function getAccountStartingBalance(user?: AppUser | null) {
  const emailBalance = TEST_ACCOUNT_BALANCES[normalizeWalletKey(user?.email) ?? ''];
  const idBalance = TEST_ACCOUNT_BALANCES[normalizeWalletKey(user?.id) ?? ''];

  if (emailBalance != null) {
    return emailBalance;
  }

  if (idBalance != null) {
    return idBalance;
  }

  return user?.role === 'businessOwner'
    ? BUSINESS_OWNER_DEFAULT_WALLET_BALANCE
    : DEMO_WALLET_BALANCE;
}

export function getBuyerWalletSpent(orders: Order[]) {
  return orders
    .filter(
      (order) =>
        order.paymentMethod === 'walletAccount' &&
        order.status !== 'cancelled' &&
        order.paymentStatus !== 'refunded',
    )
    .reduce((total, order) => total + order.totalAmount, 0);
}

export function getInAppRefundCredit(orders: Order[]) {
  return orders
    .filter(
      (order) =>
        order.paymentStatus === 'refunded' &&
        order.paymentMethod !== 'walletAccount' &&
        order.status !== 'cancelled',
    )
    .reduce((total, order) => total + order.totalAmount, 0);
}

export function getSubscriptionWalletSpent(subscriptionPayments: SubscriptionPayment[]) {
  return subscriptionPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0);
}

export function getPaidDepositTotal(
  deposits: DynamicDepositAccount[] = [],
  user?: AppUser | null,
) {
  return deposits
    .filter((deposit) => deposit.status === 'paid' && (!user || deposit.userId === user.id))
    .reduce((total, deposit) => total + deposit.amount, 0);
}

export function getBuyerWalletBalance(
  orders: Order[],
  subscriptionPayments: SubscriptionPayment[] = [],
  startingBalance = DEMO_WALLET_BALANCE,
  deposits: DynamicDepositAccount[] = [],
  user?: AppUser | null,
) {
  const paidDeposits = getPaidDepositTotal(deposits, user);
  const inAppRefunds = getInAppRefundCredit(orders);
  const spent = getBuyerWalletSpent(orders) + getSubscriptionWalletSpent(subscriptionPayments);

  return Math.max(0, startingBalance + paidDeposits + inAppRefunds - spent);
}

export function getAccountWalletBalance(
  user: AppUser | null | undefined,
  orders: Order[],
  subscriptionPayments: SubscriptionPayment[] = [],
  deposits: DynamicDepositAccount[] = [],
) {
  return getBuyerWalletBalance(
    orders,
    subscriptionPayments,
    getAccountStartingBalance(user),
    deposits,
    user,
  );
}
