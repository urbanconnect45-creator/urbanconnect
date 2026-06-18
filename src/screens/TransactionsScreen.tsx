import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { TransactionsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { Order } from '../types/business';
import { getDepositStatusLabel } from '../utils/deposits';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';
import { getOrderStatusLabel, getPaymentStatusLabel } from '../utils/order';

type TransactionDirection = 'in' | 'out' | 'neutral';

type TransactionEntry = {
  id: string;
  title: string;
  meta: string;
  amount: number;
  createdAt: string;
  status: string;
  direction: TransactionDirection;
  icon: keyof typeof Ionicons.glyphMap;
};

function orderSellerAmount(order: Order, ownerKeys: string[]) {
  return order.items
    .filter((item) =>
      [item.ownerUserId, item.ownerName]
        .map((key) => key?.trim().toLowerCase())
        .some((key) => Boolean(key && ownerKeys.includes(key))),
    )
    .reduce((total, item) => total + item.lineTotal, 0);
}

function isWarehouseReleased(status: string) {
  return status === 'delivered';
}

export function TransactionsScreen({ navigation }: TransactionsScreenProps) {
  const { user } = useAuth();
  const {
    dynamicDepositAccounts,
    getOrdersForOwner,
    getOrdersForUser,
    getWithdrawalsForOwner,
    subscriptionPayments,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const ownerKeys = useMemo(
    () =>
      [user?.id, user?.email, user?.fullName, user?.businessName]
        .map((key) => key?.trim().toLowerCase())
        .filter((key): key is string => Boolean(key)),
    [user?.businessName, user?.email, user?.fullName, user?.id],
  );
  const orders = useMemo(() => (user ? getOrdersForUser(user.id) : []), [getOrdersForUser, user]);
  const ownerOrders = useMemo(
    () => (user?.role === 'businessOwner' ? getOrdersForOwner(user.id, user) : []),
    [getOrdersForOwner, user],
  );
  const withdrawals = useMemo(
    () => (user?.role === 'businessOwner' ? getWithdrawalsForOwner(user.id) : []),
    [getWithdrawalsForOwner, user],
  );
  const transactions = useMemo<TransactionEntry[]>(() => {
    if (!user) {
      return [];
    }

    const depositEntries: TransactionEntry[] = dynamicDepositAccounts
      .filter((deposit) => deposit.userId === user.id)
      .map((deposit) => ({
        id: deposit.id,
        title: 'Add funds',
        meta:
          deposit.status === 'expired'
            ? deposit.failureReason ?? 'No transfer detected before expiry.'
            : `${deposit.bankName} - ${deposit.accountNumber}`,
        amount: deposit.amount,
        createdAt: deposit.paidAt ?? deposit.updatedAt ?? deposit.createdAt,
        status: getDepositStatusLabel(deposit.status),
        direction: deposit.status === 'paid' ? ('in' as const) : ('neutral' as const),
        icon: 'add-circle-outline' as const,
      }));
    const orderEntries: TransactionEntry[] = orders.map((order) => ({
      id: order.id,
      title: 'Purchase',
      meta: `${order.items.length} item${order.items.length === 1 ? '' : 's'} - ${getOrderStatusLabel(order.status)}`,
      amount: order.totalAmount,
      createdAt: order.updatedAt,
      status: getPaymentStatusLabel(order.paymentStatus),
      direction: 'out' as const,
      icon: 'bag-check-outline' as const,
    }));
    const subscriptionEntries: TransactionEntry[] = subscriptionPayments
      .filter((payment) => payment.ownerUserId === user.id)
      .map((payment) => ({
        id: payment.id,
        title: 'Subscription',
        meta: `${payment.cycle} plan - ${payment.reference}`,
        amount: payment.amount,
        createdAt: payment.paidAt ?? payment.updatedAt,
        status: payment.status,
        direction: 'out' as const,
        icon: 'card-outline' as const,
      }));
    const withdrawalEntries: TransactionEntry[] = withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      title: 'Withdrawal',
      meta: `${withdrawal.bankName} - ${withdrawal.accountNumber}`,
      amount: withdrawal.amount,
      createdAt: withdrawal.createdAt,
      status: 'Paid',
      direction: 'out' as const,
      icon: 'cash-outline' as const,
    }));
    const sellerEntries = ownerOrders.reduce<TransactionEntry[]>((entries, order) => {
        const amount = orderSellerAmount(order, ownerKeys);

        if (amount <= 0 || order.paymentStatus !== 'paid') {
          return entries;
        }

        entries.push({
          id: `seller-${order.id}`,
          title: 'Seller earning',
          meta: `${order.id} - ${getOrderStatusLabel(order.status)}`,
          amount,
          createdAt: order.updatedAt,
          status: isWarehouseReleased(order.status) ? 'Available' : 'Pending',
          direction: 'in' as const,
          icon: 'storefront-outline' as const,
        });

        return entries;
      }, []);

    return [
      ...depositEntries,
      ...orderEntries,
      ...subscriptionEntries,
      ...withdrawalEntries,
      ...sellerEntries,
    ].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [
    dynamicDepositAccounts,
    orders,
    ownerKeys,
    ownerOrders,
    subscriptionPayments,
    user?.id,
    withdrawals,
  ]);
  const totalIn = transactions
    .filter((transaction) => transaction.direction === 'in')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const totalOut = transactions
    .filter((transaction) => transaction.direction === 'out')
    .reduce((total, transaction) => total + transaction.amount, 0);

  if (!user) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons color={colors.white} name="receipt-outline" size={24} />
          </View>
          <AppButton label="Back" onPress={() => navigation.navigate('Account')} variant="ghost" />
        </View>
        <Text style={styles.eyebrow}>Transactions</Text>
        <Text style={styles.title}>Wallet activity</Text>
        <Text style={styles.subtitle}>
          Add funds, purchases, subscriptions, seller earnings, and withdrawals in one place.
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(totalIn)}</Text>
          <Text style={styles.summaryLabel}>Money in</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(totalOut)}</Text>
          <Text style={styles.summaryLabel}>Money out</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatNumber(transactions.length)}</Text>
          <Text style={styles.summaryLabel}>Records</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>All transactions</Text>
        <View style={styles.stack}>
          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow}>
              <View
                style={[
                  styles.transactionIcon,
                  transaction.direction === 'in'
                    ? styles.transactionIconIn
                    : transaction.direction === 'out'
                      ? styles.transactionIconOut
                      : styles.transactionIconNeutral,
                ]}
              >
                <Ionicons color={colors.white} name={transaction.icon} size={20} />
              </View>
              <View style={styles.transactionCopy}>
                <Text numberOfLines={1} style={styles.transactionTitle}>
                  {transaction.title}
                </Text>
                <Text numberOfLines={2} style={styles.transactionMeta}>
                  {transaction.meta}
                </Text>
                <Text style={styles.transactionMeta}>{formatDateTime(transaction.createdAt)}</Text>
              </View>
              <View style={styles.transactionAmountBox}>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.direction === 'in'
                      ? styles.amountIn
                      : transaction.direction === 'out'
                        ? styles.amountOut
                        : styles.amountNeutral,
                  ]}
                >
                  {transaction.direction === 'out' ? '-' : transaction.direction === 'in' ? '+' : ''}
                  {formatCurrency(transaction.amount)}
                </Text>
                <Text style={styles.transactionStatus}>{transaction.status}</Text>
              </View>
            </View>
          ))}
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>Transactions will appear here after wallet activity.</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    hero: {
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    heroIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      width: 52,
      borderRadius: 26,
      backgroundColor: colors.secondary,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#D7EAE2',
    },
    title: {
      ...typography.title,
      color: colors.white,
    },
    subtitle: {
      ...typography.body,
      color: '#D6DFE2',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      minWidth: 150,
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    summaryValue: {
      ...typography.subtitle,
      color: colors.primary,
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    card: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    stack: {
      gap: spacing.sm,
    },
    transactionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 84,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    transactionIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
    },
    transactionIconIn: {
      backgroundColor: colors.success,
    },
    transactionIconOut: {
      backgroundColor: colors.danger,
    },
    transactionIconNeutral: {
      backgroundColor: colors.warning,
    },
    transactionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    transactionTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    transactionMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    transactionAmountBox: {
      alignItems: 'flex-end',
      gap: 2,
      minWidth: 100,
    },
    transactionAmount: {
      ...typography.bodyStrong,
    },
    amountIn: {
      color: colors.success,
    },
    amountOut: {
      color: colors.danger,
    },
    amountNeutral: {
      color: colors.textMuted,
    },
    transactionStatus: {
      ...typography.caption,
      color: colors.textMuted,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
    },
  });
}
