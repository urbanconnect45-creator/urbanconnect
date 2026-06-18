import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FlutterwaveCheckoutModal } from '../components/FlutterwaveCheckoutModal';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { PaymentPlan, PaymentPlanCycle } from '../types/business';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';
import { isSubscriptionActive } from '../utils/businessState';
import { getAccountWalletBalance } from '../utils/wallet';

type SubscriptionDurationOption = {
  id: string;
  label: string;
  cycle: PaymentPlanCycle;
  amount: number;
  description: string;
  months?: number;
  minutes?: number;
};

type ActiveFlutterwaveCheckout = {
  checkoutUrl: string;
  reference: string;
  title: string;
  subtitle: string;
};

const SUBSCRIPTION_CARD_WIDTH = 156;
const SUBSCRIPTION_CARD_GAP = spacing.sm;

function discountedMonthlyAmount(months: number, monthlyAmount: number) {
  if (months <= 1) {
    return monthlyAmount;
  }

  return monthlyAmount + (months - 1) * Math.round(monthlyAmount / 2);
}

function buildSubscriptionDurationOptions(paymentPlans: PaymentPlan[]): SubscriptionDurationOption[] {
  const weeklyPlan = paymentPlans.find((plan) => plan.cycle === 'weekly');
  const monthlyPlan = paymentPlans.find((plan) => plan.cycle === 'monthly');
  const weeklyAmount = weeklyPlan?.amount ?? 4000;
  const monthlyAmount = monthlyPlan?.amount ?? 15000;
  const testingAmount = Math.max(500, Math.round(monthlyAmount / 30));

  return [
    {
      id: '30m',
      label: '30 minutes',
      cycle: 'monthly',
      amount: testingAmount,
      minutes: 30,
      description: 'Testing window',
    },
    {
      id: '1w',
      label: '1 week',
      cycle: 'weekly',
      amount: weeklyAmount,
      description: weeklyPlan?.description ?? 'Short listing run',
    },
    ...Array.from({ length: 12 }, (_, index) => {
      const months = index + 1;

      return {
        id: `${months}m`,
        label: `${months} month${months > 1 ? 's' : ''}`,
        cycle: 'monthly' as const,
        amount: discountedMonthlyAmount(months, monthlyAmount),
        months,
        description:
          months === 1
            ? monthlyPlan?.description ?? 'Standard monthly price'
            : 'Extra months 50% off',
      };
    }),
  ];
}

function subscriptionStatusLabel(status?: string, isActive = false) {
  if (status === 'paid' || status === 'active') {
    return isActive ? 'Paid' : 'Expired';
  }

  return 'Pending';
}

export function SubscriptionScreen({ navigation }: MainTabsScreenProps<'Subscription'>) {
  const { user } = useAuth();
  const {
    businesses,
    dynamicDepositAccounts,
    getOwnerBusinessProfile,
    getOrdersForUser,
    isSubscriptionExemptForUser,
    isRiverParkVerifiedForUser,
    paymentPlans,
    payOwnerSubscriptionWithAccount,
    startOwnerSubscriptionFlutterwaveCheckout,
    subscriptionPayments,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const ownerProfile = useMemo(() => getOwnerBusinessProfile(user), [getOwnerBusinessProfile, user]);
  const ownerListings = useMemo(
    () =>
      businesses.filter(
        (business) =>
          business.ownerUserId === user?.id ||
          business.ownerEmail === user?.email ||
          business.ownerName === user?.fullName,
      ),
    [businesses, user?.email, user?.fullName, user?.id],
  );
  const [selectedDurationId, setSelectedDurationId] = useState('30m');
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activeFlutterwaveCheckout, setActiveFlutterwaveCheckout] =
    useState<ActiveFlutterwaveCheckout | null>(null);
  const subscriptionDurationOptions = useMemo(
    () => buildSubscriptionDurationOptions(paymentPlans),
    [paymentPlans],
  );

  useEffect(() => {
    const refreshTimer = setInterval(() => setNow(Date.now()), 60000);

    return () => clearInterval(refreshTimer);
  }, []);

  if (!user || user.role !== 'businessOwner') {
    return (
      <View style={styles.gateShell}>
        <Text style={styles.sectionTitle}>Business subscription only</Text>
        <Text style={styles.bodyText}>
          Sign in with a business owner account to manage listing subscriptions.
        </Text>
        <AppButton label="Go home" onPress={() => navigation.navigate('Dashboard')} />
      </View>
    );
  }

  const itemCount = Math.max(1, ownerListings.length);
  const selectedDuration =
    subscriptionDurationOptions.find((option) => option.id === selectedDurationId) ??
    subscriptionDurationOptions[0]!;
  const durationMonths = selectedDuration.months ?? 1;
  const durationMinutes = selectedDuration.minutes;
  const amountDue = selectedDuration.amount * itemCount;
  const ownerPayments = subscriptionPayments.filter((payment) => payment.ownerUserId === user.id);
  const ownerDeposits = dynamicDepositAccounts.filter((deposit) => deposit.userId === user.id);
  const accountBalance = getAccountWalletBalance(
    user,
    getOrdersForUser(user.id),
    ownerPayments,
    ownerDeposits,
  );
  const status = ownerProfile?.subscriptionStatus ?? ownerListings[0]?.subscriptionStatus;
  const nextBillingAt =
    ownerProfile?.subscriptionNextBillingAt ?? ownerListings[0]?.subscriptionNextBillingAt;
  const subscriptionExempt = isSubscriptionExemptForUser(user);
  const subscriptionIsActive = subscriptionExempt || isSubscriptionActive(status, nextBillingAt, now);
  const riverParkVerified = isRiverParkVerifiedForUser(user);

  const startFlutterwavePayment = async () => {
    try {
      setIsStartingPayment(true);
      const checkout = await startOwnerSubscriptionFlutterwaveCheckout(
        user,
        selectedDuration.cycle,
        durationMonths,
        durationMinutes,
        selectedDuration.amount,
      );

      setActiveFlutterwaveCheckout({
        checkoutUrl: checkout.checkoutUrl,
        reference: checkout.reference,
        title: 'Subscription checkout',
        subtitle: `Pay ${formatCurrency(checkout.amount)} with card or bank transfer.`,
      });
    } catch (paymentError) {
      const message =
        paymentError instanceof Error
          ? paymentError.message
          : 'Unable to start Flutterwave checkout right now.';
      Alert.alert('Flutterwave payment failed', message);
    } finally {
      setIsStartingPayment(false);
    }
  };

  const closeFlutterwaveCheckout = () => {
    setActiveFlutterwaveCheckout(null);
  };

  const handleFlutterwaveReturn = () => {
    setActiveFlutterwaveCheckout(null);
    Alert.alert(
      'Payment submitted',
      'Your subscription activates automatically after Flutterwave confirms payment.',
    );
  };

  const startAccountPayment = () => {
    try {
      setIsStartingPayment(true);
      const payment = payOwnerSubscriptionWithAccount(
        user,
        selectedDuration.cycle,
        durationMonths,
        durationMinutes,
        selectedDuration.amount,
      );
      Alert.alert(
        'Subscription active',
        `Paid ${formatCurrency(payment.amount)} from your UrbanConnect account. Your listings are now active.`,
      );
    } catch (paymentError) {
      const message =
        paymentError instanceof Error
          ? paymentError.message
          : 'Unable to pay from your UrbanConnect account right now.';
      Alert.alert('Payment failed', message);
    } finally {
      setIsStartingPayment(false);
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Business subscription</Text>
        <Text style={styles.title}>Pay from your UrbanConnect account.</Text>
        <Text style={styles.subtitle}>
          {subscriptionExempt
            ? 'This account is covered by the owner admin subscription exemption.'
            : 'Your current account balance can activate every listing on this business profile. Listings without an active subscription stay hidden from Home.'}
        </Text>
      </View>

      <View style={styles.statusGrid}>
        <View style={styles.statusCard}>
          <Ionicons
            color={subscriptionIsActive ? colors.success : colors.warning}
            name="card-outline"
            size={22}
          />
          <Text style={styles.statusValue}>
            {subscriptionExempt ? 'Exempt' : subscriptionStatusLabel(status, subscriptionIsActive)}
          </Text>
          <Text style={styles.statusLabel}>
            {subscriptionExempt ? 'Admin exemption' : 'Subscription payment'}
          </Text>
        </View>
        <View style={styles.statusCard}>
          <Ionicons
            color={riverParkVerified ? colors.success : colors.warning}
            name="home-outline"
            size={22}
          />
          <Text style={styles.statusValue}>{riverParkVerified ? 'Verified' : 'Pending'}</Text>
          <Text style={styles.statusLabel}>River Park account</Text>
        </View>
        <View style={styles.statusCard}>
          <Ionicons color={colors.primary} name="storefront-outline" size={22} />
          <Text style={styles.statusValue}>{formatNumber(ownerListings.length)}</Text>
          <Text style={styles.statusLabel}>Listings covered</Text>
        </View>
      </View>

      {subscriptionIsActive ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {subscriptionExempt ? 'Admin exemption active' : 'Subscription active'}
          </Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Active until</Text>
            <Text style={styles.totalValue}>
              {subscriptionExempt
                ? 'No billing required'
                : nextBillingAt
                  ? formatDateTime(nextBillingAt)
                  : 'No end date set'}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Listings covered</Text>
            <Text style={styles.totalValue}>{formatNumber(itemCount)}</Text>
          </View>
          <Text style={styles.bodyText}>
            {subscriptionExempt
              ? 'Only the owner admin can move this exemption to another account.'
              : 'The duration card will return automatically when this subscription expires.'}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose subscription duration</Text>
          <ScrollView
            decelerationRate="fast"
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={SUBSCRIPTION_CARD_WIDTH + SUBSCRIPTION_CARD_GAP}
            style={styles.planCarousel}
            contentContainerStyle={styles.planCarouselContent}
          >
            {subscriptionDurationOptions.map((option) => {
              const isSelected = selectedDurationId === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedDurationId(option.id)}
                  style={({ pressed }) => [
                    styles.planCard,
                    isSelected && styles.planCardActive,
                    pressed && styles.planCardPressed,
                  ]}
                >
                  <Text style={[styles.planTitle, isSelected && styles.planTitleActive]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.planAmount, isSelected && styles.planTitleActive]}>
                    {formatCurrency(option.amount)}
                  </Text>
                  <Text style={[styles.planDescription, isSelected && styles.planTitleActive]}>
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Amount due</Text>
            <Text style={styles.totalValue}>{formatCurrency(amountDue)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Account balance</Text>
            <Text style={styles.totalValue}>{formatCurrency(accountBalance)}</Text>
          </View>
          <Text style={styles.bodyText}>
            This amount covers {formatNumber(itemCount)} listing{itemCount > 1 ? 's' : ''}. Paid
            plans turn your listings gold and make them visible on Home immediately.
          </Text>
          <AppButton
            label="Pay with Flutterwave"
            loading={isStartingPayment}
            onPress={() => void startFlutterwavePayment()}
          />
          <AppButton
            disabled={amountDue > accountBalance}
            label="Pay from account balance"
            onPress={startAccountPayment}
            variant="secondary"
          />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment history</Text>
        <View style={styles.historyStack}>
          {ownerPayments.length > 0 ? (
            ownerPayments.map((payment) => (
              <View key={payment.reference} style={styles.historyRow}>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>{payment.reference}</Text>
                  <Text style={styles.historyMeta}>
                    {payment.currency} {formatCurrency(payment.amount)} - {payment.status}
                  </Text>
                  <Text style={styles.historyMeta}>{formatDateTime(payment.createdAt)}</Text>
                </View>
                <View style={[styles.badge, payment.status === 'paid' && styles.badgePaid]}>
                  <Text style={[styles.badgeText, payment.status === 'paid' && styles.badgeTextPaid]}>
                    {payment.status}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>Account subscription payments will appear here.</Text>
          )}
        </View>
      </View>
    </ScrollView>
    {activeFlutterwaveCheckout ? (
      <FlutterwaveCheckoutModal
        key={activeFlutterwaveCheckout.checkoutUrl}
        checkoutUrl={activeFlutterwaveCheckout.checkoutUrl}
        onClose={closeFlutterwaveCheckout}
        onPaymentReturn={handleFlutterwaveReturn}
        reference={activeFlutterwaveCheckout.reference}
        subtitle={activeFlutterwaveCheckout.subtitle}
        title={activeFlutterwaveCheckout.title}
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
      borderRadius: radii.xl,
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
      minWidth: 180,
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    planCarousel: {
      marginHorizontal: -spacing.xs,
    },
    planCarouselContent: {
      gap: SUBSCRIPTION_CARD_GAP,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    planCard: {
      width: SUBSCRIPTION_CARD_WIDTH,
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    planCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    planCardPressed: {
      opacity: 0.92,
    },
    planTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    planTitleActive: {
      color: colors.white,
    },
    planAmount: {
      ...typography.section,
      color: colors.text,
    },
    planDescription: {
      ...typography.caption,
      color: colors.textMuted,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    totalLabel: {
      ...typography.body,
      color: colors.textMuted,
    },
    totalValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    historyStack: {
      gap: spacing.sm,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    historyCopy: {
      flex: 1,
      gap: 4,
    },
    historyTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    historyMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    badge: {
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    badgePaid: {
      backgroundColor: colors.primarySoft,
    },
    badgeText: {
      ...typography.caption,
      color: colors.warning,
    },
    badgeTextPaid: {
      color: colors.success,
    },
  });
}
