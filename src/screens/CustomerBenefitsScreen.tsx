import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FlutterwaveCheckoutModal } from '../components/FlutterwaveCheckoutModal';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { PaymentPlanCycle, SubscriptionPayment } from '../types/business';
import {
  parseCustomerSubscriptionPayload,
  type CustomerSubscriptionPayload,
} from '../utils/customerBenefits';
import { formatCurrency, formatDateTime } from '../utils/format';

const benefitDurationOptions = [
  {
    id: 'testing-30m',
    label: '30-Minute Testing',
    minutes: 30,
    discountRate: 0,
    description: 'Short test promotion for checking Home priority and the premium badge.',
  },
  {
    id: '1-month',
    label: '1 month',
    months: 1,
    discountRate: 0,
    description: 'Promotes approved customer adverts for one month.',
  },
  {
    id: '3-months',
    label: '3 months',
    months: 3,
    discountRate: 0.05,
    description: 'Keeps approved customer adverts prioritized for three months.',
  },
  {
    id: '6-months',
    label: '6 months',
    months: 6,
    discountRate: 0.1,
    description: 'Longer advert priority with a stronger discount.',
  },
  {
    id: '12-months',
    label: '12 months',
    months: 12,
    discountRate: 0.15,
    description: 'Year-round priority placement for approved customer adverts.',
  },
] as const;

function discountCopy(rate: number) {
  return rate > 0 ? `${Math.round(rate * 100)}% off` : 'No discount';
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
    paymentPlans,
    startCustomerBenefitFlutterwaveCheckout,
    subscriptionPayments,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [selectedCycle, setSelectedCycle] = useState<PaymentPlanCycle>('monthly');
  const [selectedDurationId, setSelectedDurationId] = useState('1-month');
  const [isPaying, setIsPaying] = useState(false);
  const [activeCheckout, setActiveCheckout] = useState<{
    checkoutUrl: string;
    reference: string;
    amount: number;
  } | null>(null);
  const selectedPlan =
    paymentPlans.find((plan) => plan.cycle === selectedCycle) ??
    paymentPlans.find((plan) => plan.cycle === 'monthly') ??
    paymentPlans[0];
  const selectedDuration =
    benefitDurationOptions.find((option) => option.id === selectedDurationId) ??
    benefitDurationOptions[1];
  const durationMonths = 'months' in selectedDuration ? selectedDuration.months : 1;
  const durationMinutes = 'minutes' in selectedDuration ? selectedDuration.minutes : undefined;
  const planMinutes = selectedPlan?.cycle === 'weekly' ? 7 * 24 * 60 : 30 * 24 * 60;
  const amountBeforeDiscount = selectedPlan
    ? durationMinutes
      ? Math.max(100, Math.round((selectedPlan.amount * durationMinutes) / planMinutes))
      : selectedPlan.amount * durationMonths
    : 0;
  const discountAmount = Math.round(amountBeforeDiscount * selectedDuration.discountRate);
  const amountDue = Math.max(0, amountBeforeDiscount - discountAmount);
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
  const paySubscription = async () => {
    if (!user || !selectedPlan) {
      return;
    }

    try {
      setIsPaying(true);
      const checkout = await startCustomerBenefitFlutterwaveCheckout(
        user,
        selectedPlan.cycle,
        durationMonths,
        durationMinutes,
        amountDue,
        discountAmount,
      );
      setActiveCheckout({
        checkoutUrl: checkout.checkoutUrl,
        reference: checkout.reference,
        amount: checkout.amount,
      });
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
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Customer subscription</Text>
        <Text style={styles.title}>Unlock View2Connect benefits.</Text>
        <Text style={styles.subtitle}>
          Choose a plan and duration to promote your approved customer advertisements.
        </Text>
        <Text style={styles.subtitle}>
          Active plans promote your approved customer adverts on Home and show a premium badge
          only while the plan is active.
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
          <Ionicons color={colors.primary} name="card-outline" size={22} />
          <Text style={styles.statusValue}>Flutterwave</Text>
          <Text style={styles.statusLabel}>Secure payment</Text>
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
        <Text style={styles.bodyText}>
          Customer advert plans move your approved adverts above normal adverts during the active
          period. When the plan expires, priority placement stops and the advert returns to normal
          date-based placement.
        </Text>
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

        <Text style={styles.sectionTitle}>Choose duration</Text>
        <View style={styles.durationGrid}>
          {benefitDurationOptions.map((option) => {
            const isSelected = selectedDuration.id === option.id;

            return (
              <Pressable
                key={option.id}
                onPress={() => setSelectedDurationId(option.id)}
                style={({ pressed }) => [
                  styles.durationCard,
                  isSelected && styles.durationCardActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.durationLabel, isSelected && styles.planTitleActive]}>
                  {option.label}
                </Text>
                <Text style={[styles.durationMeta, isSelected && styles.planTitleActive]}>
                  {discountCopy(option.discountRate)}
                </Text>
                <Text style={[styles.durationMeta, isSelected && styles.planTitleActive]}>
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summaryStack}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Before discount</Text>
            <Text style={styles.totalValue}>{formatCurrency(amountBeforeDiscount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={styles.totalValue}>-{formatCurrency(discountAmount)}</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Amount due</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(amountDue)}
          </Text>
        </View>
        <AppButton
          disabled={!selectedPlan}
          label={isPaying ? 'Opening checkout...' : 'Pay with Flutterwave'}
          loading={isPaying}
          onPress={() => void paySubscription()}
        />
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
                {payload.durationLabel || payload.durationMinutes || payload.durationMonths ? (
                  <Text style={styles.bodyText}>
                    Duration{' '}
                    {payload.durationLabel ??
                      (payload.durationMinutes
                        ? `${payload.durationMinutes} minute${
                            payload.durationMinutes === 1 ? '' : 's'
                          }`
                        : undefined) ??
                      `${payload.durationMonths} month${payload.durationMonths === 1 ? '' : 's'}`}
                  </Text>
                ) : null}
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
    {activeCheckout ? (
      <FlutterwaveCheckoutModal
        checkoutUrl={activeCheckout.checkoutUrl}
        onClose={() => setActiveCheckout(null)}
        reference={activeCheckout.reference}
        subtitle={`Pay ${formatCurrency(activeCheckout.amount)} to activate advert priority after Flutterwave confirms payment.`}
        title="Customer advert promotion"
        visible
      />
    ) : null}
    </>
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
    durationGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    durationCard: {
      flex: 1,
      minWidth: 130,
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    durationCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    durationLabel: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    durationMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    summaryStack: {
      gap: spacing.xs,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: spacing.md,
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
