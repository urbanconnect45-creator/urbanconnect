import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { PaymentPlanCycle, SubscriptionPayment } from '../types/business';
import { formatCurrency, formatDateTime } from '../utils/format';

type CustomerSubscriptionPayload = {
  nextBillingAt?: string;
  planTitle?: string;
  subscriptionType?: string;
};

function parseCustomerSubscriptionPayload(payment: SubscriptionPayment) {
  try {
    const payload = payment.rawPayload ? JSON.parse(payment.rawPayload) as CustomerSubscriptionPayload : {};

    return payload.subscriptionType === 'customerBenefits' ? payload : undefined;
  } catch {
    return undefined;
  }
}

function benefitsFromDescription(description: string) {
  const benefits = description
    .split(/\n|;/)
    .map((benefit) => benefit.trim())
    .filter(Boolean);

  return benefits.length > 0
    ? benefits
    : ['Member-only marketplace benefits', 'Priority customer care visibility'];
}

export function CustomerBenefitsScreen({ navigation }: MainTabsScreenProps<'CustomerBenefits'>) {
  const { user } = useAuth();
  const {
    getAvailableAccountBalanceForUser,
    paymentPlans,
    payCustomerBenefitSubscriptionWithAccount,
    subscriptionPayments,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [selectedCycle, setSelectedCycle] = useState<PaymentPlanCycle>('monthly');
  const [isPaying, setIsPaying] = useState(false);
  const selectedPlan =
    paymentPlans.find((plan) => plan.cycle === selectedCycle) ??
    paymentPlans.find((plan) => plan.cycle === 'monthly') ??
    paymentPlans[0];
  const customerPayments = useMemo(
    () =>
      subscriptionPayments
        .map((payment) => ({ payment, payload: parseCustomerSubscriptionPayload(payment) }))
        .filter(
          (entry): entry is { payment: SubscriptionPayment; payload: CustomerSubscriptionPayload } =>
            entry.payment.ownerUserId === user?.id &&
            entry.payment.status === 'paid' &&
            Boolean(entry.payload),
        )
        .sort(
          (left, right) =>
            new Date(right.payment.createdAt).getTime() -
            new Date(left.payment.createdAt).getTime(),
        ),
    [subscriptionPayments, user?.id],
  );
  const activeSubscription = customerPayments.find((entry) => {
    const endTime = entry.payload.nextBillingAt
      ? new Date(entry.payload.nextBillingAt).getTime()
      : 0;

    return Number.isFinite(endTime) && endTime > Date.now();
  });
  const accountBalance = user ? getAvailableAccountBalanceForUser(user) : 0;

  const paySubscription = () => {
    if (!user || !selectedPlan) {
      return;
    }

    try {
      setIsPaying(true);
      const payment = payCustomerBenefitSubscriptionWithAccount(user, selectedPlan.cycle);
      const payload = parseCustomerSubscriptionPayload(payment);

      Alert.alert(
        'Subscription active',
        `${selectedPlan.title} is active until ${
          payload?.nextBillingAt ? formatDateTime(payload.nextBillingAt) : 'the next billing date'
        }.`,
      );
    } catch (error) {
      Alert.alert(
        'Payment failed',
        error instanceof Error ? error.message : 'Unable to pay for benefits right now.',
      );
    } finally {
      setIsPaying(false);
    }
  };

  if (!user || user.role !== 'resident') {
    return (
      <View style={styles.gateShell}>
        <Ionicons color={colors.primary} name="sparkles-outline" size={30} />
        <Text style={styles.sectionTitle}>Customer benefits</Text>
        <Text style={styles.bodyText}>
          Sign in with a customer account to pay for customer subscription benefits.
        </Text>
        <AppButton label="Go home" onPress={() => navigation.navigate('Dashboard')} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Customer subscription</Text>
        <Text style={styles.title}>Unlock View2Connect benefits.</Text>
        <Text style={styles.subtitle}>
          Plan names, prices, and benefit copy are controlled from the admin payment plan editor.
        </Text>
      </View>

      <View style={styles.statusGrid}>
        <View style={styles.statusCard}>
          <Ionicons
            color={activeSubscription ? colors.success : colors.warning}
            name="sparkles-outline"
            size={22}
          />
          <Text style={styles.statusValue}>{activeSubscription ? 'Active' : 'Not active'}</Text>
          <Text style={styles.statusLabel}>Benefits status</Text>
        </View>
        <View style={styles.statusCard}>
          <Ionicons color={colors.primary} name="wallet-outline" size={22} />
          <Text style={styles.statusValue}>{formatCurrency(accountBalance)}</Text>
          <Text style={styles.statusLabel}>Account balance</Text>
        </View>
      </View>

      {activeSubscription ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {activeSubscription.payload.planTitle ?? 'Benefits active'}
          </Text>
          <Text style={styles.bodyText}>
            Active until{' '}
            {activeSubscription.payload.nextBillingAt
              ? formatDateTime(activeSubscription.payload.nextBillingAt)
              : 'the next billing date'}
            .
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Choose a plan</Text>
        <View style={styles.planGrid}>
          {paymentPlans.map((plan) => {
            const isSelected = selectedCycle === plan.cycle;

            return (
              <Pressable
                key={plan.cycle}
                onPress={() => setSelectedCycle(plan.cycle)}
                style={({ pressed }) => [
                  styles.planCard,
                  isSelected && styles.planCardActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.planTitle, isSelected && styles.planTitleActive]}>
                  {plan.title}
                </Text>
                <Text style={[styles.planAmount, isSelected && styles.planTitleActive]}>
                  {formatCurrency(plan.amount)} / {plan.cycle}
                </Text>
                <View style={styles.benefitList}>
                  {benefitsFromDescription(plan.description).map((benefit) => (
                    <View key={benefit} style={styles.benefitRow}>
                      <Ionicons
                        color={isSelected ? colors.white : colors.primary}
                        name="checkmark-circle-outline"
                        size={16}
                      />
                      <Text style={[styles.benefitText, isSelected && styles.planTitleActive]}>
                        {benefit}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Amount due</Text>
          <Text style={styles.totalValue}>
            {selectedPlan ? formatCurrency(selectedPlan.amount) : formatCurrency(0)}
          </Text>
        </View>
        <AppButton
          disabled={!selectedPlan || Boolean(selectedPlan && selectedPlan.amount > accountBalance)}
          label={isPaying ? 'Paying...' : 'Pay from account balance'}
          loading={isPaying}
          onPress={paySubscription}
        />
        {selectedPlan && selectedPlan.amount > accountBalance ? (
          <AppButton
            label="Open wallet"
            onPress={() => navigation.navigate('Transactions')}
            variant="secondary"
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment history</Text>
        {customerPayments.length > 0 ? (
          customerPayments.map(({ payment, payload }) => (
            <View key={payment.reference} style={styles.historyRow}>
              <View style={styles.historyCopy}>
                <Text style={styles.historyTitle}>{payload.planTitle ?? payment.reference}</Text>
                <Text style={styles.bodyText}>
                  {formatCurrency(payment.amount)} paid {formatDateTime(payment.createdAt)}
                </Text>
                {payload.nextBillingAt ? (
                  <Text style={styles.bodyText}>Until {formatDateTime(payload.nextBillingAt)}</Text>
                ) : null}
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Paid</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.bodyText}>Customer benefit payments will appear here.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    gateShell: {
      gap: spacing.md,
      padding: spacing.lg,
    },
    hero: {
      gap: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
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
    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    statusCard: {
      flex: 1,
      minWidth: 160,
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
      ...shadows.soft,
    },
    statusValue: {
      ...typography.section,
      color: colors.text,
    },
    statusLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    card: {
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.lg,
      ...shadows.soft,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    planGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    planCard: {
      flex: 1,
      minWidth: 220,
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    planCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    pressed: {
      opacity: 0.88,
    },
    planTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    planAmount: {
      ...typography.section,
      color: colors.primary,
    },
    planTitleActive: {
      color: colors.white,
    },
    benefitList: {
      gap: spacing.xs,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    benefitText: {
      ...typography.caption,
      color: colors.textMuted,
      flex: 1,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    totalLabel: {
      ...typography.body,
      color: colors.textMuted,
    },
    totalValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    historyCopy: {
      flex: 1,
      gap: 2,
    },
    historyTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    badge: {
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    badgeText: {
      ...typography.caption,
      color: colors.success,
      fontWeight: '800',
    },
  });
}
