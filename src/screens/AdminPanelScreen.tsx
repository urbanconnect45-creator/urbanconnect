import { Ionicons } from '@expo/vector-icons';
import { createElement, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import { UrbanConnectLogo } from '../components/UrbanConnectLogo';
import {
  privacyPolicySections,
  privacyPolicyTitle,
  userAgreementSections,
  userAgreementTitle,
} from '../data/policies';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import { isLocalOnlyMediaUrl } from '../utils/businessMedia';
import { getBusinessStatusLabel, getUserStatusLabel, isPublicBusiness } from '../utils/businessState';
import type { AppUser } from '../types/auth';
import type {
  Business,
  BusinessMedia,
  DynamicDepositAccount,
  ListingType,
  Order,
  OwnerBusinessProfile,
  PaymentPlan,
  OrderStatus,
  PaymentPlanCycle,
  PaymentStatus,
  SecuritySettings,
  SubscriptionPayment,
  SupportConversation,
} from '../types/business';
import { downloadCsv } from '../utils/csv';
import { getDepositStatusLabel } from '../utils/deposits';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';
import { getAccountStartingBalance, getAccountWalletBalance } from '../utils/wallet';
import {
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from '../utils/order';

type AdminSectionKey =
  | 'overview'
  | 'orders'
  | 'inventory'
  | 'analytics'
  | 'finance'
  | 'payments'
  | 'codes'
  | 'emails'
  | 'users'
  | 'listings'
  | 'chats'
  | 'customerCare'
  | 'policies'
  | 'security';

type AdminPinPrompt = {
  title: string;
  message: string;
  action: () => void;
};

const userRoleOptions = ['All', 'resident', 'businessOwner'] as const;
const userStatusOptions = ['All', 'active', 'suspended'] as const;
const listingTypeOptions = ['All', 'product', 'profession'] as const;
const listingStatusOptions = ['All', 'active'] as const;
const verificationOptions = ['All', 'Verified', 'Unverified'] as const;
const orderStatusOptions = [
  'All',
  'placed',
  'packed',
  'outForDelivery',
  'delivered',
  'cancelled',
] as const;
const paymentStatusOptions = ['All', 'pending', 'paid', 'refunded'] as const;

type GlobalSearchResult = {
  id: string;
  title: string;
  meta: string;
  section: AdminSectionKey;
};

const adminSections: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  key: AdminSectionKey;
  label: string;
}> = [
  { key: 'overview', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'emails', label: 'Emails', icon: 'mail-outline' },
  { key: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { key: 'inventory', label: 'Inventory', icon: 'cube-outline' },
  { key: 'analytics', label: 'Analytics', icon: 'stats-chart-outline' },
  { key: 'finance', label: 'Finance', icon: 'cash-outline' },
  { key: 'payments', label: 'Payments', icon: 'card-outline' },
  { key: 'codes', label: 'Codes', icon: 'keypad-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'listings', label: 'Listings', icon: 'storefront-outline' },
  { key: 'chats', label: 'Support', icon: 'headset-outline' },
  { key: 'customerCare', label: 'Customer care', icon: 'shield-outline' },
  { key: 'policies', label: 'Policies', icon: 'document-text-outline' },
  { key: 'security', label: 'Security', icon: 'lock-closed-outline' },
];

type MetricCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

type SectionPanelProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

type MiniBarsProps = {
  bars: number[];
  color: string;
};

type AdminSubscriptionDurationOption = {
  id: string;
  label: string;
  cycle: PaymentPlanCycle;
  amount: number;
  description: string;
  months?: number;
  minutes?: number;
};

function discountedMonthlyAmount(months: number, monthlyAmount: number) {
  if (months <= 1) {
    return monthlyAmount;
  }

  return monthlyAmount + (months - 1) * Math.round(monthlyAmount / 2);
}

function buildAdminSubscriptionDurationOptions(
  paymentPlans: PaymentPlan[],
): AdminSubscriptionDurationOption[] {
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

type AdminPanelScreenProps = {
  onReturnToApp: () => void;
};

function SectionPanel({ action, children, subtitle, title }: SectionPanelProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelHeaderCopy}>
          <Text style={styles.panelTitle}>{title}</Text>
          <Text style={styles.panelSubtitle}>{subtitle}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function MonoButton({
  dark = true,
  disabled = false,
  label,
  onPress,
}: {
  dark?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monoButton,
        dark ? styles.monoButtonDark : styles.monoButtonLight,
        disabled && styles.monoButtonDisabled,
        pressed && !disabled && styles.monoButtonPressed,
      ]}
    >
      <Text
        style={[
          styles.monoButtonText,
          dark ? styles.monoButtonTextDark : styles.monoButtonTextLight,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MetricCard({ icon, label, value }: MetricCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconShell}>
        <Ionicons color={colors.white} name={icon} size={18} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MiniBars({ bars, color }: MiniBarsProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.miniBars}>
      {bars.map((bar, index) => (
        <View key={`${bar}-${index}`} style={styles.miniBarTrack}>
          <View
            style={[
              styles.miniBarFill,
              {
                backgroundColor: color,
                height: `${Math.max(10, Math.min(100, bar))}%`,
              },
            ]}
          />
        </View>
      ))}
      <View pointerEvents="none" style={styles.chartOverlayGrid} />
    </View>
  );
}

function listingTypeLabel(value: ListingType) {
  return value === 'product' ? 'Product' : 'Profession';
}

function verificationLabel(value: boolean) {
  return value ? 'Verified' : 'Unverified';
}

function adminRoleLabel(role: 'owner' | 'customerCare') {
  return role === 'owner' ? 'Owner' : 'Customer care';
}

function paymentCycleLabel(cycle: PaymentPlanCycle) {
  return cycle === 'weekly' ? 'Weekly' : 'Monthly';
}

function subscriptionStatusLabel(status?: string) {
  return status === 'paid' || status === 'active' ? 'Paid' : 'Pending';
}

function isSubscriptionActive(status?: string, nextBillingAt?: string) {
  return (
    (status === 'paid' || status === 'active') &&
    (!nextBillingAt || new Date(nextBillingAt).getTime() > Date.now())
  );
}

function subscriptionWindowLabel(nextBillingAt?: string) {
  if (!nextBillingAt) {
    return 'No active expiry';
  }

  const expiresAt = new Date(nextBillingAt).getTime();

  if (expiresAt <= Date.now()) {
    return `Expired ${formatDateTime(nextBillingAt)}`;
  }

  return `Active until ${formatDateTime(nextBillingAt)}`;
}

function parseSubscriptionPaymentPayload(payment: SubscriptionPayment) {
  if (!payment.rawPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(payment.rawPayload) as {
      amountPerListing?: unknown;
      durationLabel?: unknown;
      durationMinutes?: unknown;
      durationMonths?: unknown;
    };

    return payload;
  } catch {
    return null;
  }
}

function subscriptionPaymentDurationLabel(payment: SubscriptionPayment) {
  const payload = parseSubscriptionPaymentPayload(payment);

  if (typeof payload?.durationLabel === 'string' && payload.durationLabel.trim()) {
    return payload.durationLabel.trim();
  }

  if (typeof payload?.durationMinutes === 'number' && payload.durationMinutes > 0) {
    return `${payload.durationMinutes} minute${payload.durationMinutes === 1 ? '' : 's'}`;
  }

  if (
    payment.cycle === 'monthly' &&
    typeof payload?.durationMonths === 'number' &&
    payload.durationMonths > 0
  ) {
    return `${payload.durationMonths} month${payload.durationMonths === 1 ? '' : 's'}`;
  }

  return paymentCycleLabel(payment.cycle);
}

function subscriptionPaymentAmountPerListing(payment: SubscriptionPayment) {
  const payload = parseSubscriptionPaymentPayload(payment);

  return typeof payload?.amountPerListing === 'number' && payload.amountPerListing > 0
    ? payload.amountPerListing
    : payment.amount;
}

function flutterwaveDepositChannelLabel(deposit: DynamicDepositAccount) {
  return deposit.bankName === 'Flutterwave Checkout' ? 'Checkout' : 'Generated bank account';
}

function flutterwaveDepositDetailLabel(deposit: DynamicDepositAccount) {
  if (deposit.bankName === 'Flutterwave Checkout') {
    return `Reference ${deposit.reference}`;
  }

  return `${deposit.bankName} - ${deposit.accountNumber}`;
}

function userStatusChipLabel(status: (typeof userStatusOptions)[number]) {
  return status === 'All' ? 'All statuses' : getUserStatusLabel(status);
}

function listingStatusChipLabel(status: (typeof listingStatusOptions)[number]) {
  return status === 'All' ? 'All statuses' : 'Active';
}

function nextOrderStatus(status: OrderStatus) {
  switch (status) {
    case 'placed':
      return 'packed';
    case 'packed':
      return 'outForDelivery';
    case 'outForDelivery':
      return 'delivered';
    default:
      return null;
  }
}

function isOpenOrder(status: OrderStatus) {
  return status !== 'delivered' && status !== 'cancelled';
}

function asPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getLatestUserSupportMessage(conversation: SupportConversation) {
  return [...conversation.messages]
    .reverse()
    .find(
      (message) =>
        message.senderRole === 'resident' || message.senderRole === 'businessOwner',
    );
}

export function AdminPanelScreen({ onReturnToApp }: AdminPanelScreenProps) {
  const {
    adminUser,
    adminUsers,
    signOutAdmin,
    setUserStatus,
    setUserRiverParkVerification,
    users,
    setAdminAccountActive,
    createCustomerCareAccount,
    updateAdminPassword,
  } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const {
    auditLogs,
    businesses,
    dynamicDepositAccounts,
    estates,
    emailLogs,
    getAvailableStock,
    getSupportConversations,
    orders,
    orderProgressSettings,
    ownerBusinessProfiles,
    paymentPlans,
    subscriptionPayments,
    updatePaymentPlan,
    updateOrderProgressCode,
    restockBusinessStock,
    securitySettings,
    confirmOwnerSubscription,
    deleteSupportConversation,
    deleteLatestSupportConversation,
    sendSupportReply,
    setOwnerRiverParkVerification,
    toggleBusinessVerification,
    updateBusinessReorderLevel,
    updateEmailLogContent,
    updateOrderStatus,
    updatePaymentStatus,
    clearOrderTestingState,
    withdrawalRequests,
    updateSecuritySettings,
    deleteBusiness,
  } = useBusinessDirectory();

  if (!adminUser) {
    return null;
  }

  const [activeSection, setActiveSection] = useState<AdminSectionKey>('overview');
  const [searchValue, setSearchValue] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<(typeof userRoleOptions)[number]>('All');
  const [userStatusFilter, setUserStatusFilter] =
    useState<(typeof userStatusOptions)[number]>('All');
  const [listingTypeFilter, setListingTypeFilter] =
    useState<(typeof listingTypeOptions)[number]>('All');
  const [listingStatusFilter, setListingStatusFilter] =
    useState<(typeof listingStatusOptions)[number]>('All');
  const [verificationFilter, setVerificationFilter] =
    useState<(typeof verificationOptions)[number]>('All');
  const [activeListingMedia, setActiveListingMedia] = useState<BusinessMedia | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] =
    useState<(typeof orderStatusOptions)[number]>('All');
  const [paymentStatusFilter, setPaymentStatusFilter] =
    useState<(typeof paymentStatusOptions)[number]>('All');
  const [activeOrderDetails, setActiveOrderDetails] = useState<Order | null>(null);
  const [paymentPlanDrafts, setPaymentPlanDrafts] = useState<
    Record<PaymentPlanCycle, { title: string; amount: string; description: string }>
  >({
    weekly: { title: 'Weekly plan', amount: '4000', description: 'Best for short promo bursts.' },
    monthly: {
      title: 'Monthly plan',
      amount: '15000',
      description: 'Best for sellers who want steady marketplace visibility.',
    },
  });
  const [reorderDrafts, setReorderDrafts] = useState<Record<string, string>>({});
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<string, string>>({});
  const [progressCodeDraft, setProgressCodeDraft] = useState(orderProgressSettings.code);
  const [adminPinPrompt, setAdminPinPrompt] = useState<AdminPinPrompt | null>(null);
  const [adminPinDraft, setAdminPinDraft] = useState('');
  const [loginAnnouncementDraft, setLoginAnnouncementDraft] = useState({
    title: securitySettings.loginAnnouncementTitle,
    body: securitySettings.loginAnnouncementBody,
  });
  const [subscriptionExemptEmailDraft, setSubscriptionExemptEmailDraft] = useState(
    securitySettings.subscriptionExemptAccountEmail,
  );
  const [customerCareDraft, setCustomerCareDraft] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [customerCarePasswordDrafts, setCustomerCarePasswordDrafts] = useState<Record<string, string>>(
    {},
  );
  const [customerCareError, setCustomerCareError] = useState<string | null>(null);
  const [adminPasswordDraft, setAdminPasswordDraft] = useState('');
  const [adminPasswordConfirmDraft, setAdminPasswordConfirmDraft] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);

  const isWideLayout = width >= 1100;
  const isOwnerAdmin = adminUser.role === 'owner';
  const canReviewListings = isOwnerAdmin || adminUser.role === 'customerCare';
  const normalizedSearch = searchValue.trim().toLowerCase();
  const conversations = getSupportConversations();
  const visibleSections = isOwnerAdmin
    ? adminSections.filter((section) => section.key !== 'chats')
    : adminSections.filter((section) =>
        ['overview', 'orders', 'payments', 'emails', 'users', 'listings', 'chats'].includes(section.key),
      );

  useEffect(() => {
    if (!visibleSections.some((section) => section.key === activeSection)) {
      setActiveSection(visibleSections[0]?.key ?? 'overview');
    }
  }, [activeSection, visibleSections]);

  useEffect(() => {
    const nextDrafts = paymentPlans.reduce(
      (accumulator, plan) => {
        accumulator[plan.cycle] = {
          title: plan.title,
          amount: String(plan.amount),
          description: plan.description,
        };
        return accumulator;
      },
      {
        weekly: paymentPlanDrafts.weekly,
        monthly: paymentPlanDrafts.monthly,
      },
    );

    setPaymentPlanDrafts(nextDrafts);
    // Sync when the admin updates plans from elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentPlans]);

  useEffect(() => {
    setLoginAnnouncementDraft({
      title: securitySettings.loginAnnouncementTitle,
      body: securitySettings.loginAnnouncementBody,
    });
  }, [securitySettings.loginAnnouncementBody, securitySettings.loginAnnouncementTitle]);

  useEffect(() => {
    setSubscriptionExemptEmailDraft(securitySettings.subscriptionExemptAccountEmail);
  }, [securitySettings.subscriptionExemptAccountEmail]);

  useEffect(() => {
    setProgressCodeDraft(orderProgressSettings.code);
  }, [orderProgressSettings.code]);

  const estateLookup = useMemo(
    () =>
      Object.fromEntries(
        estates.map((estate) => [estate.id, `${estate.name}, ${estate.city}`]),
      ) as Record<string, string>,
    [estates],
  );

  const filteredUsers = useMemo(
    () =>
      [...users]
        .filter((user) => {
          const matchesRole = userRoleFilter === 'All' ? true : user.role === userRoleFilter;
          const matchesStatus =
            userStatusFilter === 'All' ? true : (user.status ?? 'active') === userStatusFilter;
          const matchesSearch =
            normalizedSearch.length === 0
              ? true
              : [
                  user.fullName,
                  user.email,
                  user.phoneNumber,
                  user.businessName,
                  user.businessCluster,
                  user.role,
                  user.status ?? 'active',
                ]
                  .join(' ')
                  .toLowerCase()
                  .includes(normalizedSearch);

          return matchesRole && matchesStatus && matchesSearch;
        })
        .sort(
          (leftUser, rightUser) =>
            new Date(rightUser.createdAt).getTime() - new Date(leftUser.createdAt).getTime(),
        ),
    [normalizedSearch, userRoleFilter, userStatusFilter, users],
  );

  const filteredListings = useMemo(
    () =>
      [...businesses]
        .filter((business) => {
          if ((business.status ?? 'active') === 'archived') {
            return false;
          }

          const matchesType =
            listingTypeFilter === 'All' ? true : business.listingType === listingTypeFilter;
          const matchesStatus =
            listingStatusFilter === 'All'
              ? true
              : (business.status ?? 'active') === listingStatusFilter;
          const matchesVerification =
            verificationFilter === 'All'
              ? true
              : verificationFilter === 'Verified'
                ? business.verified
                : !business.verified;
          const matchesSearch =
            normalizedSearch.length === 0
              ? true
              : [
                  business.name,
                  business.ownerName,
                  business.category,
                  business.cluster,
                  business.ownerEmail ?? business.contact.email,
                  business.sku,
                  business.status ?? 'active',
                ]
                  .join(' ')
                  .toLowerCase()
                  .includes(normalizedSearch);

          return matchesType && matchesStatus && matchesVerification && matchesSearch;
        })
        .sort(
          (leftBusiness, rightBusiness) =>
            new Date(rightBusiness.createdAt).getTime() -
            new Date(leftBusiness.createdAt).getTime(),
        ),
    [businesses, listingStatusFilter, listingTypeFilter, normalizedSearch, verificationFilter],
  );

  const filteredOrders = useMemo(
    () =>
      [...orders]
        .filter((order) => {
          const matchesStatus =
            orderStatusFilter === 'All' ? true : order.status === orderStatusFilter;
          const matchesPayment =
            paymentStatusFilter === 'All' ? true : order.paymentStatus === paymentStatusFilter;
          const matchesSearch =
            normalizedSearch.length === 0
              ? true
              : [
                  order.id,
                  order.userName,
                  order.deliveryAddress,
                  order.deliveryCluster,
                  ...order.items.map((item) => item.businessName),
                  ...order.items.map((item) => item.ownerName),
                ]
                  .join(' ')
                  .toLowerCase()
                  .includes(normalizedSearch);

          return matchesStatus && matchesPayment && matchesSearch;
        })
        .sort(
          (leftOrder, rightOrder) =>
            new Date(rightOrder.createdAt).getTime() - new Date(leftOrder.createdAt).getTime(),
        ),
    [normalizedSearch, orderStatusFilter, orders, paymentStatusFilter],
  );

  const filteredChats = useMemo(
    () =>
      conversations
        .filter((conversation) => Boolean(getLatestUserSupportMessage(conversation)))
        .filter((conversation) =>
          {
            const latestUserMessage = getLatestUserSupportMessage(conversation);

            return normalizedSearch.length === 0
              ? true
              : [
                  conversation.userName,
                  conversation.userRole,
                  latestUserMessage?.contextId,
                  latestUserMessage?.contextLabel,
                  latestUserMessage?.text,
                ]
                  .join(' ')
                  .toLowerCase()
                  .includes(normalizedSearch);
          },
        )
        .sort((leftConversation, rightConversation) => {
          const leftMessage = getLatestUserSupportMessage(leftConversation);
          const rightMessage = getLatestUserSupportMessage(rightConversation);

          return (
            new Date(rightMessage?.createdAt ?? rightConversation.lastMessage.createdAt).getTime() -
            new Date(leftMessage?.createdAt ?? leftConversation.lastMessage.createdAt).getTime()
          );
        }),
    [conversations, normalizedSearch],
  );

  const pendingSubscriptionProfiles = useMemo(
    () =>
      ownerBusinessProfiles.filter(
        (profile) =>
          !isSubscriptionActive(profile.subscriptionStatus, profile.subscriptionNextBillingAt),
      ),
    [ownerBusinessProfiles],
  );
  const pendingOrderPayments = useMemo(
    () => orders.filter((order) => order.paymentStatus === 'pending'),
    [orders],
  );
  const recentEmailLogs = useMemo(() => emailLogs.slice(0, 10), [emailLogs]);
  const recentSubscriptionPayments = useMemo(
    () => subscriptionPayments.slice(0, 8),
    [subscriptionPayments],
  );
  const recentFlutterwaveDeposits = useMemo(
    () =>
      [...dynamicDepositAccounts]
        .sort(
          (leftDeposit, rightDeposit) =>
            new Date(rightDeposit.updatedAt ?? rightDeposit.createdAt).getTime() -
            new Date(leftDeposit.updatedAt ?? leftDeposit.createdAt).getTime(),
        )
        .slice(0, 10),
    [dynamicDepositAccounts],
  );
  const paidFlutterwaveDepositTotal = useMemo(
    () =>
      dynamicDepositAccounts
        .filter((deposit) => deposit.status === 'paid')
        .reduce((total, deposit) => total + deposit.amount, 0),
    [dynamicDepositAccounts],
  );
  const pendingFlutterwaveDepositCount = useMemo(
    () => dynamicDepositAccounts.filter((deposit) => deposit.status === 'pending').length,
    [dynamicDepositAccounts],
  );
  const recentSubscriptionProfileFallbacks = useMemo(() => {
    const paymentOwnerIds = new Set(subscriptionPayments.map((payment) => payment.ownerUserId));

    return ownerBusinessProfiles
      .filter(
        (profile) =>
          !paymentOwnerIds.has(profile.ownerUserId) &&
          (profile.verifiedAmount ?? 0) > 0 &&
          isSubscriptionActive(profile.subscriptionStatus, profile.subscriptionNextBillingAt),
      )
      .slice(0, 8);
  }, [ownerBusinessProfiles, subscriptionPayments]);
  const adminSubscriptionDurationOptions = useMemo(
    () => buildAdminSubscriptionDurationOptions(paymentPlans),
    [paymentPlans],
  );

  const productListings = useMemo(
    () =>
      businesses.filter(
        (business) => business.listingType === 'product' && isPublicBusiness(business),
      ),
    [businesses],
  );
  const inventoryListings = useMemo(
    () =>
      productListings.filter((business) =>
        normalizedSearch.length === 0
          ? true
          : [business.name, business.ownerName, business.cluster, business.sku]
              .join(' ')
              .toLowerCase()
              .includes(normalizedSearch),
      ),
    [normalizedSearch, productListings],
  );
  const lowStockListings = useMemo(
    () =>
      productListings.filter(
        (business) => getAvailableStock(business.id) <= Math.max(1, business.reorderLevel ?? 0),
      ),
    [getAvailableStock, productListings],
  );
  const outOfStockListings = useMemo(
    () => productListings.filter((business) => getAvailableStock(business.id) === 0),
    [getAvailableStock, productListings],
  );
  const totalInventoryUnits = useMemo(
    () =>
      productListings.reduce((total, business) => total + getAvailableStock(business.id), 0),
    [getAvailableStock, productListings],
  );
  const inventoryValue = useMemo(
    () =>
      productListings.reduce(
        (total, business) => total + getAvailableStock(business.id) * business.price,
        0,
      ),
    [getAvailableStock, productListings],
  );
  const ownerCount = useMemo(
    () => users.filter((user) => user.role === 'businessOwner').length,
    [users],
  );
  const residentCount = useMemo(
    () => users.filter((user) => user.role === 'resident').length,
    [users],
  );
  const activeUserCount = useMemo(
    () => users.filter((user) => (user.status ?? 'active') === 'active').length,
    [users],
  );
  const suspendedUserCount = useMemo(
    () => users.filter((user) => (user.status ?? 'active') === 'suspended').length,
    [users],
  );
  const productCount = useMemo(
    () => businesses.filter((business) => business.listingType === 'product').length,
    [businesses],
  );
  const professionCount = useMemo(
    () => businesses.filter((business) => business.listingType === 'profession').length,
    [businesses],
  );
  const pendingListingCount = useMemo(
    () =>
      businesses.filter(
        (business) => (business.status ?? 'active') !== 'archived' && !business.verified,
      ).length,
    [businesses],
  );
  const verifiedCount = useMemo(
    () => businesses.filter((business) => business.verified).length,
    [businesses],
  );
  const activeSubscriptionCount = useMemo(
    () =>
      ownerBusinessProfiles.filter(
        (profile) =>
          isSubscriptionActive(profile.subscriptionStatus, profile.subscriptionNextBillingAt),
      ).length,
    [ownerBusinessProfiles],
  );
  const pendingSubscriptionCount = useMemo(
    () => pendingSubscriptionProfiles.length,
    [pendingSubscriptionProfiles],
  );
  const unverifiedCount = useMemo(
    () => businesses.filter((business) => !business.verified).length,
    [businesses],
  );
  const totalOrders = orders.length;
  const openOrders = useMemo(
    () => orders.filter((order) => isOpenOrder(order.status)).length,
    [orders],
  );
  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status === 'delivered').length,
    [orders],
  );
  const cancelledOrders = useMemo(
    () => orders.filter((order) => order.status === 'cancelled').length,
    [orders],
  );
  const gmv = useMemo(
    () => orders.reduce((total, order) => total + order.totalAmount, 0),
    [orders],
  );
  const paidRevenue = useMemo(
    () =>
      orders
        .filter((order) => order.paymentStatus === 'paid')
        .reduce((total, order) => total + order.totalAmount, 0),
    [orders],
  );
  const pendingRevenue = useMemo(
    () =>
      orders
        .filter((order) => order.paymentStatus === 'pending')
        .reduce((total, order) => total + order.totalAmount, 0),
    [orders],
  );
  const withdrawnRevenue = useMemo(
    () => withdrawalRequests.reduce((total, withdrawal) => total + withdrawal.amount, 0),
    [withdrawalRequests],
  );
  const grossProfit = Math.max(0, paidRevenue - withdrawnRevenue);
  const averageOrderValue = totalOrders > 0 ? gmv / totalOrders : 0;
  const repeatBuyerCount = useMemo(() => {
    const orderCountsByUser = orders.reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.userId] = (accumulator[order.userId] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.values(orderCountsByUser).filter((count) => count > 1).length;
  }, [orders]);
  const approvalRate = businesses.length > 0 ? (verifiedCount / businesses.length) * 100 : 0;
  const orderCompletionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
  const orderDensity = residentCount > 0 ? totalOrders / residentCount : 0;
  const clusterBars = useMemo(
    () =>
      estates[0]?.clusters.map((cluster) => ({
        cluster,
        count: businesses.filter((business) => business.cluster === cluster).length,
      })) ?? [],
    [businesses, estates],
  );
  const orderBars = useMemo(() => {
    const recentOrders = orders.slice(0, 7).reverse();
    const maxValue = Math.max(1, ...recentOrders.map((order) => order.totalAmount));
    return recentOrders.map((order) => Math.round((order.totalAmount / maxValue) * 100));
  }, [orders]);
  const topSellers = useMemo(() => {
    const sellerMap = orders.reduce<
      Record<
        string,
        {
          ownerName: string;
          revenue: number;
          orders: number;
          units: number;
        }
      >
    >((accumulator, order) => {
      const sellerIdsSeen = new Set<string>();

      order.items.forEach((item) => {
        const sellerKey = item.ownerUserId ?? item.ownerName;
        const currentSeller =
          accumulator[sellerKey] ??
          ({
            ownerName: item.ownerName,
            revenue: 0,
            orders: 0,
            units: 0,
          } as const);

        accumulator[sellerKey] = {
          ownerName: currentSeller.ownerName,
          revenue: currentSeller.revenue + item.lineTotal,
          orders: currentSeller.orders + (sellerIdsSeen.has(sellerKey) ? 0 : 1),
          units: currentSeller.units + item.quantity,
        };
        sellerIdsSeen.add(sellerKey);
      });

      return accumulator;
    }, {});

    return Object.values(sellerMap)
      .sort((leftSeller, rightSeller) => rightSeller.revenue - leftSeller.revenue)
      .slice(0, 5);
  }, [orders]);
  const recentActivity = useMemo(
    () =>
      auditLogs.slice(0, 8).map((log) => ({
        ...log,
        icon: log.action.toLowerCase().includes('order')
          ? ('receipt-outline' as const)
          : log.action.toLowerCase().includes('inventory')
            ? ('cube-outline' as const)
            : log.action.toLowerCase().includes('security')
              ? ('lock-closed-outline' as const)
              : ('sparkles-outline' as const),
      })),
    [auditLogs],
  );
  const customerCareAccounts = useMemo(
    () => adminUsers.filter((admin) => admin.role === 'customerCare'),
    [adminUsers],
  );
  const activeCustomerCareCount = useMemo(
    () => customerCareAccounts.filter((account) => account.isActive).length,
    [customerCareAccounts],
  );
  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    if (!normalizedSearch) {
      return [];
    }

    const visibleSectionKeys = new Set(visibleSections.map((section) => section.key));
    const canShow = (section: AdminSectionKey) => visibleSectionKeys.has(section);
    const matches = (values: Array<string | number | undefined | null>) =>
      values
        .filter((value) => value !== undefined && value !== null)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    const results: GlobalSearchResult[] = [];

    users.forEach((user) => {
      if (
        matches([
          user.id,
          user.fullName,
          user.email,
          user.phoneNumber,
          user.role,
          user.status,
          user.businessName,
          user.businessCluster,
        ])
      ) {
        results.push({
          id: `user-${user.id}`,
          title: user.fullName,
          meta: `${user.role} - ${user.email} - UID ${user.id}`,
          section: 'users',
        });
      }
    });

    businesses.forEach((business) => {
      if (
        matches([
          business.id,
          business.name,
          business.ownerName,
          business.ownerEmail,
          business.category,
          business.cluster,
          business.sku,
          business.subscriptionStatus,
          business.status,
        ])
      ) {
        results.push({
          id: `listing-${business.id}`,
          title: business.name,
          meta: `${listingTypeLabel(business.listingType)} - ${business.ownerName} - ${
            business.verified ? 'verified' : 'pending approval'
          }`,
          section: 'listings',
        });
      }
    });

    orders.forEach((order) => {
      if (
        matches([
          order.id,
          order.userName,
          order.userEmail,
          order.deliveryAddress,
          order.deliveryCluster,
          order.status,
          order.paymentStatus,
          ...order.items.map((item) => item.businessName),
          ...order.items.map((item) => item.ownerName),
        ])
      ) {
        results.push({
          id: `order-${order.id}`,
          title: order.id,
          meta: `${order.userName} - ${getOrderStatusLabel(order.status)} - ${formatCurrency(
            order.totalAmount,
          )}`,
          section: 'orders',
        });
      }
    });

    conversations.forEach((conversation) => {
      if (
        matches([
          conversation.userName,
          conversation.userRole,
          conversation.lastMessage.text,
          conversation.lastMessage.contextLabel,
        ])
      ) {
        results.push({
          id: `chat-${conversation.id}`,
          title: conversation.userName,
          meta: `${conversation.userRole} - ${conversation.lastMessage.text}`,
          section: 'chats',
        });
      }
    });

    ownerBusinessProfiles.forEach((profile) => {
      if (
        matches([
          profile.ownerUserId,
          profile.ownerName,
          profile.accountEmail,
          profile.subscriptionStatus,
          profile.subscriptionCycle,
          profile.verifiedAmount,
        ])
      ) {
        results.push({
          id: `payment-profile-${profile.ownerUserId}`,
          title: profile.ownerName,
          meta: `Subscription ${subscriptionStatusLabel(profile.subscriptionStatus)} - ${formatCurrency(
            profile.verifiedAmount ?? 0,
          )}`,
          section: 'payments',
        });
      }
    });

    subscriptionPayments.forEach((payment) => {
      const durationLabel = subscriptionPaymentDurationLabel(payment);

      if (
        matches([
          payment.reference,
          payment.ownerName,
          payment.ownerEmail,
          payment.status,
          payment.amount,
          payment.cycle,
          durationLabel,
        ])
      ) {
        results.push({
          id: `subscription-payment-${payment.reference}`,
          title: payment.reference,
          meta: `${payment.ownerName} - ${durationLabel} - ${formatCurrency(payment.amount)}`,
          section: 'payments',
        });
      }
    });

    dynamicDepositAccounts.forEach((deposit) => {
      if (
        matches([
          deposit.reference,
          deposit.providerReference,
          deposit.userName,
          deposit.userEmail,
          deposit.userRole,
          deposit.status,
          deposit.bankName,
          deposit.accountNumber,
          deposit.accountName,
          deposit.amount,
          deposit.providerChargeId,
          flutterwaveDepositChannelLabel(deposit),
        ])
      ) {
        results.push({
          id: `flutterwave-deposit-${deposit.id}`,
          title: deposit.reference,
          meta: `${deposit.userName} - ${flutterwaveDepositChannelLabel(deposit)} - ${formatCurrency(
            deposit.amount,
          )}`,
          section: 'payments',
        });
      }
    });

    emailLogs.forEach((email) => {
      if (
        matches([
          email.recipientName,
          email.recipientEmail,
          email.subject,
          email.body,
          email.status,
        ])
      ) {
        results.push({
          id: `email-${email.id}`,
          title: email.subject,
          meta: `${email.recipientName} - ${email.status}`,
          section: 'emails',
        });
      }
    });

    auditLogs.forEach((log) => {
      if (matches([log.actorName, log.actorRole, log.action, log.details])) {
        results.push({
          id: `audit-${log.id}`,
          title: log.action,
          meta: `${log.actorName} - ${log.details}`,
          section: 'security',
        });
      }
    });

    return results.filter((result) => canShow(result.section)).slice(0, 14);
  }, [
    auditLogs,
    businesses,
    conversations,
    dynamicDepositAccounts,
    emailLogs,
    normalizedSearch,
    orders,
    ownerBusinessProfiles,
    subscriptionPayments,
    users,
    visibleSections,
  ]);

  const exportUsers = () => {
    downloadCsv(
      'urbanconnect-users-report.csv',
      ['name', 'email', 'phone', 'role', 'status', 'estate', 'createdAt'],
      filteredUsers.map((user) => ({
        name: user.fullName,
        email: user.email,
        phone: user.phoneNumber,
        role: user.role,
        status: getUserStatusLabel(user.status),
        estate: estateLookup[user.estateId] ?? user.estateId,
        createdAt: formatDateTime(user.createdAt),
      })),
    );
  };

  const exportListings = () => {
    downloadCsv(
      'urbanconnect-listings-report.csv',
      ['name', 'type', 'status', 'owner', 'category', 'price', 'cluster', 'verified', 'stock', 'createdAt'],
      filteredListings.map((business) => ({
        name: business.name,
        type: listingTypeLabel(business.listingType),
        status: getBusinessStatusLabel(business.status),
        owner: business.ownerName,
        category: business.category,
        price:
          business.listingType === 'product' ? formatCurrency(business.price) : 'No public amount',
        cluster: business.cluster,
        verified: verificationLabel(business.verified),
        stock:
          business.listingType === 'product'
            ? formatNumber(getAvailableStock(business.id))
            : 'N/A',
        createdAt: formatDateTime(business.createdAt),
      })),
    );
  };

  const exportOrders = () => {
    downloadCsv(
      'urbanconnect-orders-report.csv',
      ['orderId', 'customer', 'status', 'payment', 'method', 'total', 'items', 'createdAt'],
      filteredOrders.map((order) => ({
        orderId: order.id,
        customer: order.userName,
        status: getOrderStatusLabel(order.status),
        payment: getPaymentStatusLabel(order.paymentStatus),
        method: getPaymentMethodLabel(order.paymentMethod),
        total: formatCurrency(order.totalAmount),
        items: order.items.map((item) => `${item.businessName} x${item.quantity}`).join(' | '),
        createdAt: formatDateTime(order.createdAt),
      })),
    );
  };

  const exportFinance = () => {
    downloadCsv(
      'urbanconnect-financial-summary.csv',
      ['metric', 'value'],
      [
        { metric: 'Gross merchandise volume', value: formatCurrency(gmv) },
        { metric: 'Gross profit', value: formatCurrency(grossProfit) },
        { metric: 'Paid revenue', value: formatCurrency(paidRevenue) },
        { metric: 'Pending revenue', value: formatCurrency(pendingRevenue) },
        { metric: 'Average order value', value: formatCurrency(averageOrderValue) },
        { metric: 'Inventory value', value: formatCurrency(inventoryValue) },
      ],
    );
  };

  const runAdminChange = (title: string, message: string, action: () => void) => {
    if (!orderProgressSettings.code) {
      Alert.alert(
        'Admin PIN missing',
        'The owner admin must create a 4 digit PIN in Codes before admin changes can be made.',
      );
      return;
    }

    setAdminPinDraft('');
    setAdminPinPrompt({ title, message, action });
  };

  const closeAdminPinPrompt = () => {
    setAdminPinPrompt(null);
    setAdminPinDraft('');
  };

  const confirmAdminPinPrompt = () => {
    const prompt = adminPinPrompt;

    if (!prompt) {
      return;
    }

    if (adminPinDraft.trim() !== orderProgressSettings.code) {
      Alert.alert('Wrong PIN', 'Enter the active owner admin PIN before making changes.');
      return;
    }

    closeAdminPinPrompt();
    prompt.action();
  };

  const toggleUserStatus = (userId: string, currentStatus?: string) => {
    if (!isOwnerAdmin) {
      return;
    }

    const nextStatus = (currentStatus ?? 'active') === 'suspended' ? 'active' : 'suspended';
    runAdminChange('Admin PIN', 'Enter the PIN before changing this user status.', () =>
      setUserStatus(userId, nextStatus as 'active' | 'suspended', adminUser.fullName, adminUser.role),
    );
  };

  const ownerProfileForUser = (userId: string) =>
    ownerBusinessProfiles.find((profile) => profile.ownerUserId === userId);

  const ownerListingsForUser = (userId: string) =>
    businesses.filter((business) => {
      const profile = ownerProfileForUser(userId);
      const matchedUser = users.find((item) => item.id === userId);
      const ownerKeys = [
        userId,
        matchedUser?.email,
        matchedUser?.fullName,
        matchedUser?.businessName,
        profile?.accountEmail,
        profile?.email,
        profile?.accountName,
        profile?.ownerName,
      ]
        .map((ownerKey) => ownerKey?.trim().toLowerCase())
        .filter((ownerKey): ownerKey is string => Boolean(ownerKey));

      return [business.ownerUserId, business.ownerEmail, business.ownerName]
        .map((ownerKey) => ownerKey?.trim().toLowerCase())
        .some((ownerKey) => Boolean(ownerKey && ownerKeys.includes(ownerKey)));
    });

  const isRiverParkVerifiedForUser = (userId: string) => {
    const profile = ownerProfileForUser(userId);
    const listing = ownerListingsForUser(userId)[0];
    const matchedUser = users.find((item) => item.id === userId);

    if (matchedUser || profile) {
      return Boolean(matchedUser?.riverParkVerified || profile?.riverParkVerified);
    }

    return Boolean(listing?.riverParkVerified);
  };

  const subscriptionStatusForUser = (userId: string) => {
    const profile = ownerProfileForUser(userId);
    const listing = ownerListingsForUser(userId)[0];

    return profile?.subscriptionStatus ?? listing?.subscriptionStatus;
  };

  const subscriptionWindowForUser = (userId: string) => {
    const profile = ownerProfileForUser(userId);
    const listing = ownerListingsForUser(userId)[0];

    return profile?.subscriptionNextBillingAt ?? listing?.subscriptionNextBillingAt;
  };

  const accountBalanceForUser = (targetUser: AppUser) =>
    getAccountWalletBalance(
      targetUser,
      orders.filter((order) => order.userId === targetUser.id),
      subscriptionPayments.filter((payment) => payment.ownerUserId === targetUser.id),
      dynamicDepositAccounts.filter((deposit) => deposit.userId === targetUser.id),
    );

  const listingVerificationSummaryForUser = (userId: string) => {
    const listings = ownerListingsForUser(userId);
    const verifiedListings = listings.filter((business) => business.verified).length;

    return `${formatNumber(verifiedListings)} / ${formatNumber(listings.length)} listings verified`;
  };

  const handleAdvanceOrder = (order: Order) => {
    const nextStatus = nextOrderStatus(order.status);

    if (!nextStatus) {
      return;
    }

    runAdminChange('Admin PIN', `Enter the PIN before marking ${order.id}.`, () => {
      try {
        updateOrderStatus(
          order.id,
          nextStatus,
          adminUser.fullName,
          adminUser.role,
          orderProgressSettings.code,
        );
      } catch (error) {
        Alert.alert(
          'Unable to update order',
          error instanceof Error ? error.message : 'Enter the active owner admin PIN.',
        );
      }
    });
  };

  const handlePaymentUpdate = (orderId: string, paymentStatus: PaymentStatus) => {
    runAdminChange('Admin PIN', `Enter the PIN before changing payment for ${orderId}.`, () =>
      updatePaymentStatus(orderId, paymentStatus, adminUser.fullName, adminUser.role),
    );
  };

  const handleSaveProgressCode = () => {
    try {
      updateOrderProgressCode(progressCodeDraft, adminUser.fullName, adminUser.role);
      Alert.alert('Admin PIN saved', 'Admin changes now require this 4 digit PIN.');
    } catch (error) {
      Alert.alert(
        'Invalid code',
        error instanceof Error ? error.message : 'Admin PIN must be exactly 4 digits.',
      );
    }
  };

  const handleClearOrderTestingState = () => {
    Alert.alert(
      'Clear all orders?',
      'This resets order history, cart items, and seller withdrawal balance for fresh testing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear orders',
          style: 'destructive',
          onPress: () =>
            runAdminChange('Admin PIN', 'Enter the PIN before clearing order testing data.', () =>
              clearOrderTestingState(adminUser.fullName, adminUser.role),
            ),
        },
      ],
    );
  };

  const handleSaveReorderLevel = (business: Business) => {
    const draftValue = reorderDrafts[business.id] ?? String(business.reorderLevel ?? 1);
    const parsedValue = Number.parseInt(draftValue, 10);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      Alert.alert('Invalid reorder level', 'Enter a number greater than zero.');
      return;
    }

    runAdminChange(
      'Admin PIN',
      `Enter the PIN before changing reorder level for ${business.name}.`,
      () =>
        updateBusinessReorderLevel(
          business.id,
          parsedValue,
          adminUser.fullName,
          adminUser.role,
        ),
    );
  };

  const toggleSecurityFlag = (key: keyof SecuritySettings) => {
    runAdminChange(
      'Admin PIN',
      'Enter the PIN before changing security settings.',
      () =>
        updateSecuritySettings(
          { [key]: !securitySettings[key] } as Partial<SecuritySettings>,
          adminUser.fullName,
          adminUser.role,
        ),
    );
  };

  const adjustSecurityNumber = (
    key: 'sessionTimeoutMinutes' | 'maxLoginAttempts',
    delta: number,
    minimum: number,
  ) => {
    const nextValue = Math.max(minimum, securitySettings[key] + delta);
    runAdminChange(
      'Admin PIN',
      'Enter the PIN before changing security limits.',
      () =>
        updateSecuritySettings(
          { [key]: nextValue } as Partial<SecuritySettings>,
          adminUser.fullName,
          adminUser.role,
        ),
    );
  };

  const saveLoginAnnouncement = () => {
    const title = loginAnnouncementDraft.title.trim();
    const body = loginAnnouncementDraft.body.trim();

    if (!title || !body) {
      Alert.alert('Announcement needed', 'Add both a title and message for the login popup.');
      return;
    }

    runAdminChange(
      'Admin PIN',
      'Enter the PIN before saving the login popup.',
      () =>
        updateSecuritySettings(
          {
            loginAnnouncementTitle: title,
            loginAnnouncementBody: body,
          },
          adminUser.fullName,
          adminUser.role,
        ),
    );
  };

  const saveSubscriptionExemptAccount = (nextEmail = subscriptionExemptEmailDraft) => {
    const normalizedEmail = nextEmail.trim().toLowerCase();

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('Email needed', 'Enter one valid business-owner account email, or clear it.');
      return;
    }

    runAdminChange(
      'Admin PIN',
      'Enter the PIN before changing the subscription exempt account.',
      () =>
        updateSecuritySettings(
          {
            subscriptionExemptAccountEmail: normalizedEmail,
          },
          adminUser.fullName,
          adminUser.role,
        ),
    );
  };

  const handleCreateCustomerCareAccount = () => {
    if (!isOwnerAdmin) {
      return;
    }

    const fullName = customerCareDraft.fullName.trim();
    const email = customerCareDraft.email.trim();
    const password = customerCareDraft.password.trim();

    if (!fullName || !email || !password) {
      setCustomerCareError('Add the agent name, email, and password.');
      return;
    }

    runAdminChange(
      'Admin PIN',
      `Enter the PIN before creating ${fullName}.`,
      () => {
        try {
          const account = createCustomerCareAccount(
            { fullName, email, password },
            adminUser.fullName,
            adminUser.role,
          );

          setCustomerCareDraft({ fullName: '', email: '', password: '' });
          setCustomerCareError(null);
          Alert.alert('Customer care account created', `${account.fullName} can now sign in.`);
        } catch (error) {
          setCustomerCareError(
            error instanceof Error ? error.message : 'Unable to create this account.',
          );
        }
      },
    );
  };

  const handleUpdateCustomerCarePassword = (accountId: string) => {
    if (!isOwnerAdmin) {
      return;
    }

    const account = customerCareAccounts.find((item) => item.id === accountId);
    const nextPassword = customerCarePasswordDrafts[accountId]?.trim() ?? '';

    if (!account) {
      setCustomerCareError('Customer care account was not found.');
      return;
    }

    if (nextPassword.length < 6) {
      setCustomerCareError('Customer care password must be at least 6 characters.');
      return;
    }

    runAdminChange(
      'Admin PIN',
      `Enter the PIN before changing ${account.fullName}'s password.`,
      () => {
        try {
          updateAdminPassword(account.id, nextPassword, adminUser.fullName, adminUser.role);
          setCustomerCarePasswordDrafts((currentDrafts) => ({
            ...currentDrafts,
            [account.id]: '',
          }));
          setCustomerCareError(null);
          Alert.alert('Password updated', `${account.fullName} can sign in with the new password.`);
        } catch (error) {
          setCustomerCareError(
            error instanceof Error ? error.message : 'Unable to update this password.',
          );
        }
      },
    );
  };

  const handleUpdateCurrentAdminPassword = () => {
    const nextPassword = adminPasswordDraft.trim();

    if (nextPassword.length < 6) {
      setAdminPasswordError('Admin password must be at least 6 characters.');
      return;
    }

    if (nextPassword !== adminPasswordConfirmDraft.trim()) {
      setAdminPasswordError('Passwords do not match.');
      return;
    }

    try {
      updateAdminPassword(
        adminUser.id,
        nextPassword,
        adminUser.fullName,
        adminUser.role,
        adminUser.id,
      );
      setAdminPasswordDraft('');
      setAdminPasswordConfirmDraft('');
      setAdminPasswordError(null);
      Alert.alert('Password updated', 'Your admin login password has been changed.');
    } catch (error) {
      setAdminPasswordError(
        error instanceof Error ? error.message : 'Unable to update your admin password.',
      );
    }
  };

  const savePaymentPlan = (cycle: PaymentPlanCycle) => {
    if (!isOwnerAdmin) {
      return;
    }

    const draft = paymentPlanDrafts[cycle];
    const parsedAmount = Number.parseFloat(draft.amount);

    if (!draft.title.trim()) {
      Alert.alert('Plan title required', 'Add a short title before saving the plan.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid plan amount', 'Enter a plan amount greater than zero.');
      return;
    }

    runAdminChange(
      'Admin PIN',
      `Enter the PIN before saving the ${paymentCycleLabel(cycle)} plan.`,
      () =>
        updatePaymentPlan(
          cycle,
          {
            title: draft.title.trim(),
            amount: parsedAmount,
            description: draft.description.trim(),
          },
          adminUser.fullName,
          adminUser.role,
        ),
    );
  };

  const syncPaymentPlanDraft = (
    cycle: PaymentPlanCycle,
    patch: Partial<{ title: string; amount: string; description: string }>,
  ) => {
    const nextDraft = {
      ...paymentPlanDrafts[cycle],
      ...patch,
    };
    const parsedAmount = Number.parseFloat(nextDraft.amount);

    setPaymentPlanDrafts((current) => ({
      ...current,
      [cycle]: nextDraft,
    }));

    if (!isOwnerAdmin || !nextDraft.title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }
  };

  const confirmOrderPayment = (order: Order) => {
    runAdminChange('Admin PIN', `Enter the PIN before confirming ${order.id}.`, () =>
      updatePaymentStatus(order.id, 'paid', adminUser.fullName, adminUser.role),
    );
  };

  const confirmSubscriptionPayment = (profile: OwnerBusinessProfile) => {
    runAdminChange('Admin PIN', `Enter the PIN before confirming ${profile.ownerName}.`, () =>
      confirmOwnerSubscription(profile.id, adminUser.fullName, adminUser.role),
    );
  };

  const replyToSupportConversation = (conversation: SupportConversation) => {
    const reply = supportReplyDrafts[conversation.id] ?? '';

    if (!reply.trim()) {
      Alert.alert('Reply needed', 'Type a customer care reply before sending.');
      return;
    }

    runAdminChange('Admin PIN', 'Enter the PIN before sending this support reply.', () => {
      sendSupportReply(conversation.id, adminUser.fullName, adminUser.role, reply);
      setSupportReplyDrafts((currentDrafts) => ({
        ...currentDrafts,
        [conversation.id]: '',
      }));
    });
  };

  const handleEmailLogUpdate = (
    logId: string,
    patch: Parameters<typeof updateEmailLogContent>[1],
  ) => {
    runAdminChange('Admin PIN', 'Enter the PIN before editing this email record.', () =>
      updateEmailLogContent(logId, patch),
    );
  };

  const handleToggleBusinessVerification = (business: Business) => {
    runAdminChange('Admin PIN', `Enter the PIN before changing ${business.name}.`, () =>
      toggleBusinessVerification(business.id, adminUser.fullName, adminUser.role),
    );
  };

  const handleDeleteBusiness = (business: Business) => {
    runAdminChange('Admin PIN', `Enter the PIN before deleting ${business.name}.`, () =>
      deleteBusiness(business.id, adminUser.fullName, adminUser.role),
    );
  };

  const handleDeleteSupportConversation = (conversationId: string) => {
    runAdminChange('Admin PIN', 'Enter the PIN before deleting this support chat.', () =>
      deleteSupportConversation(conversationId),
    );
  };

  const handleDeleteLatestSupportConversation = () => {
    runAdminChange('Admin PIN', 'Enter the PIN before deleting the latest support chat.', () =>
      deleteLatestSupportConversation(),
    );
  };

  const openListingMedia = (item: BusinessMedia) => {
    if (isLocalOnlyMediaUrl(item.url)) {
      Alert.alert(
        'Media needs upload',
        'This listing saved a private phone file path instead of a Supabase Storage URL. Create the listing media bucket, then re-upload this listing photo or video.',
      );
      return;
    }

    if (Platform.OS === 'web' || item.type === 'image') {
      setActiveListingMedia(item);
      return;
    }

    void Linking.openURL(item.url).catch(() => {
      Alert.alert('Unable to open media', `${item.label} could not be opened on this device.`);
    });
  };

  return (
    <>
    <View style={styles.screen}>
      <View style={[styles.adminShell, !isWideLayout && styles.adminShellStacked]}>
        <View style={[styles.sidebar, !isWideLayout && styles.sidebarStacked]}>
          <View style={styles.brandBlock}>
            <UrbanConnectLogo inverted />
          </View>

          <View style={styles.sidebarList}>
            {visibleSections.map((section) => {
              const isActive = activeSection === section.key;

              return (
                <Pressable
                  key={section.key}
                  onPress={() => setActiveSection(section.key)}
                  style={({ pressed }) => [
                    styles.sidebarRow,
                    isActive && styles.sidebarRowActive,
                    pressed && styles.sidebarRowPressed,
                  ]}
                >
                  <Ionicons
                    color={isActive ? colors.white : '#777777'}
                    name={section.icon}
                    size={18}
                  />
                  <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                    {section.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sidebarFooter}>
            <Text style={styles.sidebarFooterTitle}>Access model</Text>
            <Text style={styles.sidebarFooterText}>
              Owner has full control. Customer care stays limited to support-safe monitoring.
            </Text>
          </View>
        </View>

        <View style={styles.mainStage}>
          <View style={styles.topBar}>
            <View style={styles.searchShell}>
              <Ionicons color="#666666" name="search-outline" size={18} />
              <TextInput
                onChangeText={setSearchValue}
                placeholder="Search orders, users, listings, chats, or SKUs"
                placeholderTextColor="#8A8A8A"
                style={styles.searchInput}
                value={searchValue}
              />
            </View>
            <View style={styles.topActions}>
              {isOwnerAdmin ? (
                <>
                  <MonoButton dark={false} label="Export users" onPress={exportUsers} />
                  <MonoButton dark={false} label="Export orders" onPress={exportOrders} />
                </>
              ) : null}
              <MonoButton dark={false} label="Admin logout" onPress={signOutAdmin} />
              <MonoButton dark label="Return to app" onPress={onReturnToApp} />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {normalizedSearch ? (
              <View style={styles.globalSearchPanel}>
                <View style={styles.recordTopRow}>
                  <View style={styles.recordCopy}>
                    <Text style={styles.recordTitle}>Search everywhere</Text>
                    <Text style={styles.recordMeta}>
                      {formatNumber(globalSearchResults.length)} quick result
                      {globalSearchResults.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                <View style={styles.globalSearchGrid}>
                  {globalSearchResults.length > 0 ? (
                    globalSearchResults.map((result) => (
                      <Pressable
                        key={result.id}
                        onPress={() => setActiveSection(result.section)}
                        style={({ pressed }) => [
                          styles.globalSearchItem,
                          pressed && styles.recordCardPressed,
                        ]}
                      >
                        <Text style={styles.globalSearchSection}>
                          {adminSections.find((section) => section.key === result.section)?.label ??
                            result.section}
                        </Text>
                        <Text numberOfLines={1} style={styles.recordTitle}>
                          {result.title}
                        </Text>
                        <Text numberOfLines={2} style={styles.recordMeta}>
                          {result.meta}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.recordMeta}>No matching users, listings, orders, chats, or payments.</Text>
                  )}
                </View>
              </View>
            ) : null}

            <View style={styles.heroPanel}>
              <View style={styles.heroHeaderRow}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>Control center</Text>
                  <Text style={styles.heroTitle}>Run the marketplace from one local admin.</Text>
                  <Text style={styles.heroBody}>
                    Orders, stock, analytics, reports, and security are now connected to the same
                    live app state instead of sitting as isolated views.
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeLabel}>Signed in as</Text>
                  <Text style={styles.heroBadgeValue}>{adminRoleLabel(adminUser.role)}</Text>
                  <Text style={styles.heroBadgeMeta}>
                    {visibleSections.find((section) => section.key === activeSection)?.label}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.accessCard,
                  isOwnerAdmin ? styles.accessCardOwner : styles.accessCardLimited,
                ]}
              >
                <Ionicons
                  color={isOwnerAdmin ? colors.white : colors.text}
                  name={isOwnerAdmin ? 'shield-checkmark-outline' : 'eye-outline'}
                  size={18}
                />
                <Text style={[styles.accessText, isOwnerAdmin && styles.accessTextOwner]}>
                  {isOwnerAdmin
                    ? 'Owner access is active. Orders, inventory, finance, payments, security, listings, and customer care controls are fully enabled.'
                    : 'Customer care access is active. You can confirm order payments, review listing approvals, monitor users, and answer support chats while finance and security remain owner only.'}
                </Text>
              </View>
            </View>

            {activeSection === 'overview' ? (
              <>
                <View style={styles.metricGrid}>
                  {isOwnerAdmin ? (
                    <>
                      <MetricCard
                        icon="cash-outline"
                        label="Gross profit"
                        value={formatCurrency(grossProfit)}
                      />
                      <MetricCard
                        icon="trending-up-outline"
                        label="GMV"
                        value={formatCurrency(gmv)}
                      />
                      <MetricCard
                        icon="receipt-outline"
                        label="Orders"
                        value={formatNumber(totalOrders)}
                      />
                      <MetricCard
                        icon="storefront-outline"
                        label="Live listings"
                        value={formatNumber(
                          businesses.filter((business) => (business.status ?? 'active') === 'active')
                            .length,
                        )}
                      />
                      <MetricCard
                        icon="people-outline"
                        label="Active users"
                        value={formatNumber(activeUserCount)}
                      />
                      <MetricCard
                        icon="business-outline"
                        label="Residents / owners"
                        value={`${formatNumber(residentCount)} / ${formatNumber(ownerCount)}`}
                      />
                    </>
                  ) : (
                    <>
                      <MetricCard
                        icon="receipt-outline"
                        label="Orders"
                        value={formatNumber(totalOrders)}
                      />
                      <MetricCard
                        icon="alert-circle-outline"
                        label="Open orders"
                        value={formatNumber(openOrders)}
                      />
                      <MetricCard
                        icon="people-outline"
                        label="Users"
                        value={formatNumber(users.length)}
                      />
                      <MetricCard
                        icon="headset-outline"
                        label="Support"
                        value={formatNumber(conversations.length)}
                      />
                    </>
                  )}
                </View>

                <SectionPanel
                  title="Admin session password"
                  subtitle="Change the login password for the admin account currently signed in."
                >
                  <View style={styles.reorderRow}>
                    <TextInput
                      onChangeText={(value) => {
                        setAdminPasswordDraft(value);
                        setAdminPasswordError(null);
                      }}
                      placeholder="New admin password"
                      placeholderTextColor="#8A8A8A"
                      secureTextEntry
                      style={styles.compactInput}
                      value={adminPasswordDraft}
                    />
                    <TextInput
                      onChangeText={(value) => {
                        setAdminPasswordConfirmDraft(value);
                        setAdminPasswordError(null);
                      }}
                      placeholder="Confirm password"
                      placeholderTextColor="#8A8A8A"
                      secureTextEntry
                      style={styles.compactInput}
                      value={adminPasswordConfirmDraft}
                    />
                    <MonoButton
                      dark
                      label="Update password"
                      onPress={handleUpdateCurrentAdminPassword}
                    />
                  </View>
                  {adminPasswordError ? (
                    <Text style={styles.errorText}>{adminPasswordError}</Text>
                  ) : null}
                </SectionPanel>

                <View style={[styles.dashboardGrid, !isWideLayout && styles.dashboardGridStacked]}>
                  <SectionPanel
                    title="Marketplace pulse"
                    subtitle="Recent order values show how local demand is moving."
                  >
                    {orderBars.length > 0 ? (
                      <>
                        <MiniBars bars={orderBars} color="#111111" />
                        <View style={styles.legendRow}>
                          <Text style={styles.legendText}>
                            Completion rate {asPercent(orderCompletionRate)}
                          </Text>
                          <Text style={styles.legendText}>
                            Average order {formatCurrency(averageOrderValue)}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.emptyPanelText}>
                        Orders will appear here after residents begin checking out.
                      </Text>
                    )}
                  </SectionPanel>

                  <SectionPanel
                    title="Cluster coverage"
                    subtitle="Listings are still focused on River Park clusters."
                  >
                    <View style={styles.clusterStack}>
                      {clusterBars.map((entry) => {
                        const maxCount = Math.max(1, ...clusterBars.map((item) => item.count));
                        return (
                          <View key={entry.cluster} style={styles.clusterRow}>
                            <Text style={styles.clusterLabel}>{entry.cluster}</Text>
                            <View style={styles.clusterBarTrack}>
                              <View
                                style={[
                                  styles.clusterBarFill,
                                  { width: `${(entry.count / maxCount) * 100}%` },
                                ]}
                              />
                            </View>
                            <Text style={styles.clusterValue}>{formatNumber(entry.count)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </SectionPanel>
                </View>

                <View style={[styles.dashboardGrid, !isWideLayout && styles.dashboardGridStacked]}>
                  <SectionPanel
                    title="Recent activity"
                    subtitle="Admin and system actions are logged here for visibility."
                  >
                    <View style={styles.activityStack}>
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity) => (
                          <View key={activity.id} style={styles.activityRow}>
                            <View style={styles.activityIconShell}>
                              <Ionicons color="#111111" name={activity.icon} size={16} />
                            </View>
                            <View style={styles.activityCopy}>
                              <Text style={styles.activityTitle}>{activity.action}</Text>
                              <Text style={styles.activityMeta}>{activity.details}</Text>
                              <Text style={styles.activityMeta}>
                                {activity.actorName} - {formatDateTime(activity.createdAt)}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyPanelText}>
                          New audit records will appear here as the app is used.
                        </Text>
                      )}
                    </View>
                  </SectionPanel>

                  <SectionPanel
                    title="Launch totals"
                    subtitle="Core marketplace counts that matter most right now."
                  >
                    <View style={styles.totalStack}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Residents</Text>
                        <Text style={styles.totalValue}>{formatNumber(residentCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Business owners</Text>
                        <Text style={styles.totalValue}>{formatNumber(ownerCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Active users</Text>
                        <Text style={styles.totalValue}>{formatNumber(activeUserCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Suspended users</Text>
                        <Text style={styles.totalValue}>{formatNumber(suspendedUserCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Verified listings</Text>
                        <Text style={styles.totalValue}>{formatNumber(verifiedCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Paid subscriptions</Text>
                        <Text style={styles.totalValue}>
                          {formatNumber(activeSubscriptionCount)}
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Pending subscriptions</Text>
                        <Text style={styles.totalValue}>
                          {formatNumber(pendingSubscriptionCount)}
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Pending listings</Text>
                        <Text style={styles.totalValue}>{formatNumber(pendingListingCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Low stock listings</Text>
                        <Text style={styles.totalValue}>{formatNumber(lowStockListings.length)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Customer care active</Text>
                        <Text style={styles.totalValue}>{formatNumber(activeCustomerCareCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Pending revenue</Text>
                        <Text style={styles.totalValue}>{formatCurrency(pendingRevenue)}</Text>
                      </View>
                    </View>
                  </SectionPanel>
                </View>
              </>
            ) : null}

            {activeSection === 'orders' ? (
              <SectionPanel
                title="Order operations"
                subtitle="Track fulfillment, payment state, and customer deliveries from one view."
                action={<Text style={styles.panelCount}>{formatNumber(filteredOrders.length)} orders</Text>}
              >
                <View style={styles.filterWrap}>
                  {orderStatusOptions.map((status) => {
                    const isActive = orderStatusFilter === status;
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setOrderStatusFilter(status)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isActive && styles.filterChipActive,
                          pressed && styles.filterChipPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {status === 'All' ? 'All statuses' : getOrderStatusLabel(status)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.filterWrap}>
                  {paymentStatusOptions.map((status) => {
                    const isActive = paymentStatusFilter === status;
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setPaymentStatusFilter(status)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isActive && styles.filterChipActive,
                          pressed && styles.filterChipPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {status === 'All' ? 'All payments' : getPaymentStatusLabel(status)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.recordStack}>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => {
                      const nextStatus = nextOrderStatus(order.status);

                      return (
                        <View key={order.id} style={styles.recordCard}>
                          <Pressable
                            onPress={() => setActiveOrderDetails(order)}
                            style={({ pressed }) => [pressed && styles.recordCardPressed]}
                          >
                            <View style={styles.recordTopRow}>
                              <View style={styles.recordCopy}>
                                <Text style={styles.recordTitle}>{order.id}</Text>
                                <Text style={styles.recordMeta}>{order.userName}</Text>
                              </View>
                              <View style={styles.badgeRow}>
                                <View style={styles.recordBadge}>
                                  <Text style={styles.recordBadgeText}>
                                    {getOrderStatusLabel(order.status)}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.recordBadge,
                                    order.paymentStatus === 'paid' && styles.recordBadgeSuccess,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.recordBadgeText,
                                      order.paymentStatus === 'paid' &&
                                        styles.recordBadgeTextSuccess,
                                    ]}
                                  >
                                    {getPaymentStatusLabel(order.paymentStatus)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <Text style={styles.recordMeta}>
                              {formatCurrency(order.totalAmount)} - {getPaymentMethodLabel(order.paymentMethod)}
                            </Text>
                            <Text style={styles.recordMeta}>
                              {order.deliveryCluster} - {formatDateTime(order.createdAt)}
                            </Text>
                            <Text style={styles.recordMeta}>
                              Delivery address: {order.deliveryAddress}
                            </Text>
                            <Text style={styles.recordMeta}>
                              {order.items.map((item) => `${item.businessName} x${item.quantity}`).join(', ')}
                            </Text>
                          </Pressable>
                          {isOwnerAdmin ? (
                            <View style={styles.inlineActionRow}>
                              {nextStatus ? (
                                <MonoButton
                                  dark
                                  label={`Advance to ${getOrderStatusLabel(nextStatus)}`}
                                  onPress={() => handleAdvanceOrder(order)}
                                />
                              ) : null}
                              {order.paymentStatus === 'paid' ? (
                                <MonoButton
                                  dark={false}
                                  label="Refund"
                                  onPress={() => handlePaymentUpdate(order.id, 'refunded')}
                                />
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyPanelText}>
                      No orders match the current filters yet.
                    </Text>
                  )}
                </View>
              </SectionPanel>
            ) : null}

            {activeSection === 'inventory' && isOwnerAdmin ? (
              <>
                <View style={styles.metricGrid}>
                  <MetricCard
                    icon="cube-outline"
                    label="Product SKUs"
                    value={formatNumber(productCount)}
                  />
                  <MetricCard
                    icon="albums-outline"
                    label="Units in stock"
                    value={formatNumber(totalInventoryUnits)}
                  />
                  <MetricCard
                    icon="alert-circle-outline"
                    label="Low stock"
                    value={formatNumber(lowStockListings.length)}
                  />
                  <MetricCard
                    icon="cash-outline"
                    label="Inventory value"
                    value={formatCurrency(inventoryValue)}
                  />
                </View>

                <SectionPanel
                  title="Inventory controls"
                  subtitle="Restock products and keep reorder thresholds accurate."
                  action={<Text style={styles.panelCount}>{formatNumber(inventoryListings.length)} products</Text>}
                >
                  <View style={styles.recordStack}>
                    {inventoryListings.length > 0 ? (
                      inventoryListings.map((business) => {
                        const stock = getAvailableStock(business.id);
                        const isLow = stock <= Math.max(1, business.reorderLevel ?? 0);
                        const isOut = stock === 0;

                        return (
                          <View key={business.id} style={styles.recordCard}>
                            <View style={styles.recordTopRow}>
                              <View style={styles.recordCopy}>
                                <Text style={styles.recordTitle}>{business.name}</Text>
                                <Text style={styles.recordMeta}>
                                  {business.ownerName} - {business.cluster}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.recordBadge,
                                  !isLow && !isOut && styles.recordBadgeSuccess,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.recordBadgeText,
                                    !isLow && !isOut && styles.recordBadgeTextSuccess,
                                  ]}
                                >
                                  {isOut ? 'Out of stock' : isLow ? 'Low stock' : 'Healthy'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.recordMeta}>
                              SKU {business.sku ?? 'Pending'} - {formatCurrency(business.price)}
                            </Text>
                            <Text style={styles.recordMeta}>
                              {stock} units in stock - reorder at {business.reorderLevel ?? 0}
                            </Text>
                            <View style={styles.reorderRow}>
                              <TextInput
                                keyboardType="numeric"
                                onChangeText={(value) =>
                                  setReorderDrafts((currentDrafts) => ({
                                    ...currentDrafts,
                                    [business.id]: value,
                                  }))
                                }
                                placeholder="Reorder level"
                                placeholderTextColor="#8A8A8A"
                                style={styles.compactInput}
                                value={
                                  reorderDrafts[business.id] ??
                                  String(business.reorderLevel ?? 1)
                                }
                              />
                              <MonoButton
                                dark={false}
                                label="Save level"
                                onPress={() => handleSaveReorderLevel(business)}
                              />
                              <MonoButton
                                dark
                                label="Restock +10"
                                onPress={() =>
                                  restockBusinessStock(
                                    business.id,
                                    10,
                                    adminUser.fullName,
                                    adminUser.role,
                                  )
                                }
                              />
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyPanelText}>
                        Product listings will appear here once inventory is created.
                      </Text>
                    )}
                  </View>
                </SectionPanel>
              </>
            ) : null}

            {activeSection === 'analytics' && isOwnerAdmin ? (
              <>
                <View style={styles.metricGrid}>
                  <MetricCard
                    icon="repeat-outline"
                    label="Repeat buyers"
                    value={formatNumber(repeatBuyerCount)}
                  />
                  <MetricCard
                    icon="checkmark-done-outline"
                    label="Completion rate"
                    value={asPercent(orderCompletionRate)}
                  />
                  <MetricCard
                    icon="shield-checkmark-outline"
                    label="Approval rate"
                    value={asPercent(approvalRate)}
                  />
                  <MetricCard
                    icon="card-outline"
                    label="Pending payments"
                    value={formatNumber(pendingOrderPayments.length)}
                  />
                </View>

                <View style={[styles.dashboardGrid, !isWideLayout && styles.dashboardGridStacked]}>
                  <SectionPanel
                    title="Top sellers"
                    subtitle="Revenue leaders across the current order history."
                  >
                    <View style={styles.tableStack}>
                      {topSellers.length > 0 ? (
                        topSellers.map((seller) => (
                          <View key={seller.ownerName} style={styles.tableRow}>
                            <View style={styles.tableCopy}>
                              <Text style={styles.tableTitle}>{seller.ownerName}</Text>
                              <Text style={styles.tableMeta}>
                                {formatNumber(seller.orders)} orders - {formatNumber(seller.units)} units
                              </Text>
                            </View>
                            <Text style={styles.tableValue}>{formatCurrency(seller.revenue)}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyPanelText}>
                          Seller analytics will appear after live orders are created.
                        </Text>
                      )}
                    </View>
                  </SectionPanel>

                  <SectionPanel
                    title="Marketplace shape"
                    subtitle="Operational ratios based on local usage."
                  >
                    <View style={styles.totalStack}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Orders per resident</Text>
                        <Text style={styles.totalValue}>{orderDensity.toFixed(2)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Products vs professions</Text>
                        <Text style={styles.totalValue}>
                          {formatNumber(productCount)} / {formatNumber(professionCount)}
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Unverified listings</Text>
                        <Text style={styles.totalValue}>{formatNumber(unverifiedCount)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Support chats</Text>
                        <Text style={styles.totalValue}>{formatNumber(conversations.length)}</Text>
                      </View>
                    </View>
                  </SectionPanel>
                </View>
              </>
            ) : null}

            {activeSection === 'finance' && isOwnerAdmin ? (
              <>
                <View style={styles.metricGrid}>
                  <MetricCard
                    icon="trending-up-outline"
                    label="Gross profit"
                    value={formatCurrency(grossProfit)}
                  />
                  <MetricCard
                    icon="cash-outline"
                    label="GMV"
                    value={formatCurrency(gmv)}
                  />
                  <MetricCard
                    icon="checkmark-circle-outline"
                    label="Paid revenue"
                    value={formatCurrency(paidRevenue)}
                  />
                  <MetricCard
                    icon="time-outline"
                    label="Pending seller funds"
                    value={formatCurrency(pendingRevenue)}
                  />
                  <MetricCard
                    icon="wallet-outline"
                    label="Withdrawn"
                    value={formatCurrency(withdrawnRevenue)}
                  />
                </View>

                <View style={[styles.dashboardGrid, !isWideLayout && styles.dashboardGridStacked]}>
                  <SectionPanel
                    title="Pending payment watchlist"
                    subtitle="Orders still awaiting payment completion."
                  >
                    <View style={styles.tableStack}>
                      {orders.filter((order) => order.paymentStatus === 'pending').length > 0 ? (
                        orders
                          .filter((order) => order.paymentStatus === 'pending')
                          .slice(0, 6)
                          .map((order) => (
                            <View key={order.id} style={styles.tableRow}>
                              <View style={styles.tableCopy}>
                                <Text style={styles.tableTitle}>{order.id}</Text>
                                <Text style={styles.tableMeta}>
                                  {order.userName} - {getOrderStatusLabel(order.status)}
                                </Text>
                              </View>
                              <Text style={styles.tableValue}>
                                {formatCurrency(order.totalAmount)}
                              </Text>
                            </View>
                          ))
                      ) : (
                        <Text style={styles.emptyPanelText}>
                          All recorded orders are fully paid right now.
                        </Text>
                      )}
                    </View>
                  </SectionPanel>

                  <SectionPanel
                    title="Withdrawal ledger"
                    subtitle="Seller withdrawals are removed from available balances immediately."
                  >
                    <View style={styles.tableStack}>
                      {withdrawalRequests.length > 0 ? (
                        withdrawalRequests.slice(0, 8).map((withdrawal) => (
                          <View key={withdrawal.id} style={styles.tableRow}>
                            <View style={styles.tableCopy}>
                              <Text style={styles.tableTitle}>{withdrawal.ownerName}</Text>
                              <Text style={styles.tableMeta}>
                                {withdrawal.bankName} - {withdrawal.accountNumber}
                              </Text>
                              <Text style={styles.tableMeta}>
                                {withdrawal.kycReference ?? 'KYC not recorded'}
                              </Text>
                              <Text style={styles.tableMeta}>
                                {formatDateTime(withdrawal.createdAt)}
                              </Text>
                            </View>
                            <Text style={styles.tableValue}>
                              {formatCurrency(withdrawal.amount)}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyPanelText}>
                          Seller withdrawals will appear here after a business owner submits bank details.
                        </Text>
                      )}
                    </View>
                  </SectionPanel>

                  <SectionPanel
                    title="Reports and exports"
                    subtitle="Download current operational and finance summaries from the web admin."
                  >
                    <View style={styles.actionBlock}>
                      <MonoButton dark label="Export listings" onPress={exportListings} />
                      <MonoButton dark={false} label="Export finance" onPress={exportFinance} />
                    </View>
                    <View style={styles.totalStack}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Cancelled orders</Text>
                        <Text style={styles.totalValue}>{formatNumber(cancelledOrders)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Inventory value</Text>
                        <Text style={styles.totalValue}>{formatCurrency(inventoryValue)}</Text>
                      </View>
                    </View>
                  </SectionPanel>
                </View>
              </>
            ) : null}

            {activeSection === 'payments' ? (
              <>
                <View style={styles.metricGrid}>
                  <MetricCard
                    icon="card-outline"
                    label="Pending orders"
                    value={formatNumber(pendingOrderPayments.length)}
                  />
                  <MetricCard
                    icon="wallet-outline"
                    label="Paid top-ups"
                    value={formatCurrency(paidFlutterwaveDepositTotal)}
                  />
                  <MetricCard
                    icon="time-outline"
                    label="Pending top-ups"
                    value={formatNumber(pendingFlutterwaveDepositCount)}
                  />
                  <MetricCard
                    icon="storefront-outline"
                    label="Paid subscriptions"
                    value={formatNumber(activeSubscriptionCount)}
                  />
                </View>

                {isOwnerAdmin ? (
                  <SectionPanel
                    title="Payment plans"
                    subtitle="Edit the base plans and review the exact duration options shown under the Pay icon in business accounts."
                  >
                    <View style={styles.planGrid}>
                      {paymentPlans.map((plan) => {
                        const draft = paymentPlanDrafts[plan.cycle];

                        return (
                          <View key={plan.cycle} style={styles.planEditorCard}>
                            <View style={styles.planEditorHeader}>
                              <View style={styles.recordCopy}>
                                <Text style={styles.recordTitle}>{plan.title}</Text>
                                <Text style={styles.recordMeta}>
                                  {paymentCycleLabel(plan.cycle)} plan
                                </Text>
                              </View>
                              <View style={styles.recordBadge}>
                                <Text style={styles.recordBadgeText}>
                                  {formatCurrency(plan.amount)}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.planFieldStack}>
                              <TextInput
                                onChangeText={(value) =>
                                  syncPaymentPlanDraft(plan.cycle, { title: value })
                                }
                                placeholder="Plan title"
                                placeholderTextColor="#8A8A8A"
                                style={styles.planInput}
                                value={draft.title}
                              />
                              <TextInput
                                keyboardType="numeric"
                                onChangeText={(value) =>
                                  syncPaymentPlanDraft(plan.cycle, { amount: value })
                                }
                                placeholder="Amount"
                                placeholderTextColor="#8A8A8A"
                                style={styles.planInput}
                                value={draft.amount}
                              />
                              <TextInput
                                multiline
                                onChangeText={(value) =>
                                  syncPaymentPlanDraft(plan.cycle, { description: value })
                                }
                                placeholder="Short description"
                                placeholderTextColor="#8A8A8A"
                                style={[styles.planInput, styles.planTextarea]}
                                textAlignVertical="top"
                                value={draft.description}
                              />
                            </View>

                            <MonoButton
                              dark
                              label="Save plan"
                              onPress={() => savePaymentPlan(plan.cycle)}
                            />
                          </View>
                        );
                      })}
                    </View>
                    <View style={styles.recordCard}>
                      <Text style={styles.recordTitle}>Business account Pay page options</Text>
                      <Text style={styles.recordMeta}>
                        These are the live duration choices business owners see under the Pay icon.
                        Amounts are calculated from the weekly and monthly base plans above.
                      </Text>
                    </View>
                    <View style={styles.planGrid}>
                      {adminSubscriptionDurationOptions.map((option) => (
                        <View key={option.id} style={styles.planEditorCard}>
                          <View style={styles.planEditorHeader}>
                            <View style={styles.recordCopy}>
                              <Text style={styles.recordTitle}>{option.label}</Text>
                              <Text style={styles.recordMeta}>
                                {paymentCycleLabel(option.cycle)} option
                              </Text>
                            </View>
                            <View style={styles.recordBadge}>
                              <Text style={styles.recordBadgeText}>
                                {formatCurrency(option.amount)}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.recordMeta}>{option.description}</Text>
                          <Text style={styles.recordMeta}>
                            Business owners pay this amount per listing covered.
                          </Text>
                        </View>
                      ))}
                    </View>
                  </SectionPanel>
                ) : (
                  <SectionPanel
                    title="Payment plans"
                    subtitle="Customer care can see the active base plans and business Pay-page options, but only the owner can edit them."
                  >
                    <View style={styles.recordStack}>
                      {paymentPlans.map((plan) => (
                        <View key={plan.cycle} style={styles.recordCard}>
                          <View style={styles.recordTopRow}>
                            <View style={styles.recordCopy}>
                              <Text style={styles.recordTitle}>{plan.title}</Text>
                              <Text style={styles.recordMeta}>{paymentCycleLabel(plan.cycle)}</Text>
                            </View>
                            <View style={styles.recordBadge}>
                              <Text style={styles.recordBadgeText}>
                                {formatCurrency(plan.amount)}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.recordMeta}>{plan.description}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.recordCard}>
                      <Text style={styles.recordTitle}>Business account Pay page options</Text>
                      <Text style={styles.recordMeta}>
                        These are the exact duration choices shown under the Pay icon in a
                        business account.
                      </Text>
                    </View>
                    <View style={styles.planGrid}>
                      {adminSubscriptionDurationOptions.map((option) => (
                        <View key={option.id} style={styles.planEditorCard}>
                          <View style={styles.planEditorHeader}>
                            <View style={styles.recordCopy}>
                              <Text style={styles.recordTitle}>{option.label}</Text>
                              <Text style={styles.recordMeta}>
                                {paymentCycleLabel(option.cycle)} option
                              </Text>
                            </View>
                            <View style={styles.recordBadge}>
                              <Text style={styles.recordBadgeText}>
                                {formatCurrency(option.amount)}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.recordMeta}>{option.description}</Text>
                          <Text style={styles.recordMeta}>
                            Business owners pay this amount per listing covered.
                          </Text>
                        </View>
                      ))}
                    </View>
                  </SectionPanel>
                )}

                <SectionPanel
                  title="Flutterwave add-funds ledger"
                  subtitle="Read-only record of checkout top-ups and generated bank-account transfers."
                >
                  <View style={styles.recordStack}>
                    {recentFlutterwaveDeposits.length > 0 ? (
                      recentFlutterwaveDeposits.map((deposit) => (
                        <View key={deposit.id} style={styles.recordCard}>
                          <View style={styles.recordTopRow}>
                            <View style={styles.recordCopy}>
                              <Text style={styles.recordTitle}>{deposit.userName}</Text>
                              <Text style={styles.recordMeta}>{deposit.userEmail}</Text>
                            </View>
                            <View style={styles.recordBadge}>
                              <Text style={styles.recordBadgeText}>
                                {getDepositStatusLabel(deposit.status)}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.recordMeta}>
                            {flutterwaveDepositChannelLabel(deposit)} -{' '}
                            {formatCurrency(deposit.amount)}
                          </Text>
                          <Text style={styles.recordMeta}>
                            {flutterwaveDepositDetailLabel(deposit)}
                          </Text>
                          <Text style={styles.recordMeta}>Account name {deposit.accountName}</Text>
                          <Text style={styles.recordMeta}>
                            Reference {deposit.reference} - Provider {deposit.providerReference}
                          </Text>
                          {deposit.providerChargeId ? (
                            <Text style={styles.recordMeta}>
                              Charge {deposit.providerChargeId}
                            </Text>
                          ) : null}
                          <Text style={styles.recordMeta}>
                            Created {formatDateTime(deposit.createdAt)}
                            {deposit.paidAt ? ` - Paid ${formatDateTime(deposit.paidAt)}` : ''}
                          </Text>
                          {deposit.failureReason ? (
                            <Text style={styles.recordMeta}>{deposit.failureReason}</Text>
                          ) : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyPanelText}>
                        Add-funds transactions will appear here after users start Flutterwave checkout or generate a bank account.
                      </Text>
                    )}
                  </View>
                </SectionPanel>

                <View style={[styles.dashboardGrid, !isWideLayout && styles.dashboardGridStacked]}>
                  <SectionPanel
                    title="Order payment queue"
                    subtitle="Customer care confirms the buyer's payment before the seller packs the order."
                  >
                    <View style={styles.recordStack}>
                      {pendingOrderPayments.length > 0 ? (
                        pendingOrderPayments.slice(0, 6).map((order) => (
                          <View key={order.id} style={styles.recordCard}>
                            <View style={styles.recordTopRow}>
                              <View style={styles.recordCopy}>
                                <Text style={styles.recordTitle}>{order.id}</Text>
                                <Text style={styles.recordMeta}>{order.userName}</Text>
                              </View>
                              <View style={styles.recordBadge}>
                                <Text style={styles.recordBadgeText}>
                                  {formatCurrency(order.totalAmount)}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.recordMeta}>
                              {getOrderStatusLabel(order.status)} -{' '}
                              {getPaymentMethodLabel(order.paymentMethod)}
                            </Text>
                            <Text style={styles.recordMeta}>
                              {order.items.map((item) => item.businessName).join(', ')}
                            </Text>
                            <View style={styles.inlineActionRow}>
                              <MonoButton
                                dark
                                label="Confirm payment"
                                onPress={() => confirmOrderPayment(order)}
                              />
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyPanelText}>
                          There are no pending order payments right now.
                        </Text>
                      )}
                    </View>
                  </SectionPanel>

                  <SectionPanel
                    title="Business subscriptions"
                    subtitle="Confirm owner profile payments so approved listings can become public."
                  >
                    <View style={styles.recordStack}>
                      {pendingSubscriptionProfiles.length > 0 ? (
                        pendingSubscriptionProfiles.slice(0, 6).map((profile) => {
                          const selectedPlan =
                            paymentPlans.find(
                              (plan) => plan.cycle === (profile.subscriptionCycle ?? 'monthly'),
                            ) ?? paymentPlans[0];
                          const ownerListings = businesses.filter(
                            (business) =>
                              business.ownerUserId === profile.ownerUserId ||
                              business.ownerEmail === profile.accountEmail ||
                              business.ownerEmail === profile.email ||
                              business.ownerName === profile.accountName ||
                              business.ownerName === profile.ownerName,
                          );
                          const itemCount = Math.max(1, ownerListings.length);
                          const expectedAmount = (selectedPlan?.amount ?? 0) * itemCount;

                          return (
                            <View key={profile.id} style={styles.recordCard}>
                              <View style={styles.recordTopRow}>
                                <View style={styles.recordCopy}>
                                  <Text style={styles.recordTitle}>{profile.ownerName}</Text>
                                  <Text style={styles.recordMeta}>{profile.accountEmail}</Text>
                                </View>
                                <View style={styles.recordBadge}>
                                  <Text style={styles.recordBadgeText}>
                                    {paymentCycleLabel(profile.subscriptionCycle ?? 'monthly')}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.recordMeta}>
                                Status{' '}
                                {isSubscriptionActive(
                                  profile.subscriptionStatus,
                                  profile.subscriptionNextBillingAt,
                                )
                                  ? 'Active'
                                  : subscriptionStatusLabel(profile.subscriptionStatus)}
                              </Text>
                              <Text style={styles.recordMeta}>
                                Expected amount {formatCurrency(expectedAmount)} - Items covered{' '}
                                {formatNumber(itemCount)}
                              </Text>
                              <Text style={styles.recordMeta}>
                                {subscriptionWindowLabel(profile.subscriptionNextBillingAt)}
                              </Text>
                              <Text style={styles.recordMeta}>
                                Verified amount {formatCurrency(profile.verifiedAmount ?? 0)}
                              </Text>
                              <View style={styles.inlineActionRow}>
                                <MonoButton
                                  dark
                                  label="Confirm plan"
                                  onPress={() => confirmSubscriptionPayment(profile)}
                                />
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.emptyPanelText}>
                          All business subscriptions are paid right now.
                        </Text>
                      )}
                    </View>
                  </SectionPanel>
                </View>

                <SectionPanel
                  title="Automated emails"
                  subtitle="Order confirmations and next-step messages are logged here after payment."
                >
                  <View style={styles.recordStack}>
                    {recentEmailLogs.length > 0 ? (
                      recentEmailLogs.map((log) => (
                        <View key={log.id} style={styles.recordCard}>
                          <View style={styles.recordTopRow}>
                            <View style={styles.recordCopy}>
                              <Text style={styles.recordTitle}>{log.subject}</Text>
                              <Text style={styles.recordMeta}>{log.recipientName}</Text>
                            </View>
                            <View style={styles.recordBadge}>
                              <Text style={styles.recordBadgeText}>{log.recipientType}</Text>
                            </View>
                          </View>
                          <Text style={styles.recordMeta}>{log.recipientEmail}</Text>
                          <Text style={styles.recordMeta}>{log.body}</Text>
                          <Text style={styles.recordMeta}>
                            {log.status === 'sent' ? 'Sent' : 'Queued'} -{' '}
                            {formatDateTime(log.createdAt)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyPanelText}>
                        Automated notification emails will appear here once they are sent.
                      </Text>
                    )}
                  </View>
                </SectionPanel>

                <SectionPanel
                  title="Recent subscription payments"
                  subtitle="Shows the exact duration and amount paid from each business owner's account."
                >
                  <View style={styles.recordStack}>
                    {recentSubscriptionPayments.length > 0 ||
                    recentSubscriptionProfileFallbacks.length > 0 ? (
                      <>
                        {recentSubscriptionPayments.map((payment) => {
                          const durationLabel = subscriptionPaymentDurationLabel(payment);
                          const amountPerListing = subscriptionPaymentAmountPerListing(payment);

                          return (
                            <View key={payment.reference} style={styles.recordCard}>
                              <View style={styles.recordTopRow}>
                                <View style={styles.recordCopy}>
                                  <Text style={styles.recordTitle}>{payment.ownerName}</Text>
                                  <Text style={styles.recordMeta}>{payment.reference}</Text>
                                </View>
                                <View style={styles.recordBadge}>
                                  <Text style={styles.recordBadgeText}>{durationLabel}</Text>
                                </View>
                              </View>
                              <Text style={styles.recordMeta}>{payment.ownerEmail}</Text>
                              <Text style={styles.recordMeta}>
                                Total {formatCurrency(payment.amount)} -{' '}
                                {formatCurrency(amountPerListing)} each
                              </Text>
                              <Text style={styles.recordMeta}>
                                {payment.status} - {formatDateTime(payment.paidAt ?? payment.createdAt)}
                              </Text>
                            </View>
                          );
                        })}
                        {recentSubscriptionProfileFallbacks.map((profile) => {
                          const itemCount = Math.max(1, profile.subscriptionItemCount ?? 1);
                          const amount = profile.verifiedAmount ?? 0;
                          const amountPerListing = amount / itemCount;

                          return (
                            <View key={`profile-sub-${profile.id}`} style={styles.recordCard}>
                              <View style={styles.recordTopRow}>
                                <View style={styles.recordCopy}>
                                  <Text style={styles.recordTitle}>{profile.ownerName}</Text>
                                  <Text style={styles.recordMeta}>{profile.accountEmail}</Text>
                                </View>
                                <View style={styles.recordBadge}>
                                  <Text style={styles.recordBadgeText}>Profile record</Text>
                                </View>
                              </View>
                              <Text style={styles.recordMeta}>
                                {paymentCycleLabel(profile.subscriptionCycle ?? 'monthly')} subscription
                              </Text>
                              <Text style={styles.recordMeta}>
                                Total {formatCurrency(amount)} - {formatCurrency(amountPerListing)} each
                              </Text>
                              <Text style={styles.recordMeta}>
                                Items covered {formatNumber(itemCount)} -{' '}
                                {subscriptionWindowLabel(profile.subscriptionNextBillingAt)}
                              </Text>
                            </View>
                          );
                        })}
                      </>
                    ) : (
                      <Text style={styles.emptyPanelText}>
                        Subscription payments will appear here after a business owner pays.
                      </Text>
                    )}
                  </View>
                </SectionPanel>
              </>
            ) : null}

            {activeSection === 'codes' && isOwnerAdmin ? (
              <SectionPanel
                title="Admin PIN"
                subtitle="Owner admin creates the 4 digit PIN required before admin changes can be made."
                action={
                  <Text style={styles.panelCount}>
                    {orderProgressSettings.code ? 'PIN active' : 'No PIN'}
                  </Text>
                }
              >
                <View style={styles.recordStack}>
                  <View style={styles.recordCard}>
                    <View style={styles.recordTopRow}>
                      <View style={styles.recordCopy}>
                        <Text style={styles.recordTitle}>Admin change approval</Text>
                        <Text style={styles.recordMeta}>
                          {orderProgressSettings.updatedAt
                            ? `Last changed ${formatDateTime(orderProgressSettings.updatedAt)}`
                            : 'Create a PIN before making admin changes.'}
                        </Text>
                      </View>
                      <View style={styles.recordBadge}>
                        <Text style={styles.recordBadgeText}>
                          {orderProgressSettings.code ? 'Required' : 'Not set'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reorderRow}>
                      <TextInput
                        keyboardType="numeric"
                        maxLength={4}
                        onChangeText={(value) =>
                          setProgressCodeDraft(value.replace(/\D/g, '').slice(0, 4))
                        }
                        placeholder="4 digit PIN"
                        placeholderTextColor="#777777"
                        style={styles.compactInput}
                        value={progressCodeDraft}
                      />
                      <MonoButton dark label="Save PIN" onPress={handleSaveProgressCode} />
                    </View>
                  </View>

                  <View style={styles.recordCard}>
                    <View style={styles.recordTopRow}>
                      <View style={styles.recordCopy}>
                        <Text style={styles.recordTitle}>Fresh order testing</Text>
                        <Text style={styles.recordMeta}>
                          Clears orders, cart items, withdrawals, and order notifications. Buyer wallet returns to 200k and seller balance returns to 0.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.inlineActionRow}>
                      <MonoButton
                        dark={false}
                        disabled={orders.length === 0 && withdrawalRequests.length === 0}
                        label="Clear all orders"
                        onPress={handleClearOrderTestingState}
                      />
                    </View>
                  </View>
                </View>
              </SectionPanel>
            ) : null}

            {activeSection === 'emails' ? (
              <>
                <View style={styles.metricGrid}>
                  <MetricCard
                    icon="mail-outline"
                    label="Email logs"
                    value={formatNumber(emailLogs.length)}
                  />
                  <MetricCard
                    icon="receipt-outline"
                    label="Order emails"
                    value={formatNumber(emailLogs.filter((log) => log.orderId).length)}
                  />
                  <MetricCard
                    icon="storefront-outline"
                    label="Business emails"
                    value={formatNumber(emailLogs.filter((log) => log.businessId).length)}
                  />
                  <MetricCard
                    icon="checkmark-circle-outline"
                    label="Sent"
                    value={formatNumber(emailLogs.filter((log) => log.status === 'sent').length)}
                  />
                </View>

                <SectionPanel
                  title="Email center"
                  subtitle="Actual emails sent or queued for users and business owners can be edited here."
                >
                  <View style={styles.recordStack}>
                    {emailLogs.length > 0 ? (
                      emailLogs.map((log) => (
                        <View key={log.id} style={styles.recordCard}>
                          <View style={styles.recordTopRow}>
                            <View style={styles.recordCopy}>
                              <Text style={styles.recordTitle}>{log.subject}</Text>
                              <Text style={styles.recordMeta}>{log.recipientName}</Text>
                            </View>
                            <View style={styles.recordBadge}>
                              <Text style={styles.recordBadgeText}>{log.recipientType}</Text>
                            </View>
                          </View>
                          <Text style={styles.recordMeta}>{log.recipientEmail}</Text>
                          <TextInput
                            onChangeText={(subject) =>
                              handleEmailLogUpdate(log.id, { subject, body: log.body })
                            }
                            placeholder="Email subject"
                            placeholderTextColor="#8A8A8A"
                            style={styles.compactInput}
                            value={log.subject}
                          />
                          <TextInput
                            multiline
                            onChangeText={(body) =>
                              handleEmailLogUpdate(log.id, { subject: log.subject, body })
                            }
                            placeholder="Email body"
                            placeholderTextColor="#8A8A8A"
                            style={[styles.compactInput, styles.largeInput]}
                            value={log.body}
                          />
                          <Text style={styles.recordMeta}>
                            {log.status === 'sent' ? 'Sent' : 'Queued'} -{' '}
                            {formatDateTime(log.createdAt)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyPanelText}>
                        Emails will appear here after business submission and payment events.
                      </Text>
                    )}
                  </View>
                </SectionPanel>
              </>
            ) : null}

            {activeSection === 'users' ? (
              <SectionPanel
                title="Users"
                subtitle="Search residents and business owners across the estate."
                action={<Text style={styles.panelCount}>{formatNumber(filteredUsers.length)} users</Text>}
              >
                <View style={styles.filterWrap}>
                  {userRoleOptions.map((role) => {
                    const isActive = userRoleFilter === role;
                    return (
                      <Pressable
                        key={role}
                        onPress={() => setUserRoleFilter(role)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isActive && styles.filterChipActive,
                          pressed && styles.filterChipPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {role === 'All' ? 'All roles' : role}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.filterWrap}>
                  {userStatusOptions.map((status) => {
                    const isActive = userStatusFilter === status;
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setUserStatusFilter(status)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isActive && styles.filterChipActive,
                          pressed && styles.filterChipPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {userStatusChipLabel(status)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.recordStack}>
                  {filteredUsers.map((user) => {
                    const riverParkVerified = isRiverParkVerifiedForUser(user.id);
                    const ownerSubscriptionStatus = subscriptionStatusForUser(user.id);
                    const ownerSubscriptionWindow = subscriptionWindowForUser(user.id);
                    const accountStartingBalance = getAccountStartingBalance(user);
                    const accountBalance = accountBalanceForUser(user);

                    return (
                      <View key={user.id} style={styles.recordCard}>
                        <View style={styles.recordTopRow}>
                          <View style={styles.recordCopy}>
                            <Text style={styles.recordTitle}>{user.fullName}</Text>
                            <Text style={styles.recordMeta}>{user.email}</Text>
                          </View>
                          <View style={styles.recordBadge}>
                            <Text style={styles.recordBadgeText}>{user.role}</Text>
                          </View>
                        </View>
                        <View style={styles.badgeRow}>
                          <View
                            style={[
                              styles.recordBadge,
                              (user.status ?? 'active') === 'active' && styles.recordBadgeSuccess,
                            ]}
                          >
                            <Text
                              style={[
                                styles.recordBadgeText,
                                (user.status ?? 'active') === 'active' &&
                                  styles.recordBadgeTextSuccess,
                              ]}
                            >
                              {getUserStatusLabel(user.status)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.recordMeta}>{user.phoneNumber}</Text>
                        <Text style={styles.recordMeta}>
                          UID {user.id} - {estateLookup[user.estateId] ?? user.estateId} - Joined{' '}
                          {formatDateTime(user.createdAt)}
                        </Text>
                        {user.role === 'businessOwner' ? (
                          <>
                            <Text style={styles.recordMeta}>
                              {user.businessName ?? 'Business owner'} - {user.businessCluster ?? 'River Park'}
                            </Text>
                            <View style={styles.totalStack}>
                              <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>River Park verification</Text>
                                <Text style={styles.totalValue}>
                                  {riverParkVerified ? 'Verified' : 'Pending'}
                                </Text>
                              </View>
                              <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Subscription payment</Text>
                                <Text style={styles.totalValue}>
                                  {isSubscriptionActive(ownerSubscriptionStatus, ownerSubscriptionWindow)
                                    ? 'Active'
                                    : subscriptionStatusLabel(ownerSubscriptionStatus)}
                                </Text>
                              </View>
                              <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Subscription window</Text>
                                <Text style={styles.totalValue}>
                                  {subscriptionWindowLabel(ownerSubscriptionWindow)}
                                </Text>
                              </View>
                              <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Account balance</Text>
                                <Text style={styles.totalValue}>{formatCurrency(accountBalance)}</Text>
                              </View>
                              <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Starting funds</Text>
                                <Text style={styles.totalValue}>
                                  {formatCurrency(accountStartingBalance)}
                                </Text>
                              </View>
                              <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Listing verification</Text>
                                <Text style={styles.totalValue}>
                                  {listingVerificationSummaryForUser(user.id)}
                                </Text>
                              </View>
                            </View>
                          </>
                        ) : null}
                        {isOwnerAdmin ? (
                          <View style={styles.inlineActionRow}>
                            <MonoButton
                              dark={(user.status ?? 'active') !== 'active'}
                              label={(user.status ?? 'active') === 'active' ? 'Suspend' : 'Restore'}
                              onPress={() => toggleUserStatus(user.id, user.status)}
                            />
                            {user.role === 'businessOwner' ? (
                              <MonoButton
                                dark={!riverParkVerified}
                                label={riverParkVerified ? 'Mark River Park pending' : 'Verify River Park'}
                                onPress={() =>
                                  runAdminChange(
                                    'Admin PIN',
                                    'Enter the PIN before changing River Park verification.',
                                    () => {
                                      setUserRiverParkVerification(
                                        user.id,
                                        !riverParkVerified,
                                        adminUser.fullName,
                                        adminUser.role,
                                      );
                                      setOwnerRiverParkVerification(
                                        user.id,
                                        !riverParkVerified,
                                        adminUser.fullName,
                                        adminUser.role,
                                      );
                                    },
                                  )
                                }
                              />
                            ) : null}
                          </View>
                        ) : (
                          <Text style={styles.recordMeta}>Status changes are owner only.</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </SectionPanel>
            ) : null}

            {activeSection === 'listings' && canReviewListings ? (
              <SectionPanel
                title="Listings"
                subtitle="Approve, monitor, or remove anything published in the marketplace."
                action={<Text style={styles.panelCount}>{formatNumber(filteredListings.length)} listings</Text>}
              >
                <View style={styles.filterWrap}>
                  {listingTypeOptions.map((type) => {
                    const isActive = listingTypeFilter === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setListingTypeFilter(type)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isActive && styles.filterChipActive,
                          pressed && styles.filterChipPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {type === 'All' ? 'All listings' : listingTypeLabel(type)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.filterWrap}>
                  {listingStatusOptions.map((status) => {
                    const isActive = listingStatusFilter === status;
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setListingStatusFilter(status)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isActive && styles.filterChipActive,
                          pressed && styles.filterChipPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {listingStatusChipLabel(status)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.filterWrap}>
                  {verificationOptions.map((status) => {
                    const isActive = verificationFilter === status;
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setVerificationFilter(status)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          isActive && styles.filterChipActive,
                          pressed && styles.filterChipPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {status === 'All' ? 'All verification' : status}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.recordStack}>
                  {filteredListings.map((business) => {
                    const stock =
                      business.listingType === 'product'
                        ? getAvailableStock(business.id)
                        : null;

                    return (
                      <View key={business.id} style={styles.recordCard}>
                        <View style={styles.recordTopRow}>
                          <View style={styles.recordCopy}>
                            <Text style={styles.recordTitle}>{business.name}</Text>
                            <Text style={styles.recordMeta}>{business.ownerName}</Text>
                          </View>
                          <View style={styles.badgeRow}>
                            <View
                              style={[
                                styles.recordBadge,
                                business.verified && styles.recordBadgeSuccess,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.recordBadgeText,
                                  business.verified && styles.recordBadgeTextSuccess,
                                ]}
                              >
                                {verificationLabel(business.verified)}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.recordBadge,
                                (business.status ?? 'active') === 'active' &&
                                  styles.recordBadgeSuccess,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.recordBadgeText,
                                  (business.status ?? 'active') === 'active' &&
                                    styles.recordBadgeTextSuccess,
                                ]}
                              >
                                {getBusinessStatusLabel(business.status)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.recordMeta}>
                          {listingTypeLabel(business.listingType)} - {business.category} - {business.cluster}
                        </Text>
                        <Text style={styles.recordMeta}>
                          {business.listingType === 'product'
                            ? formatCurrency(business.price)
                            : 'No public amount'}{' '}
                          - {business.ownerEmail ?? business.contact.email}
                        </Text>
                        <Text style={styles.recordMeta}>
                          Plan {paymentCycleLabel(business.subscriptionCycle ?? 'monthly')} -{' '}
                          {isSubscriptionActive(
                            business.subscriptionStatus,
                            business.subscriptionNextBillingAt,
                          )
                            ? 'Active'
                            : subscriptionStatusLabel(business.subscriptionStatus)} - Verified{' '}
                          {formatCurrency(business.verifiedAmount ?? 0)}
                        </Text>
                        <Text style={styles.recordMeta}>
                          {subscriptionWindowLabel(business.subscriptionNextBillingAt)}
                        </Text>
                        <Text style={styles.recordMeta}>
                          {business.listingType === 'product'
                            ? `Stock ${formatNumber(getAvailableStock(business.id))} / reorder ${business.reorderLevel ?? 0}`
                            : business.responseTime}
                        </Text>
                        <Text style={styles.recordMeta}>
                          Items covered: {formatNumber(business.subscriptionItemCount ?? 1)}
                        </Text>
                        {stock != null ? (
                          <Text style={styles.recordMeta}>
                            SKU {business.sku ?? 'Pending'} - {formatNumber(stock)} units
                          </Text>
                        ) : null}
                        {business.media.length > 0 ? (
                          <ScrollView
                            horizontal
                            nestedScrollEnabled
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.inspectionMediaRow}
                          >
                            {business.media.map((item) => {
                              const mediaIsLocal = isLocalOnlyMediaUrl(item.url);
                              const thumbnailIsLocal = item.thumbnailUrl
                                ? isLocalOnlyMediaUrl(item.thumbnailUrl)
                                : false;

                              return item.type === 'image' ? (
                                <Pressable
                                  key={item.id}
                                  onPress={() => openListingMedia(item)}
                                  style={({ pressed }) => [
                                    styles.inspectionMediaCard,
                                    pressed && styles.recordCardPressed,
                                  ]}
                                >
                                  {mediaIsLocal ? (
                                    <View style={styles.inspectionMissingMedia}>
                                      <Ionicons color="#777777" name="image-outline" size={24} />
                                      <Text style={styles.inspectionMissingMediaText}>
                                        Needs upload
                                      </Text>
                                    </View>
                                  ) : (
                                    <Image
                                      resizeMode="cover"
                                      source={{ uri: item.url }}
                                      style={styles.inspectionImage}
                                    />
                                  )}
                                  <Text numberOfLines={1} style={styles.inspectionMediaLabel}>
                                    {item.label}
                                  </Text>
                                  <Text numberOfLines={1} style={styles.recordMeta}>
                                    {mediaIsLocal ? 'Reselect this photo' : 'Tap to view photo'}
                                  </Text>
                                </Pressable>
                              ) : (
                                <Pressable
                                  key={item.id}
                                  onPress={() => openListingMedia(item)}
                                  style={({ pressed }) => [
                                    styles.inspectionVideoCard,
                                    pressed && styles.recordCardPressed,
                                  ]}
                                >
                                  {item.thumbnailUrl && !thumbnailIsLocal ? (
                                    <Image
                                      resizeMode="cover"
                                      source={{ uri: item.thumbnailUrl }}
                                      style={styles.inspectionVideoThumbnail}
                                    />
                                  ) : (
                                    <View style={styles.inspectionMissingVideo}>
                                      <Ionicons color="#777777" name="videocam-outline" size={24} />
                                    </View>
                                  )}
                                  <View style={styles.inspectionVideoOverlay}>
                                    <Ionicons color="#FFFFFF" name="play-circle-outline" size={28} />
                                  </View>
                                  <Text numberOfLines={1} style={styles.inspectionMediaLabel}>
                                    {item.label}
                                  </Text>
                                  <Text numberOfLines={1} style={styles.recordMeta}>
                                    {mediaIsLocal ? 'Reselect this video' : 'Tap to view video'}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        ) : (
                          <Text style={styles.recordMeta}>No listing media uploaded.</Text>
                        )}
                        <View style={styles.inlineActionRow}>
                          <MonoButton
                            dark={!business.verified}
                            label={business.verified ? 'Unverify' : 'Verify'}
                            onPress={() => handleToggleBusinessVerification(business)}
                          />
                          {canReviewListings ? (
                            <MonoButton
                              dark={false}
                              label="Delete"
                              onPress={() => handleDeleteBusiness(business)}
                            />
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </SectionPanel>
            ) : null}

            {activeSection === 'chats' ? (
              <SectionPanel
                title="Customer care chats"
                subtitle="Reply to support conversations from residents and business owners."
                action={
                  <View style={styles.panelActionRow}>
                    <Text style={styles.panelCount}>{formatNumber(filteredChats.length)} chats</Text>
                    <MonoButton
                      dark={false}
                      disabled={conversations.length === 0}
                      label="Delete latest"
                      onPress={handleDeleteLatestSupportConversation}
                    />
                  </View>
                }
              >
                <View style={styles.recordStack}>
                  {filteredChats.length > 0 ? (
                    filteredChats.map((conversation: SupportConversation) => {
                      const latestUserMessage = getLatestUserSupportMessage(conversation);
                      const displayMessage = latestUserMessage ?? conversation.lastMessage;

                      return (
                      <View key={conversation.id} style={styles.recordCard}>
                        <View style={styles.recordTopRow}>
                          <View style={styles.recordCopy}>
                            <Text style={styles.recordTitle}>{conversation.userName}</Text>
                            <Text style={styles.recordMeta}>{conversation.userRole}</Text>
                          </View>
                          <View style={styles.recordBadge}>
                            <Text style={styles.recordBadgeText}>
                              {formatNumber(conversation.messages.length)} messages
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.recordMeta}>{displayMessage.text}</Text>
                        {displayMessage.contextLabel ? (
                          <Text style={styles.recordMeta}>
                            Context: {displayMessage.contextType ?? 'general'} -{' '}
                            {displayMessage.contextLabel}
                          </Text>
                        ) : null}
                        <Text style={styles.recordMeta}>
                          Last user message {formatDateTime(displayMessage.createdAt)}
                        </Text>
                        <View style={styles.supportPreviewStack}>
                          {conversation.messages.slice(-3).map((message) => (
                            <View key={message.id} style={styles.supportPreviewBubble}>
                              <Text style={styles.recordMeta}>
                                {message.senderName}: {message.text}
                              </Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.reorderRow}>
                          <TextInput
                            onChangeText={(value) =>
                              setSupportReplyDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [conversation.id]: value,
                              }))
                            }
                            placeholder="Reply as customer care"
                            placeholderTextColor="#8A8A8A"
                            style={[styles.compactInput, styles.replyInput]}
                            value={supportReplyDrafts[conversation.id] ?? ''}
                          />
                          <MonoButton
                            dark
                            label="Send reply"
                            onPress={() => replyToSupportConversation(conversation)}
                          />
                          <MonoButton
                            dark={false}
                            label="Delete"
                            onPress={() => handleDeleteSupportConversation(conversation.id)}
                          />
                        </View>
                      </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyPanelText}>
                      Customer care chats will appear here when users send support messages.
                    </Text>
                  )}
                </View>
              </SectionPanel>
            ) : null}

            {activeSection === 'customerCare' && isOwnerAdmin ? (
              <SectionPanel
                title="Customer care access"
                subtitle="Owner decides which customer care accounts stay active."
                action={<Text style={styles.panelCount}>{formatNumber(customerCareAccounts.length)} accounts</Text>}
              >
                <View style={styles.recordCard}>
                  <View style={styles.recordTopRow}>
                    <View style={styles.recordCopy}>
                      <Text style={styles.recordTitle}>Create customer care account</Text>
                      <Text style={styles.recordMeta}>
                        Add a new support agent for admin login and customer care replies.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.customerCareFormGrid}>
                    <TextInput
                      onChangeText={(value) => {
                        setCustomerCareDraft((currentDraft) => ({
                          ...currentDraft,
                          fullName: value,
                        }));
                        setCustomerCareError(null);
                      }}
                      placeholder="Agent name"
                      placeholderTextColor="#8A8A8A"
                      style={[styles.compactInput, styles.customerCareInput]}
                      value={customerCareDraft.fullName}
                    />
                    <TextInput
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={(value) => {
                        setCustomerCareDraft((currentDraft) => ({
                          ...currentDraft,
                          email: value,
                        }));
                        setCustomerCareError(null);
                      }}
                      placeholder="Agent email"
                      placeholderTextColor="#8A8A8A"
                      style={[styles.compactInput, styles.customerCareInput]}
                      value={customerCareDraft.email}
                    />
                    <TextInput
                      onChangeText={(value) => {
                        setCustomerCareDraft((currentDraft) => ({
                          ...currentDraft,
                          password: value,
                        }));
                        setCustomerCareError(null);
                      }}
                      placeholder="Password"
                      placeholderTextColor="#8A8A8A"
                      secureTextEntry
                      style={[styles.compactInput, styles.customerCareInput]}
                      value={customerCareDraft.password}
                    />
                  </View>
                  {customerCareError ? (
                    <Text style={styles.errorText}>{customerCareError}</Text>
                  ) : null}
                  <View style={styles.inlineActionRow}>
                    <MonoButton
                      dark
                      label="Create account"
                      onPress={handleCreateCustomerCareAccount}
                    />
                  </View>
                </View>
                <View style={styles.recordStack}>
                  {customerCareAccounts.map((account) => (
                    <View key={account.id} style={styles.recordCard}>
                      <View style={styles.recordTopRow}>
                        <View style={styles.recordCopy}>
                          <Text style={styles.recordTitle}>{account.fullName}</Text>
                          <Text style={styles.recordMeta}>{account.email}</Text>
                        </View>
                        <View
                          style={[
                            styles.recordBadge,
                            account.isActive && styles.recordBadgeSuccess,
                          ]}
                        >
                          <Text
                            style={[
                              styles.recordBadgeText,
                              account.isActive && styles.recordBadgeTextSuccess,
                            ]}
                          >
                            {account.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.recordMeta}>
                        Created {formatDateTime(account.createdAt)}
                      </Text>
                      <View style={styles.customerCareFormGrid}>
                        <TextInput
                          onChangeText={(value) => {
                            setCustomerCarePasswordDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [account.id]: value,
                            }));
                            setCustomerCareError(null);
                          }}
                          placeholder="New login password"
                          placeholderTextColor="#8A8A8A"
                          secureTextEntry
                          style={[styles.compactInput, styles.customerCareInput]}
                          value={customerCarePasswordDrafts[account.id] ?? ''}
                        />
                        <MonoButton
                          dark={false}
                          label="Update password"
                          onPress={() => handleUpdateCustomerCarePassword(account.id)}
                        />
                      </View>
                        <View style={styles.inlineActionRow}>
                          <MonoButton
                            dark={!account.isActive}
                            label={account.isActive ? 'Deactivate' : 'Activate'}
                            onPress={() =>
                              setAdminAccountActive(
                                account.id,
                                !account.isActive,
                                adminUser.fullName,
                                adminUser.role,
                              )
                            }
                          />
                        </View>
                    </View>
                  ))}
                </View>
              </SectionPanel>
            ) : null}

            {activeSection === 'policies' && isOwnerAdmin ? (
              <SectionPanel
                title="Policies"
                subtitle="The in-app privacy policy and user agreement shown to customers."
              >
                <View style={styles.policyStack}>
                  <View style={styles.policyBlock}>
                    <Text style={styles.policyTitle}>{privacyPolicyTitle}</Text>
                    {privacyPolicySections.map((section) => (
                      <View key={section.title} style={styles.policySection}>
                        <Text style={styles.policySectionTitle}>{section.title}</Text>
                        <Text style={styles.policyBody}>{section.body}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.policyBlock}>
                    <Text style={styles.policyTitle}>{userAgreementTitle}</Text>
                    {userAgreementSections.map((section) => (
                      <View key={section.title} style={styles.policySection}>
                        <Text style={styles.policySectionTitle}>{section.title}</Text>
                        <Text style={styles.policyBody}>{section.body}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </SectionPanel>
            ) : null}

            {activeSection === 'security' && isOwnerAdmin ? (
              <>
                <SectionPanel
                  title="Security and access"
                  subtitle="Manage signup availability, maintenance mode, checkout access, and platform safety rules."
                >
                  <View style={styles.securityStack}>
                    {[
                      {
                        key: 'allowResidentSignups' as const,
                        label: 'Resident signups',
                        description: 'Allow new resident accounts to be created from the signup page.',
                      },
                      {
                        key: 'allowBusinessOwnerSignups' as const,
                        label: 'Business owner signups',
                        description: 'Allow new seller accounts to join and create listings.',
                      },
                      {
                        key: 'maintenanceMode' as const,
                        label: 'Maintenance mode',
                        description: 'Pause resident login and signup while local work is being completed.',
                      },
                      {
                        key: 'blockCheckout' as const,
                        label: 'Checkout access',
                        description: 'Pause new orders without disabling the rest of the marketplace.',
                      },
                      {
                        key: 'requireManualListingApproval' as const,
                        label: 'Manual listing approval',
                        description: 'Keep newly created listings hidden until the owner verifies them.',
                      },
                      {
                        key: 'loginAnnouncementEnabled' as const,
                        label: 'Login popup',
                        description: 'Show the editable announcement immediately after users sign in.',
                      },
                    ].map((setting) => {
                      const value =
                        setting.key === 'blockCheckout'
                          ? !securitySettings.blockCheckout
                          : securitySettings[setting.key];
                      const label =
                        setting.key === 'blockCheckout'
                          ? securitySettings.blockCheckout
                            ? 'Paused'
                            : 'Open'
                          : value
                            ? 'Enabled'
                            : 'Paused';

                      return (
                        <View key={setting.key} style={styles.securityRow}>
                          <View style={styles.securityCopy}>
                            <Text style={styles.securityTitle}>{setting.label}</Text>
                            <Text style={styles.securityMeta}>{setting.description}</Text>
                          </View>
                          <MonoButton
                            dark={Boolean(value)}
                            label={label}
                            onPress={() => toggleSecurityFlag(setting.key)}
                          />
                        </View>
                      );
                    })}
                  </View>
                </SectionPanel>

                <SectionPanel
                  title="Subscription exemption"
                  subtitle="Only one business-owner account can bypass subscription payment."
                >
                  <View style={styles.recordStack}>
                    <View style={styles.recordCard}>
                      <Text style={styles.recordTitle}>Exempt account email</Text>
                      <Text style={styles.recordMeta}>
                        {securitySettings.subscriptionExemptAccountEmail
                          ? `${securitySettings.subscriptionExemptAccountEmail} is currently exempt.`
                          : 'No account is currently exempt.'}
                      </Text>
                      <View style={styles.customerCareFormGrid}>
                        <TextInput
                          autoCapitalize="none"
                          keyboardType="email-address"
                          onChangeText={setSubscriptionExemptEmailDraft}
                          placeholder="business-owner@email.com"
                          placeholderTextColor="#777777"
                          style={[styles.compactInput, styles.customerCareInput]}
                          value={subscriptionExemptEmailDraft}
                        />
                        <MonoButton
                          dark
                          label="Save exempt account"
                          onPress={() => saveSubscriptionExemptAccount()}
                        />
                        {securitySettings.subscriptionExemptAccountEmail ? (
                          <MonoButton
                            dark={false}
                            label="Clear"
                            onPress={() => {
                              setSubscriptionExemptEmailDraft('');
                              saveSubscriptionExemptAccount('');
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                  </View>
                </SectionPanel>

                <SectionPanel
                  title="Login popup"
                  subtitle="Edit the message users see immediately after signing in."
                >
                  <View style={styles.recordStack}>
                    <TextInput
                      onChangeText={(value) =>
                        setLoginAnnouncementDraft((current) => ({ ...current, title: value }))
                      }
                      placeholder="Popup title"
                      placeholderTextColor="#777777"
                      style={styles.compactInput}
                      value={loginAnnouncementDraft.title}
                    />
                    <TextInput
                      multiline
                      onChangeText={(value) =>
                        setLoginAnnouncementDraft((current) => ({ ...current, body: value }))
                      }
                      placeholder="Popup message"
                      placeholderTextColor="#777777"
                      style={[styles.compactInput, styles.largeInput]}
                      value={loginAnnouncementDraft.body}
                    />
                    <View style={styles.inlineActionRow}>
                      <MonoButton dark label="Save popup" onPress={saveLoginAnnouncement} />
                      <MonoButton
                        dark={securitySettings.loginAnnouncementEnabled}
                        label={securitySettings.loginAnnouncementEnabled ? 'Enabled' : 'Paused'}
                        onPress={() => toggleSecurityFlag('loginAnnouncementEnabled')}
                      />
                    </View>
                  </View>
                </SectionPanel>

                <View style={[styles.dashboardGrid, !isWideLayout && styles.dashboardGridStacked]}>
                  <SectionPanel
                    title="Session policy"
                    subtitle="Adjust numeric security thresholds for local admin rules."
                  >
                    <View style={styles.totalStack}>
                      <View style={styles.securityNumberRow}>
                        <View style={styles.securityCopy}>
                          <Text style={styles.securityTitle}>Session timeout</Text>
                          <Text style={styles.securityMeta}>
                            Current timeout is {securitySettings.sessionTimeoutMinutes} minutes.
                          </Text>
                        </View>
                        <View style={styles.numericControlRow}>
                          <MonoButton
                            dark={false}
                            label="-5"
                            onPress={() =>
                              adjustSecurityNumber('sessionTimeoutMinutes', -5, 5)
                            }
                          />
                          <Text style={styles.numericValue}>
                            {securitySettings.sessionTimeoutMinutes} min
                          </Text>
                          <MonoButton
                            dark
                            label="+5"
                            onPress={() =>
                              adjustSecurityNumber('sessionTimeoutMinutes', 5, 5)
                            }
                          />
                        </View>
                      </View>

                      <View style={styles.securityNumberRow}>
                        <View style={styles.securityCopy}>
                          <Text style={styles.securityTitle}>Max login attempts</Text>
                          <Text style={styles.securityMeta}>
                            Current lockout threshold is {securitySettings.maxLoginAttempts} attempts.
                          </Text>
                        </View>
                        <View style={styles.numericControlRow}>
                          <MonoButton
                            dark={false}
                            label="-1"
                            onPress={() => adjustSecurityNumber('maxLoginAttempts', -1, 1)}
                          />
                          <Text style={styles.numericValue}>
                            {securitySettings.maxLoginAttempts}
                          </Text>
                          <MonoButton
                            dark
                            label="+1"
                            onPress={() => adjustSecurityNumber('maxLoginAttempts', 1, 1)}
                          />
                        </View>
                      </View>
                    </View>
                  </SectionPanel>

                  <SectionPanel
                    title="Audit log"
                    subtitle="Every important admin and system action is captured here."
                  >
                    <View style={styles.recordStack}>
                      {auditLogs.slice(0, 10).map((log) => (
                        <View key={log.id} style={styles.recordCard}>
                          <View style={styles.recordTopRow}>
                            <View style={styles.recordCopy}>
                              <Text style={styles.recordTitle}>{log.action}</Text>
                              <Text style={styles.recordMeta}>{log.actorName}</Text>
                            </View>
                            <View style={styles.recordBadge}>
                              <Text style={styles.recordBadgeText}>{log.actorRole}</Text>
                            </View>
                          </View>
                          <Text style={styles.recordMeta}>{log.details}</Text>
                          <Text style={styles.recordMeta}>{formatDateTime(log.createdAt)}</Text>
                        </View>
                      ))}
                    </View>
                  </SectionPanel>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </View>
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(adminPinPrompt)}
      onRequestClose={closeAdminPinPrompt}
    >
      <View style={styles.mediaModalBackdrop}>
        <View style={styles.adminPinModalCard}>
          <View style={styles.mediaModalHeader}>
            <View style={styles.recordCopy}>
              <Text style={styles.mediaModalTitle}>
                {adminPinPrompt?.title ?? 'Admin PIN'}
              </Text>
              <Text style={styles.recordMeta}>
                {adminPinPrompt?.message ?? 'Enter the owner admin PIN to continue.'}
              </Text>
            </View>
            <Pressable
              onPress={closeAdminPinPrompt}
              style={({ pressed }) => [styles.mediaModalClose, pressed && styles.recordCardPressed]}
            >
              <Ionicons color={colors.text} name="close-outline" size={22} />
            </Pressable>
          </View>
          <TextInput
            keyboardType="numeric"
            maxLength={4}
            onChangeText={(value) => setAdminPinDraft(value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4 digit PIN"
            placeholderTextColor="#8A8A8A"
            secureTextEntry
            style={styles.compactInput}
            value={adminPinDraft}
          />
          <View style={styles.inlineActionRow}>
            <MonoButton dark label="Confirm PIN" onPress={confirmAdminPinPrompt} />
            <MonoButton dark={false} label="Cancel" onPress={closeAdminPinPrompt} />
          </View>
        </View>
      </View>
    </Modal>
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(activeOrderDetails)}
      onRequestClose={() => setActiveOrderDetails(null)}
    >
      <View style={styles.mediaModalBackdrop}>
        <View style={styles.mediaModalCard}>
          <View style={styles.mediaModalHeader}>
            <View style={styles.recordCopy}>
              <Text style={styles.mediaModalTitle}>
                {activeOrderDetails?.id ?? 'Order details'}
              </Text>
              {activeOrderDetails ? (
                <Text style={styles.recordMeta}>
                  {activeOrderDetails.userName} - {formatCurrency(activeOrderDetails.totalAmount)}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => setActiveOrderDetails(null)}
              style={({ pressed }) => [styles.mediaModalClose, pressed && styles.recordCardPressed]}
            >
              <Ionicons color={colors.text} name="close-outline" size={22} />
            </Pressable>
          </View>

          {activeOrderDetails ? (
            <ScrollView
              contentContainerStyle={styles.orderModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.totalStack}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Customer</Text>
                  <Text style={styles.totalValue}>{activeOrderDetails.userName}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Status</Text>
                  <Text style={styles.totalValue}>
                    {getOrderStatusLabel(activeOrderDetails.status)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Payment</Text>
                  <Text style={styles.totalValue}>
                    {getPaymentStatusLabel(activeOrderDetails.paymentStatus)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Delivery</Text>
                  <Text style={styles.totalValue}>{activeOrderDetails.deliveryCluster}</Text>
                </View>
              </View>

              <View style={styles.recordStack}>
                {activeOrderDetails.items.map((item) => (
                  <View key={`${activeOrderDetails.id}-${item.businessId}`} style={styles.recordCard}>
                    <View style={styles.recordTopRow}>
                      <View style={styles.recordCopy}>
                        <Text style={styles.recordTitle}>{item.businessName}</Text>
                        <Text style={styles.recordMeta}>{item.ownerName}</Text>
                      </View>
                      <View style={styles.recordBadge}>
                        <Text style={styles.recordBadgeText}>x{formatNumber(item.quantity)}</Text>
                      </View>
                    </View>
                    <Text style={styles.recordMeta}>
                      Unit {formatCurrency(item.unitPrice)} - Line {formatCurrency(item.lineTotal)}
                    </Text>
                    {item.sku ? <Text style={styles.recordMeta}>SKU {item.sku}</Text> : null}
                  </View>
                ))}
              </View>

              <View style={styles.totalStack}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatCurrency(activeOrderDetails.subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Delivery fee</Text>
                  <Text style={styles.totalValue}>{formatCurrency(activeOrderDetails.deliveryFee)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatCurrency(activeOrderDetails.totalAmount)}</Text>
                </View>
              </View>

              <Text style={styles.recordMeta}>
                Address: {activeOrderDetails.deliveryAddress}
              </Text>
              {activeOrderDetails.note ? (
                <Text style={styles.recordMeta}>Note: {activeOrderDetails.note}</Text>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(activeListingMedia)}
      onRequestClose={() => setActiveListingMedia(null)}
    >
      <View style={styles.mediaModalBackdrop}>
        <View style={styles.mediaModalCard}>
          <View style={styles.mediaModalHeader}>
            <Text style={styles.mediaModalTitle}>
              {activeListingMedia?.label ?? 'Listing media'}
            </Text>
            <Pressable
              onPress={() => setActiveListingMedia(null)}
              style={({ pressed }) => [styles.mediaModalClose, pressed && styles.recordCardPressed]}
            >
              <Ionicons color={colors.text} name="close-outline" size={22} />
            </Pressable>
          </View>
          {activeListingMedia?.type === 'image' ? (
            <Image
              resizeMode="contain"
              source={{ uri: activeListingMedia.url }}
              style={styles.mediaModalImage}
            />
          ) : activeListingMedia && Platform.OS === 'web' ? (
            createElement('video', {
              src: activeListingMedia.url,
              controls: true,
              style: {
                backgroundColor: '#000000',
                borderRadius: 12,
                maxHeight: 520,
                width: '100%',
              },
            })
          ) : activeListingMedia ? (
            <MonoButton
              dark
              label="Open video"
              onPress={() => {
                void Linking.openURL(activeListingMedia.url);
              }}
            />
          ) : null}
        </View>
      </View>
    </Modal>
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    adminShell: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    adminShellStacked: {
      flexDirection: 'column',
    },
    sidebar: {
      width: 248,
      gap: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: '#111111',
      padding: spacing.lg,
      ...shadows.card,
    },
    sidebarStacked: {
      width: '100%',
    },
    brandBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    brandIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: '#2B2B2B',
    },
    brandCopy: {
      gap: 2,
    },
    brandTitle: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    brandText: {
      ...typography.caption,
      color: '#B9B9B9',
    },
    sidebarList: {
      gap: spacing.xs,
    },
    sidebarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    sidebarRowActive: {
      backgroundColor: '#2B2B2B',
    },
    sidebarRowPressed: {
      opacity: 0.9,
    },
    sidebarLabel: {
      ...typography.bodyStrong,
      color: '#B9B9B9',
    },
    sidebarLabelActive: {
      color: colors.white,
    },
    sidebarFooter: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: '#1C1C1C',
      padding: spacing.md,
    },
    sidebarFooterTitle: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    sidebarFooterText: {
      ...typography.caption,
      color: '#B9B9B9',
    },
    mainStage: {
      flex: 1,
      gap: spacing.md,
    },
    topBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#111111',
      padding: spacing.md,
      ...shadows.card,
    },
    searchShell: {
      flex: 1,
      minHeight: 54,
      minWidth: 260,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: '#F3F3F3',
      borderWidth: 1,
      borderColor: '#D6D6D6',
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      flex: 1,
      color: '#111111',
      ...typography.body,
    },
    topActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    content: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    globalSearchPanel: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    globalSearchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    globalSearchItem: {
      flexGrow: 1,
      flexBasis: 220,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    globalSearchSection: {
      ...typography.caption,
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      color: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    heroPanel: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.soft,
    },
    heroHeaderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    heroCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    heroEyebrow: {
      ...typography.eyebrow,
      color: '#111111',
    },
    heroTitle: {
      ...typography.title,
      color: colors.text,
    },
    heroBody: {
      ...typography.body,
      color: colors.textMuted,
      maxWidth: 760,
    },
    heroBadge: {
      minWidth: 180,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: '#F3F3F3',
      borderWidth: 1,
      borderColor: '#D6D6D6',
      padding: spacing.md,
    },
    heroBadgeLabel: {
      ...typography.caption,
      color: '#666666',
    },
    heroBadgeValue: {
      ...typography.subtitle,
      color: colors.text,
    },
    heroBadgeMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    accessCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    accessCardOwner: {
      backgroundColor: '#111111',
    },
    accessCardLimited: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D6D6D6',
    },
    accessText: {
      ...typography.body,
      color: colors.text,
      flex: 1,
    },
    accessTextOwner: {
      color: '#FFFFFF',
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    metricCard: {
      flex: 1,
      minWidth: 180,
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    metricIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: '#111111',
    },
    metricValue: {
      ...typography.section,
      color: colors.text,
    },
    metricLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    dashboardGrid: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    dashboardGridStacked: {
      flexDirection: 'column',
    },
    panel: {
      flex: 1,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    panelHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    panelHeaderCopy: {
      flex: 1,
      gap: 4,
    },
    panelTitle: {
      ...typography.section,
      color: colors.text,
    },
    panelSubtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    panelActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    panelCount: {
      ...typography.bodyStrong,
      color: '#111111',
    },
    miniBars: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
      height: 180,
      paddingTop: spacing.md,
    },
    miniBarTrack: {
      flex: 1,
      justifyContent: 'flex-end',
      borderRadius: radii.pill,
      backgroundColor: '#E7E7E7',
      overflow: 'hidden',
    },
    miniBarFill: {
      width: '100%',
      borderRadius: radii.pill,
    },
    chartOverlayGrid: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radii.lg,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    legendText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    clusterStack: {
      gap: spacing.sm,
    },
    clusterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    clusterLabel: {
      width: 78,
      ...typography.caption,
      color: colors.text,
    },
    clusterBarTrack: {
      flex: 1,
      height: 14,
      borderRadius: radii.pill,
      backgroundColor: '#E7E7E7',
      overflow: 'hidden',
    },
    clusterBarFill: {
      height: '100%',
      borderRadius: radii.pill,
      backgroundColor: '#111111',
    },
    clusterValue: {
      width: 34,
      textAlign: 'right',
      ...typography.caption,
      color: colors.textMuted,
    },
    activityStack: {
      gap: spacing.sm,
    },
    activityRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    activityIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      width: 38,
      borderRadius: 19,
      backgroundColor: '#F3F3F3',
      borderWidth: 1,
      borderColor: '#D6D6D6',
    },
    activityCopy: {
      flex: 1,
      gap: 4,
    },
    activityTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    activityMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    totalStack: {
      gap: spacing.sm,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    filterWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    filterChip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    filterChipActive: {
      borderColor: '#111111',
      backgroundColor: '#111111',
    },
    filterChipPressed: {
      opacity: 0.92,
    },
    filterChipText: {
      ...typography.caption,
      color: colors.text,
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    recordStack: {
      gap: spacing.md,
    },
    recordCard: {
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    recordCardPressed: {
      opacity: 0.92,
    },
    recordTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    recordCopy: {
      flex: 1,
      gap: 4,
    },
    recordTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    recordMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
    },
    recordBadge: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      backgroundColor: '#F3F3F3',
      borderWidth: 1,
      borderColor: '#D6D6D6',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    recordBadgeSuccess: {
      backgroundColor: '#111111',
      borderColor: '#111111',
    },
    recordBadgeText: {
      ...typography.caption,
      color: '#111111',
    },
    recordBadgeTextSuccess: {
      color: '#FFFFFF',
    },
    inlineActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    reorderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    compactInput: {
      minWidth: 120,
      minHeight: 46,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: '#D6D6D6',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: spacing.md,
      color: '#111111',
      ...typography.body,
    },
    customerCareFormGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    customerCareInput: {
      flex: 1,
      minWidth: 180,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    replyInput: {
      flex: 1,
      minWidth: 220,
    },
    largeInput: {
      minHeight: 112,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      textAlignVertical: 'top',
    },
    supportPreviewStack: {
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    supportPreviewBubble: {
      borderRadius: radii.md,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D6D6D6',
      padding: spacing.sm,
    },
    inspectionMediaRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    inspectionMediaCard: {
      width: 132,
      gap: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D6D6D6',
      padding: spacing.xs,
    },
    inspectionImage: {
      height: 86,
      width: '100%',
      borderRadius: radii.sm,
    },
    inspectionMissingMedia: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 86,
      width: '100%',
      gap: 4,
      borderRadius: radii.sm,
      backgroundColor: '#F2F2F2',
      borderWidth: 1,
      borderColor: '#D6D6D6',
    },
    inspectionMissingMediaText: {
      ...typography.caption,
      color: '#777777',
      textAlign: 'center',
    },
    inspectionVideoCard: {
      width: 132,
      minHeight: 118,
      overflow: 'hidden',
      position: 'relative',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D6D6D6',
      padding: spacing.sm,
    },
    inspectionVideoThumbnail: {
      height: 72,
      width: '100%',
      borderRadius: radii.sm,
    },
    inspectionMissingVideo: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 72,
      width: '100%',
      borderRadius: radii.sm,
      backgroundColor: '#F2F2F2',
      borderWidth: 1,
      borderColor: '#D6D6D6',
    },
    inspectionVideoOverlay: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(17, 17, 17, 0.72)',
      position: 'absolute',
      top: spacing.md,
      left: 45,
    },
    inspectionMediaLabel: {
      ...typography.caption,
      color: '#111111',
    },
    mediaModalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.62)',
      padding: spacing.lg,
    },
    mediaModalCard: {
      width: '100%',
      maxWidth: 920,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    adminPinModalCard: {
      width: '100%',
      maxWidth: 460,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    mediaModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    mediaModalTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    mediaModalClose: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      width: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    orderModalContent: {
      gap: spacing.md,
      maxHeight: 620,
      paddingBottom: spacing.sm,
    },
    mediaModalImage: {
      height: 520,
      width: '100%',
      borderRadius: radii.lg,
      backgroundColor: '#111111',
    },
    tableStack: {
      gap: spacing.sm,
    },
    tableRow: {
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
    tableCopy: {
      flex: 1,
      gap: 4,
    },
    tableTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    tableMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    tableValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    securityStack: {
      gap: spacing.sm,
    },
    securityRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    securityCopy: {
      flex: 1,
      gap: 4,
      minWidth: 220,
    },
    securityTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    securityMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    securityNumberRow: {
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    numericControlRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    numericValue: {
      ...typography.bodyStrong,
      color: colors.text,
      minWidth: 80,
      textAlign: 'center',
    },
    actionBlock: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    planGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    planEditorCard: {
      flex: 1,
      minWidth: 280,
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    planEditorHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    planFieldStack: {
      gap: spacing.sm,
    },
    planInput: {
      minHeight: 48,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      ...typography.body,
    },
    planTextarea: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    policyStack: {
      gap: spacing.lg,
    },
    policyBlock: {
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    policyTitle: {
      ...typography.section,
      color: colors.text,
    },
    policySection: {
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    policySectionTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    policyBody: {
      ...typography.body,
      color: colors.textMuted,
    },
    emptyPanelText: {
      ...typography.body,
      color: colors.textMuted,
    },
    monoButton: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    monoButtonDark: {
      backgroundColor: '#111111',
      borderColor: '#111111',
    },
    monoButtonLight: {
      backgroundColor: '#FFFFFF',
      borderColor: '#111111',
    },
    monoButtonText: {
      ...typography.bodyStrong,
    },
    monoButtonTextDark: {
      color: '#FFFFFF',
    },
    monoButtonTextLight: {
      color: '#111111',
    },
    monoButtonDisabled: {
      opacity: 0.45,
    },
    monoButtonPressed: {
      opacity: 0.88,
    },
  });
}
