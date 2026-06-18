import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

import { estates } from '../data/estates';
import { mockBusinesses } from '../data/mockBusinesses';
import {
  defaultSecuritySettings,
  defaultPaymentPlans,
  seededEmailLogs,
  seededAuditLogs,
  seededOrders,
} from '../data/mockOperations';
import type { AppUser } from '../types/auth';
import type {
  AutomatedEmailLog,
  AuditActorRole,
  AuditLog,
  AppNotification,
  Business,
  BusinessProfileFormValues,
  CartEntry,
  CartItem,
  ChatConversation,
  ChatMessage,
  CheckoutPayload,
  DynamicDepositAccount,
  Estate,
  FlutterwaveCheckoutSession,
  ListingType,
  Order,
  OrderProgressSettings,
  OrderStatus,
  OwnerBusinessProfile,
  OwnerBusinessProfileValues,
  PaymentPlan,
  PaymentPlanCycle,
  PaymentStatus,
  SecuritySettings,
  SubscriptionPayment,
  SupportConversation,
  SupportMessage,
  VirtualAccount,
  WithdrawalRequest,
} from '../types/business';
import { buildBusinessMedia, isLocalOnlyMediaUrl } from '../utils/businessMedia';
import { getBusinessStatusLabel, isPublicBusiness } from '../utils/businessState';
import {
  DYNAMIC_DEPOSIT_EXPIRY_MINUTES,
  MINIMUM_ADD_FUNDS_DEPOSIT,
  expirePendingDeposits,
  getDepositStatusLabel,
} from '../utils/deposits';
import { formatCurrency } from '../utils/format';
import { getAccountWalletBalance } from '../utils/wallet';
import {
  createFlutterwaveVirtualAccount,
  createFlutterwaveCheckoutSession,
  createFlutterwaveDynamicDepositAccount,
  deleteBusinessFromSupabase,
  deleteOrderFromSupabase,
  deleteOrderTestingStateFromSupabase,
  deleteSupportConversationFromSupabase,
  fetchMarketplaceSnapshot,
  isSupabaseConfigured,
  saveBusinessToSupabase,
  saveEmailLogToSupabase,
  sendEmailLogThroughSupabaseFunction,
  saveNotificationToSupabase,
  saveOrderToSupabase,
  saveOwnerBusinessProfileToSupabase,
  savePaymentPlanToSupabase,
  saveSecuritySettingsToSupabase,
  saveDynamicDepositAccountToSupabase,
  saveSubscriptionPaymentToSupabase,
  saveVirtualAccountToSupabase,
  saveWithdrawalToSupabase,
  saveSupportMessageToSupabase,
  uploadBusinessMediaToSupabase,
} from '../services/supabaseApi';
import { normalizeOrderStatus } from '../utils/order';
import { usePersistentState } from './usePersistentState';

type BusinessDirectoryContextValue = {
  businesses: Business[];
  estates: Estate[];
  currentEstateId: string;
  cartEntries: CartEntry[];
  cartCount: number;
  cartTotal: number;
  orders: Order[];
  auditLogs: AuditLog[];
  paymentPlans: PaymentPlan[];
  ownerBusinessProfiles: OwnerBusinessProfile[];
  emailLogs: AutomatedEmailLog[];
  subscriptionPayments: SubscriptionPayment[];
  withdrawalRequests: WithdrawalRequest[];
  virtualAccounts: VirtualAccount[];
  dynamicDepositAccounts: DynamicDepositAccount[];
  notifications: AppNotification[];
  securitySettings: SecuritySettings;
  orderProgressSettings: OrderProgressSettings;
  appendAuditLog: (
    actorName: string,
    actorRole: AuditActorRole,
    action: string,
    details: string,
  ) => void;
  appendNotification: (
    entry: Omit<AppNotification, 'id' | 'createdAt' | 'recipientEmail'> & {
      createdAt?: string;
      recipientEmail: string;
    },
  ) => void;
  appendEmailLog: (
    entry: Omit<AutomatedEmailLog, 'id' | 'createdAt' | 'status'> & { status?: 'queued' | 'sent' },
  ) => void;
  updateEmailLogContent: (emailId: string, patch: Pick<AutomatedEmailLog, 'subject' | 'body'>) => void;
  updateNotificationContent: (notificationId: string, patch: Pick<AppNotification, 'title' | 'body'>) => void;
  updatePaymentPlan: (
    cycle: PaymentPlanCycle,
    patch: Pick<PaymentPlan, 'title' | 'amount' | 'description'>,
    actorName?: string,
    actorRole?: AuditActorRole,
    shouldAudit?: boolean,
  ) => void;
  confirmBusinessSubscription: (
    businessId: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  getChatMessages: (businessId: string) => ChatMessage[];
  getChatConversations: () => ChatConversation[];
  sendChatMessage: (businessId: string, senderName: string, text: string) => void;
  getSupportConversation: (user?: AppUser | null) => SupportConversation | undefined;
  getSupportConversations: () => SupportConversation[];
  getNotificationsForUser: (user?: AppUser | null) => AppNotification[];
  isRiverParkVerifiedForUser: (user?: AppUser | null) => boolean;
  markNotificationsRead: (userId: string) => void;
  sendSupportMessage: (
    user: AppUser,
    text: string,
    context?: Pick<SupportMessage, 'contextType' | 'contextId' | 'contextLabel'>,
  ) => void;
  sendSupportReply: (
    conversationId: string,
    actorName: string,
    actorRole: AuditActorRole,
    text: string,
  ) => void;
  deleteSupportConversation: (conversationId: string) => void;
  deleteLatestSupportConversation: () => void;
  setCurrentEstateId: (estateId: string) => void;
  registerBusiness: (
    values: BusinessProfileFormValues,
    owner?: AppUser | null,
  ) => Promise<Business>;
  getOwnerBusinessProfile: (owner?: AppUser | null) => OwnerBusinessProfile | undefined;
  isSubscriptionExemptForUser: (owner?: AppUser | null) => boolean;
  confirmOwnerSubscription: (
    profileId: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  payOwnerSubscriptionWithAccount: (
    owner: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths?: number,
    durationMinutes?: number,
    amountOverride?: number,
  ) => SubscriptionPayment;
  startOwnerSubscriptionFlutterwaveCheckout: (
    owner: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths?: number,
    durationMinutes?: number,
    amountOverride?: number,
  ) => Promise<FlutterwaveCheckoutSession & { payment: SubscriptionPayment }>;
  getWithdrawalsForOwner: (ownerUserId: string) => WithdrawalRequest[];
  getVirtualAccountForOwner: (ownerUserId: string) => VirtualAccount | undefined;
  getDepositAccountsForUser: (userId: string) => DynamicDepositAccount[];
  createDynamicDepositAccount: (
    user: AppUser,
    amount: number,
  ) => Promise<DynamicDepositAccount>;
  startAddFundsFlutterwaveCheckout: (
    user: AppUser,
    amount: number,
    paymentOptions?: string[],
  ) => Promise<FlutterwaveCheckoutSession & { deposit: DynamicDepositAccount }>;
  ensureUserVirtualAccount: (user: AppUser) => Promise<VirtualAccount>;
  verifyOwnerVirtualAccount: (
    owner: AppUser,
    values: {
      kycType: WithdrawalRequest['kycType'];
      kycNumber: string;
      idDocumentUri: string;
      idDocumentName?: string;
    },
  ) => Promise<VirtualAccount>;
  requestWithdrawal: (
    owner: AppUser,
    values: {
      amount: number;
      bankName: string;
      accountNumber: string;
      accountName?: string;
    },
  ) => WithdrawalRequest;
  notifyBusinessOwnerInspection: (owner: AppUser) => void;
  setOwnerRiverParkVerification: (
    ownerUserId: string,
    verified: boolean,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  updateOwnerBusinessProfile: (
    owner: AppUser,
    values: OwnerBusinessProfileValues,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  getBusinessById: (businessId: string) => Business | undefined;
  getOrderById: (orderId: string) => Order | undefined;
  getOrdersForUser: (userId: string) => Order[];
  getOrdersForOwner: (ownerUserId: string, owner?: AppUser | null) => Order[];
  isBusinessOwnedByUser: (business: Business, user?: AppUser | null) => boolean;
  updateBusinessListing: (
    businessId: string,
    values: {
      name: string;
      description: string;
      longDescription: string;
      price?: number;
      stockQuantity?: number;
      reorderLevel?: number;
    },
    owner?: AppUser | null,
  ) => Business;
  getAvailableStock: (businessId: string) => number;
  addToCart: (businessId: string) => void;
  removeFromCart: (businessId: string) => void;
  updateCartQuantity: (businessId: string, quantity: number) => void;
  clearCart: () => void;
  checkoutCart: (payload: CheckoutPayload, customer?: AppUser | null) => Order;
  startCartFlutterwaveCheckout: (
    payload: Omit<CheckoutPayload, 'paymentMethod'>,
    customer?: AppUser | null,
    paymentOptions?: string[],
  ) => Promise<FlutterwaveCheckoutSession & { order: Order }>;
  completeCartFlutterwaveCheckout: (order: Order, customer?: AppUser | null) => Order;
  restockBusinessStock: (
    businessId: string,
    quantity: number,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  updateBusinessReorderLevel: (
    businessId: string,
    reorderLevel: number,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    actorName?: string,
    actorRole?: AuditActorRole,
    progressCode?: string,
    actorUserId?: string,
    actor?: AppUser | null,
  ) => void;
  deleteOrder: (orderId: string, actorName?: string, actorRole?: AuditActorRole) => void;
  updateOrderProgressCode: (
    code: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  clearOrderTestingState: (actorName?: string, actorRole?: AuditActorRole) => void;
  updatePaymentStatus: (
    orderId: string,
    paymentStatus: PaymentStatus,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  updateSecuritySettings: (
    patch: Partial<SecuritySettings>,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  toggleBusinessVerification: (
    businessId: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  deleteBusiness: (businessId: string, actorName?: string, actorRole?: AuditActorRole) => void;
  restoreBusiness: (businessId: string, actorName?: string, actorRole?: AuditActorRole) => void;
};

const BusinessDirectoryContext = createContext<BusinessDirectoryContextValue | null>(null);

type NotificationRecipientLookup = Pick<
  AppNotification,
  'audience' | 'contextId' | 'contextType' | 'userId' | 'userName'
> & {
  recipientEmail?: string;
};

const legacyOwnerLookup: Record<string, string> = {
  'Ada Nwosu': 'owner-ada',
  'Uche Okafor': 'owner-uche',
  'Ifeyinwa Bello': 'owner-ife',
  'Dr. Kareem Hassan': 'owner-kareem',
  'Tunde Daramola': 'owner-demo',
  'Zainab Jibril': 'owner-maple',
  'hello@riverharvest.com': 'owner-ada',
  'orders@bloomcafe.com': 'owner-ada',
  'orders@cedarhome.com': 'owner-uche',
  'care@wellnesthealth.com': 'owner-ife',
  'bookings@drkareem.com': 'owner-kareem',
  'support@swiftfix.com': 'owner-demo',
  'service@sparkelectric.com': 'owner-demo',
  'hello@maplestudio.com': 'owner-maple',
  'shop@maplestudio.com': 'owner-maple',
};

function fallbackImageForListing(listingType: ListingType, category: string) {
  if (listingType === 'product') {
    switch (category) {
      case 'Beauty':
        return 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80';
      case 'Electronics':
        return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80';
      case 'Home Essentials':
        return 'https://images.unsplash.com/photo-1583947582886-f40ec95dd752?auto=format&fit=crop&w=900&q=80';
      default:
        return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80';
    }
  }

  switch (category) {
    case 'Doctor':
      return 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=900&q=80';
    case 'Phone Repair':
      return 'https://images.unsplash.com/photo-1516724562728-afc824a36e84?auto=format&fit=crop&w=900&q=80';
    case 'Hair Stylist':
      return 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80';
    default:
      return 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=900&q=80';
  }
}

function normalizedList(value: string) {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));
}

function supportConversationId(userId: string) {
  return `support-${userId}`;
}

function buildSupportConversations(
  supportThreads: Record<string, SupportMessage[]>,
): SupportConversation[] {
  return Object.entries(supportThreads)
    .map(([conversationId, messages]) => {
      const sortedMessages = [...messages].sort(
        (leftMessage, rightMessage) =>
          new Date(leftMessage.createdAt).getTime() -
          new Date(rightMessage.createdAt).getTime(),
      );
      const firstMessage = sortedMessages[0];
      const lastMessage = sortedMessages[sortedMessages.length - 1];

      if (!firstMessage || !lastMessage) {
        return null;
      }

      return {
        id: conversationId,
        userId: firstMessage.userId,
        userName: firstMessage.userName,
        userRole: firstMessage.userRole,
        messages: sortedMessages,
        lastMessage,
      };
    })
    .filter((conversation): conversation is SupportConversation => Boolean(conversation))
    .sort(
      (leftConversation, rightConversation) =>
        new Date(rightConversation.lastMessage.createdAt).getTime() -
        new Date(leftConversation.lastMessage.createdAt).getTime(),
    );
}

function isVerificationApprovedNotification(notification: AppNotification) {
  const title = notification.title.trim().toLowerCase();
  return title === 'account verified' || title === 'river park verification approved';
}

function isVerificationPendingNotification(notification: AppNotification) {
  const title = notification.title.trim().toLowerCase();
  return title === 'account verification pending' || title === 'river park verification pending';
}

function getVerifiedUserIdsFromNotifications(notifications: AppNotification[]) {
  const latestVerificationByUser = new Map<string, AppNotification>();

  notifications.forEach((notification) => {
    if (
      !isVerificationApprovedNotification(notification) &&
      !isVerificationPendingNotification(notification)
    ) {
      return;
    }

    const previousNotification = latestVerificationByUser.get(notification.userId);
    if (
      !previousNotification ||
      new Date(notification.createdAt).getTime() >
        new Date(previousNotification.createdAt).getTime()
    ) {
      latestVerificationByUser.set(notification.userId, notification);
    }
  });

  return new Set(
    Array.from(latestVerificationByUser.values())
      .filter(isVerificationApprovedNotification)
      .map((notification) => notification.userId),
  );
}

function supportAutoReplyText(userRole: AppUser['role']) {
  return userRole === 'businessOwner'
    ? 'Thanks for reaching UrbanConnect customer care. Please describe the listing, order, payment, or verification issue clearly and be patient. A customer care agent will attend to you shortly. Thank you.'
    : 'Thanks for reaching UrbanConnect customer care. Please mention the problem clearly and be patient. A customer care agent will attend to you shortly. Thank you.';
}

const supportFollowUpText =
  'We did not receive a response within 5 minutes, so this support chat was closed automatically. Start a new message if the issue is still active.';

function slugify(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildBusinessSku(business: Business) {
  return business.sku?.trim() || `UC-${slugify(business.name)}`;
}

function defaultStockQuantity(business: Business, index: number) {
  if (business.listingType !== 'product') {
    return 0;
  }

  return 12 + (index % 5) * 6;
}

function calculateNextBillingAt(cycle: PaymentPlanCycle, referenceDate = new Date()) {
  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() + (cycle === 'weekly' ? 7 : 30));
  return nextDate.toISOString();
}

function normalizeSubscriptionExemptAccountEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function emailMatchesSubscriptionExemption(value: string | undefined, exemptEmail: string) {
  return Boolean(exemptEmail && value?.trim().toLowerCase() === exemptEmail);
}

function withSubscriptionExemptionForBusiness(
  business: Business,
  subscriptionExemptAccountEmail: string,
): Business {
  const exemptEmail = normalizeSubscriptionExemptAccountEmail(subscriptionExemptAccountEmail);

  if (!emailMatchesSubscriptionExemption(business.ownerEmail, exemptEmail)) {
    return business;
  }

  const {
    subscriptionPaidAt: _subscriptionPaidAt,
    subscriptionNextBillingAt: _subscriptionNextBillingAt,
    ...businessWithoutBillingWindow
  } = business;

  return {
    ...businessWithoutBillingWindow,
    subscriptionStatus: 'active',
    verifiedAmount: 0,
    subscriptionItemCount: business.subscriptionItemCount ?? 1,
  };
}

function withSubscriptionExemptionForProfile(
  profile: OwnerBusinessProfile,
  subscriptionExemptAccountEmail: string,
): OwnerBusinessProfile {
  const exemptEmail = normalizeSubscriptionExemptAccountEmail(subscriptionExemptAccountEmail);

  if (
    !emailMatchesSubscriptionExemption(profile.accountEmail, exemptEmail) &&
    !emailMatchesSubscriptionExemption(profile.email, exemptEmail)
  ) {
    return profile;
  }

  const {
    subscriptionPaidAt: _subscriptionPaidAt,
    subscriptionNextBillingAt: _subscriptionNextBillingAt,
    ...profileWithoutBillingWindow
  } = profile;

  return {
    ...profileWithoutBillingWindow,
    subscriptionStatus: 'active',
    verifiedAmount: 0,
    subscriptionItemCount: profile.subscriptionItemCount ?? 1,
  };
}

function withBusinessDefaults(business: Business, index: number): Business {
  const ownerUserId =
    legacyOwnerLookup[business.ownerEmail ?? ''] ?? legacyOwnerLookup[business.ownerName];
  const defaultPlan = defaultPaymentPlans.find(
    (plan) => plan.cycle === (business.subscriptionCycle ?? 'monthly'),
  ) ?? defaultPaymentPlans[0]!;
  const nextBillingAt = business.subscriptionNextBillingAt ?? calculateNextBillingAt(
    business.subscriptionCycle ?? defaultPlan.cycle,
    new Date(business.subscriptionPaidAt ?? business.createdAt),
  );

  return {
    ...business,
    ...(ownerUserId ? { ownerUserId } : {}),
    status: business.status ?? 'active',
    subscriptionCycle: business.subscriptionCycle ?? defaultPlan.cycle,
    subscriptionStatus:
      business.subscriptionStatus === 'active'
        ? 'paid'
        : business.subscriptionStatus ?? 'pending',
    verifiedAmount:
      business.verifiedAmount ??
      (business.subscriptionStatus === 'paid' || business.subscriptionStatus === 'active'
        ? defaultPlan.amount
        : 0),
    ...(business.subscriptionPaidAt ? { subscriptionPaidAt: business.subscriptionPaidAt } : {}),
    subscriptionNextBillingAt: nextBillingAt,
    subscriptionItemCount: business.subscriptionItemCount ?? 1,
    riverParkVerified: business.riverParkVerified ?? true,
    sku: buildBusinessSku(business),
    stockQuantity:
      business.listingType === 'product'
        ? Math.max(0, business.stockQuantity ?? defaultStockQuantity(business, index))
        : 0,
    reorderLevel:
      business.listingType === 'product' ? Math.max(1, business.reorderLevel ?? 5) : 0,
  };
}

function orderStatusLabel(status: OrderStatus) {
  switch (normalizeOrderStatus(status)) {
    case 'placed':
      return 'Order placed';
    case 'packed':
      return 'Packed';
    case 'outForDelivery':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Updated';
  }
}

function canEditSensitiveData(actorRole: AuditActorRole) {
  return actorRole === 'owner';
}

function canVerifyListings(actorRole: AuditActorRole) {
  return actorRole === 'owner' || actorRole === 'customerCare';
}

function canUpdateOrderProgress(actorRole: AuditActorRole) {
  return actorRole === 'owner' || actorRole === 'customerCare';
}

function normalizeOwnerKey(key?: string | null) {
  return key?.trim().toLowerCase();
}

function normalizeIdentityName(value?: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function identityNamesMatch(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeIdentityName(left);
  const normalizedRight = normalizeIdentityName(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

function getUserOwnerKeys(user?: AppUser | null, ownerProfile?: OwnerBusinessProfile) {
  return [
    user?.id,
    user?.email,
    user?.fullName,
    user?.businessName,
    ownerProfile?.accountEmail,
    ownerProfile?.email,
    ownerProfile?.accountName,
    ownerProfile?.ownerName,
  ]
    .map(normalizeOwnerKey)
    .filter((key): key is string => Boolean(key));
}

function getBusinessOwnerKeys(business: Pick<Business, 'ownerUserId' | 'ownerEmail' | 'ownerName'>) {
  return [business.ownerUserId, business.ownerEmail, business.ownerName]
    .map(normalizeOwnerKey)
    .filter((key): key is string => Boolean(key));
}

function isUnlinkedStaticSupermarketListing(
  business: Pick<Business, 'id' | 'ownerUserId' | 'ownerEmail' | 'ownerName'>,
) {
  return (
    business.id.startsWith('static-supermarket-') ||
    business.ownerUserId === 'static-river-park-supermarket' ||
    business.ownerEmail === 'market@urbanconnect.app' ||
    business.ownerName === 'River Park Supermarket'
  );
}

function defaultOrderNote(status: OrderStatus) {
  switch (normalizeOrderStatus(status)) {
    case 'placed':
      return 'The order has been created and is waiting to be packed.';
    case 'packed':
      return 'The items were packed and prepared for dispatch.';
    case 'outForDelivery':
      return 'Dispatch is on the way to the customer address.';
    case 'delivered':
      return 'The order was delivered successfully.';
    case 'cancelled':
      return 'The order was cancelled and inventory was not dispatched.';
    default:
      return 'Order updated.';
  }
}

function buildTimelineEvent(
  orderId: string,
  status: OrderStatus,
  createdAt: string,
  note = defaultOrderNote(status),
) {
  return {
    id: `${orderId}-${status}-${new Date(createdAt).getTime()}`,
    status,
    label: orderStatusLabel(status),
    note,
    createdAt,
  };
}

function mergeNewestById<T extends { id: string; createdAt?: string; updatedAt?: string }>(
  localRecords: T[],
  remoteRecords: T[],
) {
  const merged = new Map<string, T>();

  [...remoteRecords, ...localRecords].forEach((record) => {
    const existing = merged.get(record.id);

    if (!existing) {
      merged.set(record.id, record);
      return;
    }

    const recordTime = new Date(record.updatedAt ?? record.createdAt ?? 0).getTime();
    const existingTime = new Date(existing.updatedAt ?? existing.createdAt ?? 0).getTime();

    if (!Number.isFinite(existingTime) || recordTime >= existingTime) {
      merged.set(record.id, record);
    }
  });

  return Array.from(merged.values()).sort(
    (leftRecord, rightRecord) =>
      new Date(rightRecord.createdAt ?? 0).getTime() -
      new Date(leftRecord.createdAt ?? 0).getTime(),
  );
}

function mergeRemoteOrdersWithRecentLocal(localOrders: Order[], remoteOrders: Order[]) {
  const remoteIds = new Set(remoteOrders.map((order) => order.id));
  const recentLocalWindowMs = 30000;
  const now = Date.now();
  const recentUnsyncedLocalOrders = localOrders.filter((order) => {
    if (remoteIds.has(order.id)) {
      return false;
    }

    const createdAt = new Date(order.createdAt).getTime();
    return Number.isFinite(createdAt) && now - createdAt <= recentLocalWindowMs;
  });

  return mergeNewestById(recentUnsyncedLocalOrders, remoteOrders);
}

export function BusinessDirectoryProvider({ children }: PropsWithChildren) {
  const [rawBusinesses, setBusinesses] = usePersistentState<Business[]>(
    'urbanconnect.businesses.v3',
    mockBusinesses,
  );
  const [deletedBusinessIds, setDeletedBusinessIds] = usePersistentState<string[]>(
    'urbanconnect.deletedBusinessIds.v1',
    [],
  );
  const [cartItems, setCartItems] = usePersistentState<CartItem[]>(
    'urbanconnect.cart.v2',
    [],
  );
  const [chatThreads, setChatThreads] = usePersistentState<Record<string, ChatMessage[]>>(
    'urbanconnect.chats.v2',
    {},
  );
  const [supportThreads, setSupportThreads] = usePersistentState<Record<string, SupportMessage[]>>(
    'urbanconnect.supportChats.v2',
    {},
  );
  const [deletedSupportConversationIds, setDeletedSupportConversationIds] = usePersistentState<
    string[]
  >('urbanconnect.deletedSupportConversationIds.v1', []);
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>(
    'urbanconnect.notifications.v2',
    [],
  );
  const [orders, setOrders] = usePersistentState<Order[]>('urbanconnect.orders.v3', seededOrders);
  const [orderResetAt, setOrderResetAt] = usePersistentState<string>(
    'urbanconnect.orderResetAt.v1',
    '',
  );
  const [orderProgressSettings, setOrderProgressSettings] =
    usePersistentState<OrderProgressSettings>('urbanconnect.orderProgressCode.v1', {
      code: '',
      updatedAt: '',
    });
  const [paymentPlans, setPaymentPlans] = usePersistentState<PaymentPlan[]>(
    'urbanconnect.paymentPlans.v1',
    defaultPaymentPlans,
  );
  const [ownerBusinessProfiles, setOwnerBusinessProfiles] = usePersistentState<
    OwnerBusinessProfile[]
  >('urbanconnect.ownerBusinessProfiles.v2', []);
  const [subscriptionPayments, setSubscriptionPayments] = usePersistentState<
    SubscriptionPayment[]
  >('urbanconnect.subscriptionPayments.v1', []);
  const [withdrawalRequests, setWithdrawalRequests] = usePersistentState<WithdrawalRequest[]>(
    'urbanconnect.withdrawals.v2',
    [],
  );
  const [virtualAccounts, setVirtualAccounts] = usePersistentState<VirtualAccount[]>(
    'urbanconnect.virtualAccounts.v1',
    [],
  );
  const [dynamicDepositAccounts, setDynamicDepositAccounts] = usePersistentState<
    DynamicDepositAccount[]
  >('urbanconnect.dynamicDepositAccounts.v1', []);
  const [emailLogs, setEmailLogs] = usePersistentState<AutomatedEmailLog[]>(
    'urbanconnect.emailLogs.v2',
    seededEmailLogs,
  );
  const emailDeliveryAttemptedAtRef = useRef<Record<string, number>>({});
  const [rawSecuritySettings, setSecuritySettings] = usePersistentState<SecuritySettings>(
    'urbanconnect.security.v1',
    defaultSecuritySettings,
  );
  const securitySettings = useMemo<SecuritySettings>(
    () => ({
      ...defaultSecuritySettings,
      ...rawSecuritySettings,
    }),
    [rawSecuritySettings],
  );
  const [auditLogs, setAuditLogs] = usePersistentState<AuditLog[]>(
    'urbanconnect.audit.v2',
    seededAuditLogs,
  );
  const [currentEstateId, setCurrentEstateId] = usePersistentState<string>(
    'urbanconnect.currentEstateId.v2',
    estates[0]?.id ?? 'river-park',
  );
  const verifiedUserIdsFromNotifications = useMemo(
    () => getVerifiedUserIdsFromNotifications(notifications),
    [notifications],
  );
  const verifiedUserIdsFromProfiles = useMemo(
    () =>
      new Set(
        ownerBusinessProfiles
          .filter((profile) => profile.riverParkVerified)
          .map((profile) => profile.ownerUserId),
      ),
    [ownerBusinessProfiles],
  );
  const businesses = useMemo(
    () =>
      rawBusinesses
        .filter((business) => !isUnlinkedStaticSupermarketListing(business))
        .filter((business) => !deletedBusinessIds.includes(business.id))
        .map((business, index) => {
          const businessWithDefaults = withBusinessDefaults(business, index);
          const businessWithSubscriptionExemption = withSubscriptionExemptionForBusiness(
            businessWithDefaults,
            securitySettings.subscriptionExemptAccountEmail,
          );
          const ownerIsVerified = Boolean(
            businessWithSubscriptionExemption.ownerUserId &&
              (verifiedUserIdsFromNotifications.has(businessWithSubscriptionExemption.ownerUserId) ||
                verifiedUserIdsFromProfiles.has(businessWithSubscriptionExemption.ownerUserId)),
          );

          return ownerIsVerified
            ? { ...businessWithSubscriptionExemption, riverParkVerified: true }
            : businessWithSubscriptionExemption;
        }),
    [
      deletedBusinessIds,
      rawBusinesses,
      securitySettings.subscriptionExemptAccountEmail,
      verifiedUserIdsFromNotifications,
      verifiedUserIdsFromProfiles,
    ],
  );

  useEffect(() => {
    setBusinesses((currentBusinesses) => {
      const nextBusinesses = currentBusinesses.filter(
        (business) => !isUnlinkedStaticSupermarketListing(business),
      );

      return nextBusinesses.length === currentBusinesses.length ? currentBusinesses : nextBusinesses;
    });
  }, [setBusinesses]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let isCancelled = false;

    const loadSnapshot = () => {
      fetchMarketplaceSnapshot()
        .then((snapshot) => {
        if (isCancelled) {
          return;
        }

        setBusinesses((currentBusinesses) => {
          const deletedIds = new Set(deletedBusinessIds);
          const staticBusinesses = mockBusinesses.filter(
            (business) =>
              !deletedIds.has(business.id) && !isUnlinkedStaticSupermarketListing(business),
          );
          const currentById = new Map(
            currentBusinesses.map((business) => [business.id, business] as const),
          );
          const remoteBusinesses = snapshot.businesses
            .filter(
              (business) =>
                !deletedIds.has(business.id) && !isUnlinkedStaticSupermarketListing(business),
            )
            .map((remoteBusiness) => {
              const localBusiness = currentById.get(remoteBusiness.id);

              if (!localBusiness) {
                return remoteBusiness;
              }

              const localUpdatedAt = new Date(
                localBusiness.updatedAt ?? localBusiness.createdAt,
              ).getTime();
              const remoteUpdatedAt = new Date(
                remoteBusiness.updatedAt ?? remoteBusiness.createdAt,
              ).getTime();

              return Number.isFinite(localUpdatedAt) &&
                (!Number.isFinite(remoteUpdatedAt) || localUpdatedAt > remoteUpdatedAt)
                ? localBusiness
                : remoteBusiness;
            });

          return mergeNewestById(staticBusinesses, remoteBusinesses);
        });
        setOrders((currentOrders) => {
          const resetTime = new Date(orderResetAt).getTime();
          const remoteOrders = Number.isFinite(resetTime)
            ? snapshot.orders.filter(
                (order) => new Date(order.createdAt).getTime() > resetTime,
              )
            : snapshot.orders;

          const mergedOrders = mergeRemoteOrdersWithRecentLocal(currentOrders, remoteOrders);
          const mergedOrderIds = new Set(mergedOrders.map((order) => order.id));
          const droppedLocalOrders = currentOrders.filter(
            (order) =>
              !mergedOrderIds.has(order.id) &&
              !order.inventoryRestoredAt &&
              order.status !== 'cancelled' &&
              order.paymentStatus !== 'refunded',
          );

          if (droppedLocalOrders.length > 0) {
            restoreInventoryForOrders(droppedLocalOrders, new Date().toISOString());
          }

          return mergedOrders;
        });
        setOwnerBusinessProfiles((currentProfiles) =>
          mergeNewestById(currentProfiles, snapshot.ownerBusinessProfiles),
        );
        setEmailLogs((currentLogs) => mergeNewestById(currentLogs, snapshot.emailLogs));
        setAuditLogs(snapshot.auditLogs);
        setNotifications((currentNotifications) =>
          mergeNewestById(currentNotifications, snapshot.notifications),
        );
        setSupportThreads(() => {
          const deletedIds = new Set(deletedSupportConversationIds);

          return Object.fromEntries(
            Object.entries(snapshot.supportThreads).filter(
              ([conversationId]) => !deletedIds.has(conversationId),
            ),
          );
        });
        setSubscriptionPayments((currentPayments) =>
          mergeNewestById(currentPayments, snapshot.subscriptionPayments),
        );
        setWithdrawalRequests((currentWithdrawals) =>
          mergeNewestById(currentWithdrawals, snapshot.withdrawalRequests),
        );
        setVirtualAccounts((currentAccounts) =>
          mergeNewestById(currentAccounts, snapshot.virtualAccounts),
        );
        setDynamicDepositAccounts((currentDeposits) =>
          mergeNewestById(currentDeposits, snapshot.dynamicDepositAccounts),
        );

        if (snapshot.paymentPlans.length > 0) {
          setPaymentPlans(snapshot.paymentPlans);
        }

        if (snapshot.securitySettings) {
          setSecuritySettings(snapshot.securitySettings);
        }
      })
      .catch(() => {
        // Local state remains available until the Supabase schema has been loaded.
      });
    };

    loadSnapshot();
    const refreshInterval = setInterval(loadSnapshot, 1000);

    return () => {
      isCancelled = true;
      clearInterval(refreshInterval);
    };
  }, [
    setAuditLogs,
    setBusinesses,
    deletedBusinessIds,
    setEmailLogs,
    deletedSupportConversationIds,
    setNotifications,
    setOrders,
    orderResetAt,
    setOwnerBusinessProfiles,
    setPaymentPlans,
    setSecuritySettings,
    setSupportThreads,
    setSubscriptionPayments,
  ]);

  useEffect(() => {
    const syncExpiredDeposits = () => {
      setDynamicDepositAccounts((currentDeposits) => {
        const { deposits: nextDeposits, expiredDeposits } = expirePendingDeposits(currentDeposits);

        expiredDeposits.forEach((deposit) => {
          if (isSupabaseConfigured) {
            void saveDynamicDepositAccountToSupabase(deposit).catch(() => undefined);
          }
        });

        return expiredDeposits.length > 0 ? nextDeposits : currentDeposits;
      });
    };

    syncExpiredDeposits();
    const expiryInterval = setInterval(syncExpiredDeposits, 30 * 1000);

    return () => clearInterval(expiryInterval);
  }, [setDynamicDepositAccounts]);

  const getPaymentPlanByCycle = (cycle: PaymentPlanCycle) =>
    paymentPlans.find((plan) => plan.cycle === cycle) ?? defaultPaymentPlans[0]!;

  const getOwnerBusinessProfile = (owner?: AppUser | null) => {
    if (!owner) {
      return undefined;
    }

    const matchedProfile = ownerBusinessProfiles.find(
      (profile) =>
        profile.ownerUserId === owner.id ||
        profile.accountEmail === owner.email ||
        profile.accountName === owner.fullName,
    );

    return matchedProfile
      ? withSubscriptionExemptionForProfile(
          matchedProfile,
          securitySettings.subscriptionExemptAccountEmail,
        )
      : undefined;
  };

  const isSubscriptionExemptForUser = (owner?: AppUser | null) => {
    if (!owner || owner.role !== 'businessOwner') {
      return false;
    }

    return emailMatchesSubscriptionExemption(
      owner.email,
      normalizeSubscriptionExemptAccountEmail(securitySettings.subscriptionExemptAccountEmail),
    );
  };

  const getSupportConversations = () => {
    const deletedIds = new Set(deletedSupportConversationIds);
    return buildSupportConversations(supportThreads).filter(
      (conversation) => !deletedIds.has(conversation.id),
    );
  };

  const getSupportConversation = (user?: AppUser | null) => {
    if (!user) {
      return undefined;
    }

    return getSupportConversations().find(
      (conversation) => conversation.id === supportConversationId(user.id),
    );
  };

  const getNotificationsForUser = (user?: AppUser | null) => {
    if (!user) {
      return [];
    }

    return notifications
      .filter((notification) => notification.userId === user.id)
      .sort(
        (leftNotification, rightNotification) =>
          new Date(rightNotification.createdAt).getTime() -
          new Date(leftNotification.createdAt).getTime(),
      );
  };

  const isRiverParkVerifiedForUser = (user?: AppUser | null) => {
    if (!user) {
      return false;
    }

    const ownerProfile = getOwnerBusinessProfile(user);
    const ownerKeys = [
      user.id,
      user.email,
      user.fullName,
      user.businessName,
      ownerProfile?.accountEmail,
      ownerProfile?.email,
      ownerProfile?.accountName,
      ownerProfile?.ownerName,
    ]
      .map((ownerKey) => ownerKey?.trim().toLowerCase())
      .filter((ownerKey): ownerKey is string => Boolean(ownerKey));
    const matchingListing = businesses.find((business) =>
      [business.ownerUserId, business.ownerEmail, business.ownerName]
        .map((ownerKey) => ownerKey?.trim().toLowerCase())
        .some((ownerKey) => Boolean(ownerKey && ownerKeys.includes(ownerKey))),
    );

    return Boolean(
      user.riverParkVerified ||
        ownerProfile?.riverParkVerified ||
        matchingListing?.riverParkVerified ||
        verifiedUserIdsFromNotifications.has(user.id),
    );
  };

  const markNotificationsRead = (userId: string) => {
    const readAt = new Date().toISOString();

    setNotifications((currentNotifications) => {
      const nextNotifications = currentNotifications.map((notification) =>
        notification.userId === userId && !notification.readAt
          ? { ...notification, readAt }
          : notification,
      );

      if (isSupabaseConfigured) {
        nextNotifications
          .filter((notification, index) => {
            const previousNotification = currentNotifications[index];
            return Boolean(
              previousNotification &&
                previousNotification.userId === userId &&
                !previousNotification.readAt &&
                notification.readAt,
            );
          })
          .forEach((notification) => {
            void saveNotificationToSupabase(notification).catch(() => undefined);
          });
      }

      return nextNotifications;
    });
  };

  const canDeliverEmailLog = (log: AutomatedEmailLog) =>
    log.recipientEmail.includes('@') && !log.recipientEmail.endsWith('.urbanconnect.local');

  const sendQueuedEmailLog = (log: AutomatedEmailLog) => {
    if (!isSupabaseConfigured || log.status === 'sent' || !canDeliverEmailLog(log)) {
      return;
    }

    const previousAttemptAt = emailDeliveryAttemptedAtRef.current[log.id] ?? 0;
    const retryCooldownMs = 10 * 60 * 1000;

    if (Date.now() - previousAttemptAt < retryCooldownMs) {
      return;
    }

    emailDeliveryAttemptedAtRef.current[log.id] = Date.now();

    void saveEmailLogToSupabase(log)
      .catch(() => undefined)
      .then(() => sendEmailLogThroughSupabaseFunction(log))
      .then(() => {
        const sentEntry: AutomatedEmailLog = {
          ...log,
          status: 'sent',
          sentAt: new Date().toISOString(),
        };

        setEmailLogs((currentLogs) =>
          currentLogs.map((currentLog) =>
            currentLog.id === sentEntry.id ? sentEntry : currentLog,
          ),
        );

        return saveEmailLogToSupabase(sentEntry);
      })
      .catch(() => undefined);
  };

  const appendEmailLog = (
    entry: Omit<AutomatedEmailLog, 'id' | 'createdAt' | 'status'> & { status?: 'queued' | 'sent' },
  ) => {
    const createdAt = new Date().toISOString();
    const nextEntry: AutomatedEmailLog = {
      id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: entry.status ?? 'queued',
      createdAt,
      ...entry,
      ...(entry.status === 'sent' ? { sentAt: createdAt } : {}),
    };

    setEmailLogs((currentLogs) => {
      const shouldDedupe = Boolean(nextEntry.orderId || nextEntry.businessId);
      const duplicateExists =
        shouldDedupe &&
        currentLogs.some(
          (log) =>
            log.orderId === nextEntry.orderId &&
            log.businessId === nextEntry.businessId &&
            log.recipientType === nextEntry.recipientType &&
            log.recipientEmail === nextEntry.recipientEmail &&
            log.subject === nextEntry.subject &&
            log.body === nextEntry.body,
        );

      if (duplicateExists) {
        return currentLogs;
      }

      sendQueuedEmailLog(nextEntry);

      return [nextEntry, ...currentLogs];
    });
  };

  useEffect(() => {
    emailLogs
      .filter((log) => log.status === 'queued')
      .slice(0, 5)
      .forEach((log) => sendQueuedEmailLog(log));
  }, [emailLogs]);

  const missingEmailForNotification = (notification: NotificationRecipientLookup) => {
    const safeId = notification.userId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    const prefix = notification.audience === 'businessOwner' ? 'business-owner' : 'resident';

    return `${prefix}-${safeId || 'unknown'}@missing-email.urbanconnect.local`.toLowerCase();
  };

  const resolveNotificationRecipientEmail = (notification: NotificationRecipientLookup) => {
    if (notification.recipientEmail) {
      return notification.recipientEmail;
    }

    const previousNotificationWithEmail = notifications.find(
      (currentNotification) =>
        currentNotification.userId === notification.userId &&
        currentNotification.audience === notification.audience &&
        Boolean(currentNotification.recipientEmail),
    );

    if (previousNotificationWithEmail?.recipientEmail) {
      return previousNotificationWithEmail.recipientEmail;
    }

    if (notification.audience === 'resident') {
      const matchingOrder = orders.find(
        (order) => order.userId === notification.userId || order.userName === notification.userName,
      );

      return matchingOrder?.userEmail;
    }

    const matchingProfile = ownerBusinessProfiles.find(
      (profile) =>
        profile.ownerUserId === notification.userId ||
        profile.accountName === notification.userName ||
        profile.ownerName === notification.userName,
    );

    if (matchingProfile?.accountEmail || matchingProfile?.email) {
      return matchingProfile.accountEmail || matchingProfile.email;
    }

    const matchingBusiness = businesses.find(
      (business) =>
        business.ownerUserId === notification.userId ||
        business.ownerName === notification.userName,
    );

    if (matchingBusiness?.ownerEmail || matchingBusiness?.contact.email) {
      return matchingBusiness.ownerEmail || matchingBusiness.contact.email;
    }

    return undefined;
  };

  const resolveRequiredNotificationRecipientEmail = (notification: NotificationRecipientLookup) => {
    return resolveNotificationRecipientEmail(notification) ?? missingEmailForNotification(notification);
  };

  const appendEmailForNotification = (notification: AppNotification) => {
    appendEmailLog({
      ...(notification.contextType === 'order' && notification.contextId
        ? { orderId: notification.contextId }
        : {}),
      ...(notification.contextType === 'listing' && notification.contextId
        ? { businessId: notification.contextId }
        : {}),
      recipientType: notification.audience === 'businessOwner' ? 'owner' : 'buyer',
      recipientName: notification.userName,
      recipientEmail: resolveRequiredNotificationRecipientEmail(notification),
      subject: notification.title,
      body: notification.body,
    });
  };

  const appendNotification = (
    entry: Omit<AppNotification, 'id' | 'createdAt' | 'recipientEmail'> & {
      createdAt?: string;
      recipientEmail: string;
    },
  ) => {
    const createdAt = entry.createdAt ?? new Date().toISOString();
    const shouldDedupe = Boolean(entry.createdAt);
    const nextNotification: AppNotification = {
      id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...entry,
      createdAt,
    };

    setNotifications((currentNotifications) => {
      const duplicateExists = currentNotifications.some(
        (notification) =>
          notification.userId === nextNotification.userId &&
          notification.contextType === nextNotification.contextType &&
          notification.contextId === nextNotification.contextId &&
          notification.title === nextNotification.title &&
          notification.body === nextNotification.body,
      );

      if (shouldDedupe && duplicateExists) {
        return currentNotifications;
      }

      if (isSupabaseConfigured) {
        void saveNotificationToSupabase(nextNotification).catch(() => undefined);
      }

      return [nextNotification, ...currentNotifications];
    });

    appendEmailForNotification(nextNotification);
  };

  useEffect(() => {
    dynamicDepositAccounts
      .filter((deposit) => deposit.status === 'paid')
      .forEach((deposit) => {
        const confirmedAt = deposit.paidAt ?? deposit.updatedAt;
        const title = `Add funds receipt ${deposit.reference}`;
        const body = `${formatCurrency(deposit.amount)} was received by Flutterwave and added to your UrbanConnect account.`;
        const duplicateExists = notifications.some(
          (notification) =>
            notification.userId === deposit.userId &&
            notification.contextType === 'general' &&
            notification.contextId === deposit.id &&
            notification.title === title,
        );

        if (duplicateExists) {
          return;
        }

        appendNotification({
          userId: deposit.userId,
          userName: deposit.userName,
          recipientEmail: deposit.userEmail,
          audience: deposit.userRole,
          title,
          body,
          contextType: 'general',
          contextId: deposit.id,
          createdAt: confirmedAt,
        });
      });
  }, [dynamicDepositAccounts, notifications]);

  const updateEmailLogContent = (
    emailId: string,
    patch: Pick<AutomatedEmailLog, 'subject' | 'body'>,
  ) => {
    setEmailLogs((currentLogs) => {
      const nextLogs = currentLogs.map((log) =>
        log.id === emailId
          ? {
              ...log,
              subject: patch.subject,
              body: patch.body,
            }
          : log,
      );
      const updatedLog = nextLogs.find((log) => log.id === emailId);

      if (updatedLog && isSupabaseConfigured) {
        void saveEmailLogToSupabase(updatedLog).catch(() => undefined);
      }

      return nextLogs;
    });
  };

  const updateNotificationContent = (
    notificationId: string,
    patch: Pick<AppNotification, 'title' | 'body'>,
  ) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              title: patch.title,
              body: patch.body,
            }
          : notification,
      ),
    );
  };

  const sendSupportMessage = (
    user: AppUser,
    text: string,
    context?: Pick<SupportMessage, 'contextType' | 'contextId' | 'contextLabel'>,
  ) => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    const createdAt = new Date().toISOString();
    const conversationId = supportConversationId(user.id);
    setDeletedSupportConversationIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== conversationId),
    );
    const message: SupportMessage = {
      id: `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      senderName: user.fullName,
      senderRole: user.role,
      text: trimmedText,
      ...(context?.contextType ? { contextType: context.contextType } : {}),
      ...(context?.contextId ? { contextId: context.contextId } : {}),
      ...(context?.contextLabel ? { contextLabel: context.contextLabel } : {}),
      createdAt,
    };
    const existingMessages = supportThreads[conversationId] ?? [];
    const shouldSendAutoReply =
      !existingMessages.some((existingMessage) => existingMessage.senderRole === 'system');
    const autoReply: SupportMessage = {
      id: `support-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      senderName: 'UrbanConnect customer care',
      senderRole: 'system',
      text: supportAutoReplyText(user.role),
      ...(context?.contextType ? { contextType: context.contextType } : {}),
      ...(context?.contextId ? { contextId: context.contextId } : {}),
      ...(context?.contextLabel ? { contextLabel: context.contextLabel } : {}),
      createdAt: new Date(Date.now() + 500).toISOString(),
    };
    const nextMessages = shouldSendAutoReply ? [message, autoReply] : [message];

    setSupportThreads((currentThreads) => ({
      ...currentThreads,
      [conversationId]: [...(currentThreads[conversationId] ?? []), ...nextMessages],
    }));

    if (shouldSendAutoReply) {
      appendNotification({
        userId: user.id,
        userName: user.fullName,
        recipientEmail: user.email,
        audience: user.role,
        title: 'Customer care received your message',
        body: autoReply.text,
        contextType: context?.contextType ?? 'general',
        contextId: context?.contextId ?? conversationId,
      });
    }

    if (isSupabaseConfigured) {
      void saveSupportMessageToSupabase(message).catch(() => undefined);
      if (shouldSendAutoReply) {
        void saveSupportMessageToSupabase(autoReply).catch(() => undefined);
      }
    }
  };

  const sendSupportReply = (
    conversationId: string,
    actorName: string,
    actorRole: AuditActorRole,
    text: string,
  ) => {
    const trimmedText = text.trim();
    const existingMessages = supportThreads[conversationId] ?? [];
    const firstMessage = existingMessages[0];

    if (!trimmedText || !firstMessage) {
      return;
    }

    const message: SupportMessage = {
      id: `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      userId: firstMessage.userId,
      userName: firstMessage.userName,
      userRole: firstMessage.userRole,
      senderName: actorName,
      senderRole: actorRole,
      text: trimmedText,
      createdAt: new Date().toISOString(),
    };

    setSupportThreads((currentThreads) => ({
      ...currentThreads,
      [conversationId]: [...(currentThreads[conversationId] ?? []), message],
    }));

    if (isSupabaseConfigured) {
      void saveSupportMessageToSupabase(message).catch(() => undefined);
    }

    const replyRecipientEmail = resolveRequiredNotificationRecipientEmail({
      userId: firstMessage.userId,
      userName: firstMessage.userName,
      audience: firstMessage.userRole,
      contextType: 'general',
      contextId: conversationId,
    });

    appendNotification({
      userId: firstMessage.userId,
      userName: firstMessage.userName,
      recipientEmail: replyRecipientEmail,
      audience: firstMessage.userRole,
      title: 'Customer care replied',
      body: trimmedText,
      contextType: 'general',
      contextId: conversationId,
    });

    setTimeout(() => {
      setSupportThreads((currentThreads) => {
        const currentMessages = currentThreads[conversationId] ?? [];
        const replyIndex = currentMessages.findIndex(
          (currentMessage) => currentMessage.id === message.id,
        );
        const newerUserReplyExists =
          replyIndex >= 0 &&
          currentMessages
            .slice(replyIndex + 1)
            .some(
              (currentMessage) =>
                currentMessage.senderRole === 'resident' ||
                currentMessage.senderRole === 'businessOwner',
            );
        if (newerUserReplyExists) {
          return currentThreads;
        }

        const closedRecipientEmail = resolveRequiredNotificationRecipientEmail({
          userId: firstMessage.userId,
          userName: firstMessage.userName,
          audience: firstMessage.userRole,
          contextType: 'general',
          contextId: conversationId,
        });

        appendNotification({
          userId: firstMessage.userId,
          userName: firstMessage.userName,
          recipientEmail: closedRecipientEmail,
          audience: firstMessage.userRole,
          title: 'Support chat closed',
          body: supportFollowUpText,
          contextType: 'general',
          contextId: conversationId,
        });

        setDeletedSupportConversationIds((currentIds) =>
          currentIds.includes(conversationId) ? currentIds : [...currentIds, conversationId],
        );
        const { [conversationId]: _deletedConversation, ...remainingThreads } = currentThreads;
        if (isSupabaseConfigured) {
          void deleteSupportConversationFromSupabase(conversationId).catch(() => undefined);
        }

        return remainingThreads;
      });
    }, 5 * 60 * 1000);
  };

  const deleteSupportConversation = (conversationId: string) => {
    setDeletedSupportConversationIds((currentIds) =>
      currentIds.includes(conversationId) ? currentIds : [...currentIds, conversationId],
    );

    setSupportThreads((currentThreads) => {
      if (!currentThreads[conversationId]) {
        return currentThreads;
      }

      const { [conversationId]: _deletedConversation, ...remainingThreads } = currentThreads;
      return remainingThreads;
    });

    if (isSupabaseConfigured) {
      void deleteSupportConversationFromSupabase(conversationId).catch(() => undefined);
    }
  };

  const deleteLatestSupportConversation = () => {
    const latestConversation = getSupportConversations()[0];

    if (latestConversation) {
      deleteSupportConversation(latestConversation.id);
    }
  };

  const notifyBusinessOwnerInspection = (owner: AppUser) => {
    if (owner.role !== 'businessOwner') {
      return;
    }

    appendNotification({
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: 'businessOwner',
      title: 'River Park inspection pending',
      body:
        'Customer care will inspect and confirm that you stay in River Park before your business account is fully verified.',
      contextType: 'general',
      contextId: owner.id,
    });

    appendEmailLog({
      recipientType: 'owner',
      recipientName: owner.fullName,
      recipientEmail: owner.email,
      subject: 'UrbanConnect River Park inspection pending',
      body:
        'Your business owner account was created. Customer care will inspect and confirm that you stay in River Park before your business account is fully verified.',
    });
  };

  const queuePurchaseEmails = (order: Order) => {
    const orderItemsByOwner = order.items.reduce<
      Record<
        string,
        {
          ownerKey: string;
          ownerUserId?: string;
          name: string;
          email: string | undefined;
          businesses: string[];
        }
      >
    >((accumulator, item) => {
      const ownerKey = item.ownerUserId ?? item.ownerName;
      const ownerBusiness =
        businesses.find((business) => business.ownerUserId === item.ownerUserId) ??
        businesses.find((business) => business.ownerName === item.ownerName);
      const current = accumulator[ownerKey] ?? {
        ownerKey,
        ...(item.ownerUserId ? { ownerUserId: item.ownerUserId } : {}),
        name: item.ownerName,
        email: ownerBusiness?.contact.email,
        businesses: [],
      };

      current.businesses.push(item.businessName);
      current.email = current.email ?? ownerBusiness?.contact.email;
      accumulator[ownerKey] = current;
      return accumulator;
    }, {});

    Object.values(orderItemsByOwner).forEach((ownerDetails) => {
      if (!ownerDetails.email) {
        return;
      }

      const firstBusiness = order.items.find(
        (item) => (item.ownerUserId ?? item.ownerName) === ownerDetails.ownerKey,
      );

      appendEmailLog({
        orderId: order.id,
        ...(firstBusiness?.businessId ? { businessId: firstBusiness.businessId } : {}),
        recipientType: 'owner',
        recipientName: ownerDetails.name,
        recipientEmail: ownerDetails.email,
        subject: `Order ${order.id} is ready for packing`,
        body: `A buyer has completed payment for ${ownerDetails.businesses.join(', ')}. Please pack the items and wait for customer care pickup.`,
      });
    });

    const buyer = order.userName;
    appendEmailLog({
      orderId: order.id,
      recipientType: 'buyer',
      recipientName: buyer,
      recipientEmail: order.userEmail ?? `${order.userId}@buyers.local`,
      subject: `Order ${order.id} confirmed`,
      body: `Your order has been confirmed. Customer care will handle pickup and delivery next.`,
    });
  };

  const notifySellersForCollection = (order: Order) => {
    const createdAt = new Date().toISOString();
    const sellerGroups = order.items.reduce<
      Record<string, { ownerKey: string; ownerUserId?: string; ownerName: string; itemLines: string[] }>
    >((accumulator, item) => {
      const ownerKey = item.ownerUserId ?? item.ownerName;
      const current = accumulator[ownerKey] ?? {
        ownerKey,
        ...(item.ownerUserId ? { ownerUserId: item.ownerUserId } : {}),
        ownerName: item.ownerName,
        itemLines: [],
      };

      current.itemLines.push(`${item.quantity} x ${item.businessName}`);
      accumulator[ownerKey] = current;
      return accumulator;
    }, {});

    Object.values(sellerGroups).forEach((sellerGroup) => {
      const conversationId = supportConversationId(sellerGroup.ownerUserId ?? sellerGroup.ownerKey);
      const message: SupportMessage = {
        id: `support-order-${order.id}-${sellerGroup.ownerKey}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        conversationId,
        userId: sellerGroup.ownerUserId ?? sellerGroup.ownerKey,
        userName: sellerGroup.ownerName,
        userRole: 'businessOwner',
        senderName: 'UrbanConnect customer care',
        senderRole: 'system',
        text: `Payment confirmed for ${order.id}. Please prepare ${sellerGroup.itemLines.join(', ')} for collection at the support center by customer care.`,
        contextType: 'order',
        contextId: order.id,
        contextLabel: order.id,
        createdAt,
      };

      setSupportThreads((currentThreads) => ({
        ...currentThreads,
        [conversationId]: [...(currentThreads[conversationId] ?? []), message],
      }));

      const sellerNotificationRecipientEmail = resolveRequiredNotificationRecipientEmail({
        userId: sellerGroup.ownerUserId ?? sellerGroup.ownerKey,
        userName: sellerGroup.ownerName,
        audience: 'businessOwner',
        contextType: 'order',
        contextId: order.id,
      });

      appendNotification({
        userId: sellerGroup.ownerUserId ?? sellerGroup.ownerKey,
        userName: sellerGroup.ownerName,
        recipientEmail: sellerNotificationRecipientEmail,
        audience: 'businessOwner',
        title: `Prepare ${order.id}`,
        body: `Payment is confirmed. Prepare ${sellerGroup.itemLines.join(', ')} for customer care collection at the support center.`,
        contextType: 'order',
        contextId: order.id,
        createdAt,
      });
    });
  };

  const notifyBuyerOrderPlaced = (order: Order) => {
    appendNotification({
      userId: order.userId,
      userName: order.userName,
      recipientEmail:
        order.userEmail ??
        resolveRequiredNotificationRecipientEmail({
          userId: order.userId,
          userName: order.userName,
          audience: 'resident',
          contextType: 'order',
          contextId: order.id,
        }),
      audience: 'resident',
      title: `Order ${order.id} placed`,
      body: `Your order was placed and paid immediately from your wallet account. Customer care will verify warehouse arrival before seller earnings become available.`,
      contextType: 'order',
      contextId: order.id,
      createdAt: order.createdAt,
    });
  };

  const notifyBuyerPaymentConfirmed = (order: Order) => {
    appendNotification({
      userId: order.userId,
      userName: order.userName,
      recipientEmail:
        order.userEmail ??
        resolveRequiredNotificationRecipientEmail({
          userId: order.userId,
          userName: order.userName,
          audience: 'resident',
          contextType: 'order',
          contextId: order.id,
        }),
      audience: 'resident',
      title: `Payment confirmed for ${order.id}`,
      body: `Your wallet account payment has been recorded. Sellers are being asked to prepare your items for support center collection.`,
      contextType: 'order',
      contextId: order.id,
    });
  };

  const notifyOrderDelivered = (order: Order) => {
    appendNotification({
      userId: order.userId,
      userName: order.userName,
      recipientEmail:
        order.userEmail ??
        resolveRequiredNotificationRecipientEmail({
          userId: order.userId,
          userName: order.userName,
          audience: 'resident',
          contextType: 'order',
          contextId: order.id,
        }),
      audience: 'resident',
      title: `Delivered ${order.id}`,
      body: 'Customer care marked your order delivered. Thank you for shopping with UrbanConnect.',
      contextType: 'order',
      contextId: order.id,
    });

    appendEmailLog({
      orderId: order.id,
      recipientType: 'buyer',
      recipientName: order.userName,
      recipientEmail: order.userEmail ?? `${order.userId}@buyers.local`,
      subject: `Delivered ${order.id}`,
      body: 'Customer care marked your order delivered. Thank you for shopping with UrbanConnect.',
    });

    const notifiedOwnerKeys = new Set<string>();
    order.items.forEach((item) => {
      const ownerKey = item.ownerUserId ?? item.ownerName;

      if (notifiedOwnerKeys.has(ownerKey)) {
        return;
      }

      notifiedOwnerKeys.add(ownerKey);

      appendNotification({
        userId: ownerKey,
        userName: item.ownerName,
        recipientEmail: resolveRequiredNotificationRecipientEmail({
          userId: ownerKey,
          userName: item.ownerName,
          audience: 'businessOwner',
          contextType: 'order',
          contextId: order.id,
        }),
        audience: 'businessOwner',
        title: `Delivered ${order.id}`,
        body: `Order ${order.id} was delivered. Your earnings from this order are now available for withdrawal.`,
        contextType: 'order',
        contextId: order.id,
      });
    });
  };

  const appendAuditLog = (
    actorName: string,
    actorRole: AuditActorRole,
    action: string,
    details: string,
  ) => {
    const createdAt = new Date().toISOString();

    setAuditLogs((currentLogs) => [
      {
        id: `audit-${Date.now()}-${currentLogs.length + 1}`,
        actorName,
        actorRole,
        action,
        details,
        createdAt,
      },
      ...currentLogs,
    ]);
  };

  const canConfirmPayments = (actorRole: AuditActorRole) =>
    actorRole === 'owner' || actorRole === 'customerCare';

  const updatePaymentPlan = (
    cycle: PaymentPlanCycle,
    patch: Pick<PaymentPlan, 'title' | 'amount' | 'description'>,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
    shouldAudit = true,
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextPlan: PaymentPlan = {
      cycle,
      ...patch,
      updatedAt,
    };

    setPaymentPlans((currentPlans) =>
      currentPlans.some((plan) => plan.cycle === cycle)
        ? currentPlans.map((plan) => (plan.cycle === cycle ? nextPlan : plan))
        : [...currentPlans, nextPlan],
    );

    if (isSupabaseConfigured) {
      void savePaymentPlanToSupabase(nextPlan).catch(() => undefined);
    }

    setOwnerBusinessProfiles((currentProfiles) =>
      currentProfiles.map((profile) => {
        if ((profile.subscriptionCycle ?? 'monthly') !== cycle) {
          return profile;
        }

        const itemCount = Math.max(1, profile.subscriptionItemCount ?? 1);

        return {
          ...profile,
          ...(profile.subscriptionStatus === 'paid' || profile.subscriptionStatus === 'active'
            ? { verifiedAmount: patch.amount * itemCount }
            : {}),
          updatedAt,
        };
      }),
    );

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        if ((business.subscriptionCycle ?? 'monthly') !== cycle) {
          return business;
        }

        const ownerKey = business.ownerUserId ?? business.ownerEmail ?? business.ownerName;
        const itemCount = Math.max(
          1,
          currentBusinesses.filter(
            (currentBusiness) =>
              (currentBusiness.ownerUserId ??
                currentBusiness.ownerEmail ??
                currentBusiness.ownerName) === ownerKey,
          ).length,
        );

        return {
          ...business,
          ...(business.subscriptionStatus === 'paid' || business.subscriptionStatus === 'active'
            ? { verifiedAmount: patch.amount * itemCount }
            : {}),
          updatedAt,
        };
      }),
    );

    if (shouldAudit) {
      appendAuditLog(
        actorName,
        actorRole,
        'Payment plan updated',
        `${cycle} plan updated to ${patch.title} at ${patch.amount}.`,
      );
    }
  };

  const confirmBusinessSubscription = (
    businessId: string,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canConfirmPayments(actorRole)) {
      return;
    }

    const targetBusiness = getBusinessById(businessId);

    if (!targetBusiness) {
      return;
    }

    const ownerKey = targetBusiness.ownerUserId ?? targetBusiness.ownerEmail ?? targetBusiness.ownerName;
    const ownerBusinesses = businesses.filter(
      (business) =>
        (business.ownerUserId ?? business.ownerEmail ?? business.ownerName) === ownerKey,
    );
    const plan = getPaymentPlanByCycle(targetBusiness.subscriptionCycle ?? 'monthly');
    const itemCount = Math.max(1, ownerBusinesses.length);
    const verifiedAmount = plan.amount * itemCount;
    const nextBillingAt = calculateNextBillingAt(plan.cycle, new Date());
    const updatedAt = new Date().toISOString();

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) =>
        (business.ownerUserId ?? business.ownerEmail ?? business.ownerName) === ownerKey
          ? {
              ...business,
              subscriptionCycle: plan.cycle,
              subscriptionStatus: 'paid',
              verified:
                business.riverParkVerified === false
                  ? false
                  : securitySettings.requireManualListingApproval
                    ? business.verified
                    : true,
              verifiedAmount,
              subscriptionPaidAt: updatedAt,
              subscriptionNextBillingAt: nextBillingAt,
              subscriptionItemCount: itemCount,
              updatedAt,
            }
          : business,
      ),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Subscription confirmed',
      `${targetBusiness.name} was activated on the ${plan.title.toLowerCase()} with ${itemCount} item${itemCount > 1 ? 's' : ''}.`,
    );

    if (targetBusiness.ownerEmail) {
      appendEmailLog({
        businessId: targetBusiness.id,
        recipientType: 'owner',
        recipientName: targetBusiness.ownerName,
        recipientEmail: targetBusiness.ownerEmail,
        subject: `${plan.title} confirmed for ${targetBusiness.name}`,
        body: `Your subscription payment has been confirmed. The profile is now live and remains tied to ${itemCount} item${itemCount > 1 ? 's' : ''} until ${formatDateTimeForEmail(nextBillingAt)}.`,
      });
    }
  };

  const confirmOwnerSubscription = (
    profileId: string,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canConfirmPayments(actorRole)) {
      return;
    }

    const targetProfile = ownerBusinessProfiles.find(
      (profile) => profile.id === profileId || profile.ownerUserId === profileId,
    );

    if (!targetProfile) {
      return;
    }

    const plan = getPaymentPlanByCycle(targetProfile.subscriptionCycle ?? 'monthly');
    const ownerBusinesses = businesses.filter(
      (business) =>
        business.ownerUserId === targetProfile.ownerUserId ||
        business.ownerEmail === targetProfile.accountEmail ||
        business.ownerEmail === targetProfile.email ||
        business.ownerName === targetProfile.accountName ||
        business.ownerName === targetProfile.ownerName,
    );
    const itemCount = Math.max(1, ownerBusinesses.length);
    const verifiedAmount = plan.amount * itemCount;
    const updatedAt = new Date().toISOString();
    const nextBillingAt = calculateNextBillingAt(plan.cycle, new Date());

    setOwnerBusinessProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.id === targetProfile.id
          ? {
              ...profile,
              subscriptionCycle: plan.cycle,
              subscriptionStatus: 'paid',
              verifiedAmount,
              subscriptionPaidAt: updatedAt,
              subscriptionNextBillingAt: nextBillingAt,
              subscriptionItemCount: itemCount,
              riverParkVerified: profile.riverParkVerified ?? false,
              updatedAt,
            }
          : profile,
      ),
    );

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) =>
        business.ownerUserId === targetProfile.ownerUserId ||
        business.ownerEmail === targetProfile.accountEmail ||
        business.ownerEmail === targetProfile.email ||
        business.ownerName === targetProfile.accountName ||
        business.ownerName === targetProfile.ownerName
          ? {
              ...business,
              subscriptionCycle: plan.cycle,
              subscriptionStatus: 'paid',
              verified:
                business.riverParkVerified === false
                  ? false
                  : securitySettings.requireManualListingApproval
                    ? business.verified
                    : true,
              verifiedAmount,
              subscriptionPaidAt: updatedAt,
              subscriptionNextBillingAt: nextBillingAt,
              subscriptionItemCount: itemCount,
              updatedAt,
            }
          : business,
      ),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Owner subscription confirmed',
      `${targetProfile.ownerName} was activated on the ${plan.title.toLowerCase()} with ${itemCount} listing${itemCount > 1 ? 's' : ''}.`,
    );

    appendEmailLog({
      recipientType: 'owner',
      recipientName: targetProfile.ownerName,
      recipientEmail: targetProfile.email || targetProfile.accountEmail,
      subject: `${plan.title} confirmed for your River Park profile`,
      body: `Your subscription is active until ${formatDateTimeForEmail(nextBillingAt)} and is tied to ${itemCount} listing${itemCount > 1 ? 's' : ''}.`,
    });
  };

  const payOwnerSubscriptionWithAccount = (
    owner: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths = 1,
    durationMinutes?: number,
    amountOverride?: number,
  ) => {
    const plan = getPaymentPlanByCycle(cycle);
    const ownerListings = businesses.filter(
      (business) =>
        business.ownerUserId === owner.id ||
        business.ownerEmail === owner.email ||
        business.ownerName === owner.fullName,
    );
    const itemCount = Math.max(1, ownerListings.length);
    const hasMinuteDuration = typeof durationMinutes === 'number' && durationMinutes > 0;
    const durationMultiplier = hasMinuteDuration
      ? 1
      : cycle === 'monthly'
        ? Math.max(1, durationMonths)
        : 1;
    const durationLabel = hasMinuteDuration
      ? `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`
      : cycle === 'weekly'
        ? '1 week'
        : `${durationMultiplier} month${durationMultiplier === 1 ? '' : 's'}`;
    const amountPerListing = amountOverride ?? plan.amount * durationMultiplier;
    const amount = amountPerListing * itemCount;
    const createdAt = new Date().toISOString();
    const balance = getAccountWalletBalance(
      owner,
      getOrdersForUser(owner.id),
      subscriptionPayments.filter((payment) => payment.ownerUserId === owner.id),
      dynamicDepositAccounts.filter((deposit) => deposit.userId === owner.id),
    );

    if (amount > balance) {
      throw new Error(
        `Your account balance is ${formatCurrency(balance)}. Add funds before subscribing for ${formatCurrency(amount)}.`,
      );
    }

    const nextBillingDate = new Date(createdAt);

    if (hasMinuteDuration) {
      nextBillingDate.setMinutes(nextBillingDate.getMinutes() + durationMinutes);
    } else {
      nextBillingDate.setDate(
        nextBillingDate.getDate() + (cycle === 'weekly' ? 7 : 30 * durationMultiplier),
      );
    }

    const nextBillingAt = nextBillingDate.toISOString();
    const riverParkVerified = isRiverParkVerifiedForUser(owner);
    const reference = `UC-SUB-${Date.now()}`;
    const payment: SubscriptionPayment = {
      id: reference,
      reference,
      ownerUserId: owner.id,
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      cycle,
      amount,
      currency: 'NGN',
      status: 'paid',
      paidAt: createdAt,
      rawPayload: JSON.stringify({
        method: 'accountBalance',
        durationLabel,
        durationMonths: durationMultiplier,
        ...(hasMinuteDuration ? { durationMinutes } : {}),
        amountPerListing,
      }),
      createdAt,
      updatedAt: createdAt,
    };

    const existingProfile = getOwnerBusinessProfile(owner);
    const nextProfile: OwnerBusinessProfile = {
      ...(existingProfile ?? {}),
      id: existingProfile?.id ?? owner.id,
      ownerUserId: owner.id,
      accountName: owner.fullName,
      accountEmail: owner.email,
      ownerName: existingProfile?.ownerName ?? owner.fullName,
      phone: existingProfile?.phone ?? owner.phoneNumber,
      whatsapp: existingProfile?.whatsapp ?? '',
      email: existingProfile?.email ?? owner.email,
      website: existingProfile?.website ?? '',
      instagram: existingProfile?.instagram ?? '',
      address:
        existingProfile?.address ?? `${owner.businessCluster ?? 'River Park'}, River Park Estate`,
      coverImage: existingProfile?.coverImage ?? '',
      galleryImages: existingProfile?.galleryImages ?? '',
      galleryVideos: existingProfile?.galleryVideos ?? '',
      subscriptionCycle: cycle,
      subscriptionStatus: 'paid',
      verifiedAmount: amount,
      subscriptionPaidAt: createdAt,
      subscriptionNextBillingAt: nextBillingAt,
      subscriptionItemCount: itemCount,
      riverParkVerified,
      updatedAt: createdAt,
    };

    setSubscriptionPayments((currentPayments) => [
      payment,
      ...currentPayments.filter((currentPayment) => currentPayment.reference !== reference),
    ]);
    setOwnerBusinessProfiles((currentProfiles) => {
      const existingIndex = currentProfiles.findIndex(
        (profile) =>
          profile.ownerUserId === owner.id ||
          profile.accountEmail === owner.email ||
          profile.accountName === owner.fullName,
      );

      if (existingIndex === -1) {
        return [nextProfile, ...currentProfiles];
      }

      return currentProfiles.map((profile, index) =>
        index === existingIndex ? nextProfile : profile,
      );
    });
    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        const matchesOwner =
          business.ownerUserId === owner.id ||
          business.ownerEmail === owner.email ||
          business.ownerName === owner.fullName ||
          business.ownerName === owner.businessName;

        if (!matchesOwner) {
          return business;
        }

        const nextBusiness: Business = {
          ...business,
          subscriptionCycle: cycle,
          subscriptionStatus: 'paid',
          verified: riverParkVerified,
          verifiedAmount: amount,
          subscriptionPaidAt: createdAt,
          subscriptionNextBillingAt: nextBillingAt,
          subscriptionItemCount: itemCount,
          riverParkVerified,
          updatedAt: createdAt,
        };

        if (isSupabaseConfigured) {
          void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
        }

        return nextBusiness;
      }),
    );

    if (isSupabaseConfigured) {
      void saveOwnerBusinessProfileToSupabase(nextProfile).catch(() => undefined);
      void saveSubscriptionPaymentToSupabase(payment).catch(() => undefined);
    }

    appendAuditLog(
      owner.fullName,
      'businessOwner',
      'Subscription paid from account',
      `${owner.businessName ?? owner.fullName} paid ${formatCurrency(amount)} for ${durationLabel}.`,
    );
    appendNotification({
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: 'businessOwner',
      title: 'Subscription active',
      body: `Your ${durationLabel} subscription is active until ${formatDateTimeForEmail(nextBillingAt)}.`,
      contextType: 'general',
      contextId: reference,
      createdAt,
    });
    appendEmailLog({
      recipientType: 'owner',
      recipientName: owner.fullName,
      recipientEmail: owner.email,
      subject: `${durationLabel} subscription active`,
      body: `Your UrbanConnect account balance paid ${formatCurrency(amount)}. All listings on this account are active until ${formatDateTimeForEmail(nextBillingAt)}.`,
    });

    return payment;
  };

  const startOwnerSubscriptionFlutterwaveCheckout = async (
    owner: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths = 1,
    durationMinutes?: number,
    amountOverride?: number,
  ) => {
    if (!isSupabaseConfigured) {
      throw new Error('Flutterwave live checkout needs Supabase to be configured.');
    }

    if (owner.role !== 'businessOwner') {
      throw new Error('Only business owners can pay a listing subscription.');
    }

    const plan = getPaymentPlanByCycle(cycle);
    const ownerListings = businesses.filter(
      (business) =>
        business.ownerUserId === owner.id ||
        business.ownerEmail === owner.email ||
        business.ownerName === owner.fullName,
    );
    const itemCount = Math.max(1, ownerListings.length);
    const hasMinuteDuration = typeof durationMinutes === 'number' && durationMinutes > 0;
    const durationMultiplier = hasMinuteDuration
      ? 1
      : cycle === 'monthly'
        ? Math.max(1, durationMonths)
        : 1;
    const durationLabel = hasMinuteDuration
      ? `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`
      : cycle === 'weekly'
        ? '1 week'
        : `${durationMultiplier} month${durationMultiplier === 1 ? '' : 's'}`;
    const amountPerListing = amountOverride ?? plan.amount * durationMultiplier;
    const amount = amountPerListing * itemCount;
    const createdAt = new Date().toISOString();
    const reference = `UC-SUB-${owner.id}-${Date.now()}`;
    const session = await createFlutterwaveCheckoutSession({
      reference,
      amount,
      customerName: owner.businessName ?? owner.fullName,
      customerEmail: owner.email,
      customerPhone: owner.phoneNumber,
      title: 'UrbanConnect business subscription',
      description: `${durationLabel} subscription for ${itemCount} listing${itemCount > 1 ? 's' : ''}.`,
      purpose: 'subscription',
      meta: {
        ownerUserId: owner.id,
        cycle,
        durationLabel,
        durationMonths: durationMultiplier,
        ...(hasMinuteDuration ? { durationMinutes } : {}),
        itemCount,
      },
    });
    const payment: SubscriptionPayment = {
      id: reference,
      reference,
      ownerUserId: owner.id,
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      cycle,
      amount,
      currency: session.currency,
      status: 'pending',
      checkoutUrl: session.checkoutUrl,
      rawPayload: JSON.stringify({
        method: 'flutterwaveCheckout',
        durationLabel,
        durationMonths: durationMultiplier,
        ...(hasMinuteDuration ? { durationMinutes } : {}),
        amountPerListing,
        itemCount,
        checkoutUrl: session.checkoutUrl,
        paymentOptions: session.paymentOptions,
        mode: session.mode,
        providerBody: session.providerBody,
      }),
      createdAt,
      updatedAt: createdAt,
    };

    await saveSubscriptionPaymentToSupabase(payment);
    setSubscriptionPayments((currentPayments) => [
      payment,
      ...currentPayments.filter((currentPayment) => currentPayment.reference !== reference),
    ]);

    appendAuditLog(
      owner.fullName,
      'businessOwner',
      'Flutterwave subscription checkout started',
      `${owner.businessName ?? owner.fullName} started ${formatCurrency(amount)} checkout for ${durationLabel}.`,
    );
    appendNotification({
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: 'businessOwner',
      title: 'Complete Flutterwave subscription',
      body: `Complete ${formatCurrency(amount)} in Flutterwave. Your listings activate after Flutterwave confirms payment.`,
      contextType: 'general',
      contextId: reference,
      createdAt,
    });

    return { ...session, payment };
  };

  const setOwnerRiverParkVerification = (
    ownerUserId: string,
    verified: boolean,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const profile = ownerBusinessProfiles.find((item) => item.ownerUserId === ownerUserId);
    const nextProfile = profile
      ? { ...profile, riverParkVerified: verified, updatedAt }
      : undefined;
    const ownerKeys = [
      ownerUserId,
      profile?.accountEmail,
      profile?.email,
      profile?.accountName,
      profile?.ownerName,
    ]
      .map((ownerKey) => ownerKey?.trim().toLowerCase())
      .filter((ownerKey): ownerKey is string => Boolean(ownerKey));

    setOwnerBusinessProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.ownerUserId === ownerUserId
          ? { ...profile, riverParkVerified: verified, updatedAt }
          : profile,
      ),
    );

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        const matchesOwner = [business.ownerUserId, business.ownerEmail, business.ownerName]
          .map((ownerKey) => ownerKey?.trim().toLowerCase())
          .some((ownerKey) => Boolean(ownerKey && ownerKeys.includes(ownerKey)));

        if (!matchesOwner) {
          return business;
        }

        const nextBusiness = {
          ...business,
          riverParkVerified: verified,
          verified: verified ? business.verified : false,
          updatedAt,
        };

        if (isSupabaseConfigured) {
          void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
        }

        return nextBusiness;
      }),
    );

    if (nextProfile && isSupabaseConfigured) {
      void saveOwnerBusinessProfileToSupabase(nextProfile).catch(() => undefined);
    }

    appendAuditLog(
      actorName,
      actorRole,
      verified ? 'River Park verified' : 'River Park verification revoked',
      `${profile?.ownerName ?? ownerUserId} was marked ${verified ? 'verified' : 'pending'} for River Park residency.`,
    );

    if (profile) {
      appendNotification({
        userId: profile.ownerUserId,
        userName: profile.ownerName,
        recipientEmail: profile.accountEmail || profile.email,
        audience: 'businessOwner',
        title: verified ? 'River Park verification approved' : 'River Park verification pending',
        body: verified
          ? 'Customer care has verified your River Park account. Listing approval and subscription payment are still tracked separately.'
          : 'Your River Park verification has been moved back to pending. Customer care may contact you for inspection.',
        contextType: 'general',
        contextId: profile.ownerUserId,
      });
    }
  };

  function formatDateTimeForEmail(value: string) {
    return new Date(value).toLocaleString();
  }

  const updateBusinessStatus = (
    businessId: string,
    status: 'active' | 'archived',
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return false;
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        if (business.id !== businessId) {
          return business;
        }

        const nextBusiness = {
          ...business,
          status,
          updatedAt: new Date().toISOString(),
        };

        if (isSupabaseConfigured) {
          void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
        }

        return nextBusiness;
      }),
    );

    const business = getBusinessById(businessId);

    if (business) {
      appendAuditLog(
        actorName,
        actorRole,
        status === 'archived' ? 'Listing archived' : 'Listing restored',
        `${business.name} was marked ${getBusinessStatusLabel(status).toLowerCase()}.`,
      );
    }

    return true;
  };

  const registerBusiness = async (values: BusinessProfileFormValues, owner?: AppUser | null) => {
    if (owner?.role === 'businessOwner' && !isRiverParkVerifiedForUser(owner)) {
      throw new Error(
        'Customer care must verify your River Park account before you can create a listing.',
      );
    }

    const listingId = `listing-${Date.now()}`;
    const fallbackImage = values.coverImage || fallbackImageForListing(values.listingType, values.category);
    const media = buildBusinessMedia({
      baseId: listingId,
      coverImage: values.coverImage,
      galleryImages: values.galleryImages,
      galleryVideos: values.galleryVideos,
      fallbackImage,
    });
    const price = values.listingType === 'product' ? Number.parseFloat(values.price) : 0;
    const serviceList = normalizedList(values.services);
    const stockQuantity = Number.parseInt(values.stockQuantity, 10);
    const reorderLevel = Number.parseInt(values.reorderLevel, 10);
    const ownerProfile = owner ? getOwnerBusinessProfile(owner) : undefined;
    const subscriptionCycle = ownerProfile?.subscriptionCycle ?? 'monthly';
    const selectedPlan = getPaymentPlanByCycle(subscriptionCycle);
    const subscriptionExempt = owner ? isSubscriptionExemptForUser(owner) : false;
    const subscriptionIsActive =
      subscriptionExempt ||
      (ownerProfile?.subscriptionStatus === 'paid' || ownerProfile?.subscriptionStatus === 'active') &&
        (!ownerProfile.subscriptionNextBillingAt ||
          new Date(ownerProfile.subscriptionNextBillingAt).getTime() > Date.now());
    const riverParkVerified = isRiverParkVerifiedForUser(owner);
    const submittedAt = new Date().toISOString();

    const business: Business = {
      id: listingId,
      estateId: values.estateId,
      listingType: values.listingType,
      status: 'active',
      subscriptionCycle,
      subscriptionStatus: subscriptionExempt ? 'active' : subscriptionIsActive ? 'paid' : 'pending',
      verifiedAmount: subscriptionExempt
        ? 0
        : subscriptionIsActive
          ? ownerProfile?.verifiedAmount ?? selectedPlan.amount
          : 0,
      subscriptionItemCount: ownerProfile?.subscriptionItemCount ?? 1,
      ...(ownerProfile?.subscriptionPaidAt
        ? { subscriptionPaidAt: ownerProfile.subscriptionPaidAt }
        : {}),
      ...(ownerProfile?.subscriptionNextBillingAt
        ? { subscriptionNextBillingAt: ownerProfile.subscriptionNextBillingAt }
        : {}),
      name: values.businessName.trim(),
      ownerName: values.ownerName.trim(),
      ...(owner ? { ownerUserId: owner.id } : {}),
      ownerEmail: values.email.trim().toLowerCase(),
      cluster: values.cluster,
      category: values.category,
      description: values.shortDescription.trim(),
      longDescription: values.longDescription.trim(),
      imageUrl: media[0]?.url ?? fallbackImage,
      media,
      address: values.address.trim(),
      sku: `UC-${slugify(values.businessName)}`,
      stockQuantity:
        values.listingType === 'product' && Number.isFinite(stockQuantity)
          ? Math.max(0, stockQuantity)
          : 0,
      reorderLevel:
        values.listingType === 'product' && Number.isFinite(reorderLevel)
          ? Math.max(1, reorderLevel)
          : 0,
      price: Number.isFinite(price) ? price : 0,
      priceLabel: values.listingType === 'product' ? 'Price' : 'Discuss in chat',
      responseTime: values.listingType === 'product' ? 'Delivered today' : 'Chat to discuss',
      verified:
        riverParkVerified && subscriptionIsActive && !securitySettings.requireManualListingApproval,
      riverParkVerified,
      services:
        serviceList.length > 0
          ? serviceList
          : values.listingType === 'product'
            ? ['Fast pickup']
            : ['On-demand support'],
      tags: ['New listing', values.category, values.cluster],
      contact: {
        phone: values.phone.trim(),
        email: values.email.trim().toLowerCase(),
        ...(values.whatsapp.trim() ? { whatsapp: values.whatsapp.trim() } : {}),
        ...(values.website.trim() ? { website: values.website.trim() } : {}),
        ...(values.instagram.trim() ? { instagram: values.instagram.trim() } : {}),
      },
      createdAt: submittedAt,
    };

    const businessForSave = isSupabaseConfigured
      ? await uploadBusinessMediaToSupabase(business)
      : business;

    if (
      isSupabaseConfigured &&
      (isLocalOnlyMediaUrl(businessForSave.imageUrl) ||
        businessForSave.media.some(
          (item) =>
            isLocalOnlyMediaUrl(item.url) ||
            Boolean(item.thumbnailUrl && isLocalOnlyMediaUrl(item.thumbnailUrl)),
        ))
    ) {
      throw new Error(
        'Listing media is still local to this device. Run the Supabase Storage setup SQL, reload the app, and reselect the photos/videos.',
      );
    }

    if (isSupabaseConfigured) {
      await saveBusinessToSupabase(businessForSave);
    }
    setBusinesses((currentBusinesses) => [businessForSave, ...currentBusinesses]);
    setCurrentEstateId(values.estateId);
    appendAuditLog(
      owner?.fullName ?? business.ownerName,
      owner ? 'owner' : 'system',
      'Listing created',
      `${businessForSave.name} was submitted as a ${businessForSave.listingType} listing in ${businessForSave.cluster}.`,
    );

    appendEmailLog({
      businessId: businessForSave.id,
      recipientType: 'owner',
      recipientName: businessForSave.ownerName,
      recipientEmail: businessForSave.ownerEmail ?? values.email.trim().toLowerCase(),
      subject: `River Park verification started for ${businessForSave.name}`,
      body: subscriptionIsActive
        ? `We received your listing. Customer care will inspect the media, category, and River Park details before it appears publicly.`
        : `We received your listing. Pay your ${selectedPlan.title.toLowerCase()} from the Subscription page so customer care can activate the business.`,
    });

    return businessForSave;
  };

  const updateOwnerBusinessProfile = (
    owner: AppUser,
    values: OwnerBusinessProfileValues,
    actorName = owner.fullName,
    actorRole: AuditActorRole = 'owner',
  ) => {
    const ownerKeys = [owner.id, owner.email, owner.fullName, owner.businessName].filter(
      (ownerKey): ownerKey is string => Boolean(ownerKey),
    );
    const profileEmail = values.email.trim().toLowerCase();
    const updatedAt = new Date().toISOString();
    const existingProfile = getOwnerBusinessProfile(owner);
    const nextProfile: OwnerBusinessProfile = {
      ...(existingProfile ?? {}),
      id: existingProfile?.id ?? owner.id,
      ownerUserId: owner.id,
      accountName: owner.fullName,
      accountEmail: owner.email,
      ownerName: values.ownerName.trim() || owner.fullName,
      phone: values.phone.trim() || owner.phoneNumber,
      whatsapp: values.whatsapp.trim(),
      email: profileEmail || owner.email,
      website: values.website.trim(),
      instagram: values.instagram.trim(),
      address: values.address.trim() || `${owner.businessCluster ?? 'River Park'}, River Park Estate`,
      coverImage: values.coverImage.trim(),
      galleryImages: values.galleryImages.trim(),
      galleryVideos: values.galleryVideos.trim(),
      riverParkVerified: existingProfile?.riverParkVerified ?? owner.riverParkVerified ?? false,
      updatedAt,
    };

    setOwnerBusinessProfiles((currentProfiles) => {
      const existingIndex = currentProfiles.findIndex(
        (profile) =>
          profile.ownerUserId === owner.id ||
          profile.accountEmail === owner.email ||
          profile.accountName === owner.fullName,
      );

      if (existingIndex === -1) {
        return [nextProfile, ...currentProfiles];
      }

      return currentProfiles.map((profile, index) =>
        index === existingIndex ? nextProfile : profile,
      );
    });

    if (isSupabaseConfigured) {
      void saveOwnerBusinessProfileToSupabase(nextProfile).catch(() => undefined);
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        const matchesOwner = ownerKeys.some(
          (ownerKey) =>
            ownerKey === business.ownerUserId ||
            ownerKey === business.ownerEmail ||
            ownerKey === business.ownerName,
        );

        if (!matchesOwner) {
          return business;
        }

        const hasMediaChanges =
          nextProfile.coverImage || nextProfile.galleryImages || nextProfile.galleryVideos;
        const media = hasMediaChanges
          ? buildBusinessMedia({
              baseId: business.id,
              coverImage: nextProfile.coverImage,
              galleryImages: nextProfile.galleryImages,
              galleryVideos: nextProfile.galleryVideos,
              fallbackImage:
                business.imageUrl || fallbackImageForListing(business.listingType, business.category),
            })
          : business.media;

        const nextOwnerEmail = nextProfile.email || business.ownerEmail;

        const nextBusiness = {
          ...business,
          ownerName: nextProfile.ownerName || business.ownerName,
          riverParkVerified: nextProfile.riverParkVerified ?? false,
          ...(nextOwnerEmail ? { ownerEmail: nextOwnerEmail } : {}),
          imageUrl: media[0]?.url ?? business.imageUrl,
          media,
          address: nextProfile.address || business.address,
          contact: {
            phone: nextProfile.phone || business.contact.phone,
            email: nextProfile.email || business.contact.email,
            ...(nextProfile.whatsapp ? { whatsapp: nextProfile.whatsapp } : {}),
            ...(nextProfile.website ? { website: nextProfile.website } : {}),
            ...(nextProfile.instagram ? { instagram: nextProfile.instagram } : {}),
          },
          updatedAt,
        };

        if (isSupabaseConfigured) {
          void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
        }

        return nextBusiness;
      }),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Business profile updated',
      `${owner.businessName ?? owner.fullName} updated profile contact and media.`,
    );
  };

  const getBusinessById = (businessId: string) =>
    businesses.find((business) => business.id === businessId);

  const getOrderById = (orderId: string) => orders.find((order) => order.id === orderId);

  const getOrdersForUser = (userId: string) =>
    orders
      .filter((order) => order.userId === userId)
      .sort(
        (leftOrder, rightOrder) =>
          new Date(rightOrder.createdAt).getTime() - new Date(leftOrder.createdAt).getTime(),
      );

  const getOrdersForOwner = (ownerUserId: string, owner?: AppUser | null) => {
    const ownerProfile = ownerBusinessProfiles.find(
      (profile) => profile.ownerUserId === ownerUserId || profile.id === ownerUserId,
    );
    const ownerKeys = new Set(
      [normalizeOwnerKey(ownerUserId), ...getUserOwnerKeys(owner, ownerProfile)].filter(
        (key): key is string => Boolean(key),
      ),
    );

    businesses.forEach((business) => {
      const businessOwnerKeys = getBusinessOwnerKeys(business);

      if (businessOwnerKeys.some((key) => ownerKeys.has(key))) {
        businessOwnerKeys.forEach((key) => ownerKeys.add(key));
      }
    });

    return orders
      .filter((order) =>
        order.items.some((item) =>
          [item.ownerUserId, item.ownerName]
            .map(normalizeOwnerKey)
            .some((key) => Boolean(key && ownerKeys.has(key))),
        ),
      )
      .sort(
        (leftOrder, rightOrder) =>
          new Date(rightOrder.createdAt).getTime() - new Date(leftOrder.createdAt).getTime(),
      );
  };

  const isBusinessOwnedByUser = (business: Business, user?: AppUser | null) => {
    if (!user) {
      return false;
    }

    const ownerProfile = getOwnerBusinessProfile(user);
    const ownerKeys = new Set(getUserOwnerKeys(user, ownerProfile));

    return getBusinessOwnerKeys(business).some((key) => ownerKeys.has(key));
  };

  const updateBusinessListing = (
    businessId: string,
    values: {
      name: string;
      description: string;
      longDescription: string;
      price?: number;
      stockQuantity?: number;
      reorderLevel?: number;
    },
    owner?: AppUser | null,
  ) => {
    const business = getBusinessById(businessId);

    if (!business) {
      throw new Error('This listing could not be found.');
    }

    if (!isBusinessOwnedByUser(business, owner)) {
      throw new Error('You can only edit listings that belong to your business account.');
    }

    const name = values.name.trim();
    const description = values.description.trim();
    const longDescription = values.longDescription.trim();

    if (!name) {
      throw new Error('Add the listing name before saving.');
    }

    if (!description) {
      throw new Error('Add the short description before saving.');
    }

    if (!longDescription) {
      throw new Error('Add the detailed description before saving.');
    }

    const isProduct = business.listingType === 'product';
    const productPrice = values.price ?? business.price;
    const productStockQuantity = values.stockQuantity ?? business.stockQuantity ?? 0;
    const productReorderLevel = values.reorderLevel ?? business.reorderLevel ?? 1;

    if (isProduct && (!Number.isFinite(productPrice) || productPrice <= 0)) {
      throw new Error('Add a valid item price before saving.');
    }

    if (
      isProduct &&
      (!Number.isFinite(productStockQuantity) || productStockQuantity < 0)
    ) {
      throw new Error('Add a valid stock quantity before saving.');
    }

    if (
      isProduct &&
      (!Number.isFinite(productReorderLevel) || productReorderLevel <= 0)
    ) {
      throw new Error('Add a valid reorder level before saving.');
    }

    const updatedAt = new Date().toISOString();
    const nextBusiness: Business = {
      ...business,
      name,
      description,
      longDescription,
      ...(isProduct
        ? {
            price: Math.round(productPrice),
            stockQuantity: Math.max(0, Math.floor(productStockQuantity)),
            reorderLevel: Math.max(1, Math.floor(productReorderLevel)),
          }
        : {}),
      updatedAt,
    };

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((currentBusiness) =>
        currentBusiness.id === businessId ? nextBusiness : currentBusiness,
      ),
    );

    if (isSupabaseConfigured) {
      void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
    }

    appendAuditLog(
      owner?.fullName ?? nextBusiness.ownerName,
      owner ? 'businessOwner' : 'system',
      'Listing updated',
      `${nextBusiness.name} listing information was updated.`,
    );

    return nextBusiness;
  };

  const getWithdrawalsForOwner = (ownerUserId: string) =>
    withdrawalRequests
      .filter((withdrawal) => withdrawal.ownerUserId === ownerUserId)
      .sort(
        (leftWithdrawal, rightWithdrawal) =>
          new Date(rightWithdrawal.createdAt).getTime() -
          new Date(leftWithdrawal.createdAt).getTime(),
      );

  const getVirtualAccountForOwner = (ownerUserId: string) =>
    virtualAccounts.find(
      (account) =>
        account.ownerUserId === ownerUserId &&
        (account.status === 'depositReady' || account.status === 'verified'),
    );

  const getDepositAccountsForUser = (userId: string) =>
    dynamicDepositAccounts
      .filter((deposit) => deposit.userId === userId)
      .sort(
        (leftDeposit, rightDeposit) =>
          new Date(rightDeposit.createdAt).getTime() -
          new Date(leftDeposit.createdAt).getTime(),
      );

  const createDynamicDepositAccount = async (accountUser: AppUser, amount: number) => {
    if (!isSupabaseConfigured) {
      throw new Error('Flutterwave deposit account creation needs Supabase to be configured.');
    }

    const roundedAmount = Math.max(0, Math.floor(amount));

    if (roundedAmount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
      throw new Error(
        `Add funds must be higher than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)}.`,
      );
    }

    const deposit = await createFlutterwaveDynamicDepositAccount(accountUser, roundedAmount);

    setDynamicDepositAccounts((currentDeposits) => mergeNewestById(currentDeposits, [deposit]));

    void saveDynamicDepositAccountToSupabase(deposit).catch(() => undefined);

    appendNotification({
      userId: accountUser.id,
      userName: accountUser.fullName,
      recipientEmail: accountUser.email,
      audience: accountUser.role,
      title: 'Deposit account created',
      body: `Transfer ${formatCurrency(deposit.amount)} to ${deposit.bankName} ${deposit.accountNumber} within ${DYNAMIC_DEPOSIT_EXPIRY_MINUTES} minutes. A receipt is sent only after Flutterwave confirms the transfer.`,
      contextType: 'general',
      contextId: deposit.id,
      createdAt: deposit.createdAt,
    });

    appendAuditLog(
      accountUser.fullName,
      'system',
      'Dynamic deposit account created',
      `${accountUser.fullName} generated ${deposit.bankName} ${deposit.accountNumber} for ${formatCurrency(deposit.amount)}. Status: ${getDepositStatusLabel(deposit.status)}.`,
    );

    return deposit;
  };

  const startAddFundsFlutterwaveCheckout = async (
    accountUser: AppUser,
    amount: number,
    paymentOptions?: string[],
  ) => {
    if (!isSupabaseConfigured) {
      throw new Error('Flutterwave live checkout needs Supabase to be configured.');
    }

    const roundedAmount = Math.max(0, Math.floor(amount));

    if (roundedAmount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
      throw new Error(
        `Add funds must be higher than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)}.`,
      );
    }

    const createdAt = new Date().toISOString();
    const reference = `UC-TOPUP-${accountUser.id}-${Date.now()}`;
    const session = await createFlutterwaveCheckoutSession({
      reference,
      amount: roundedAmount,
      customerName: accountUser.businessName ?? accountUser.fullName,
      customerEmail: accountUser.email,
      customerPhone: accountUser.phoneNumber,
      title: 'UrbanConnect portfolio top-up',
      description: 'Add money to your UrbanConnect portfolio.',
      purpose: 'addFunds',
      ...(paymentOptions ? { paymentOptions } : {}),
      meta: {
        userId: accountUser.id,
        userRole: accountUser.role,
      },
    });
    const deposit: DynamicDepositAccount = {
      id: `deposit-${reference}`,
      reference,
      userId: accountUser.id,
      userName: accountUser.fullName,
      userEmail: accountUser.email,
      userRole: accountUser.role,
      provider: 'flutterwave',
      providerReference: session.reference,
      bankName: 'Flutterwave Checkout',
      accountNumber: session.reference,
      accountName: accountUser.businessName ?? accountUser.fullName,
      amount: session.amount,
      currency: session.currency,
      status: 'pending',
      expiresAt: new Date(
        Date.now() + DYNAMIC_DEPOSIT_EXPIRY_MINUTES * 60 * 1000,
      ).toISOString(),
      rawPayload: JSON.stringify({
        method: 'flutterwaveCheckout',
        checkoutUrl: session.checkoutUrl,
        paymentOptions: session.paymentOptions,
        mode: session.mode,
        providerBody: session.providerBody,
      }),
      createdAt,
      updatedAt: createdAt,
    };

    await saveDynamicDepositAccountToSupabase(deposit);
    setDynamicDepositAccounts((currentDeposits) => mergeNewestById(currentDeposits, [deposit]));

    appendNotification({
      userId: accountUser.id,
      userName: accountUser.fullName,
      recipientEmail: accountUser.email,
      audience: accountUser.role,
      title: 'Flutterwave checkout opened',
      body: `Complete ${formatCurrency(deposit.amount)} in Flutterwave. Your portfolio updates after Flutterwave confirms payment.`,
      contextType: 'general',
      contextId: deposit.id,
      createdAt,
    });

    appendAuditLog(
      accountUser.fullName,
      'system',
      'Flutterwave top-up started',
      `${accountUser.fullName} started Flutterwave checkout for ${formatCurrency(deposit.amount)}.`,
    );

    return { ...session, deposit };
  };

  const saveVirtualAccountRecord = (account: VirtualAccount) => {
    setVirtualAccounts((currentAccounts) =>
      mergeNewestById(
        currentAccounts.filter(
          (currentAccount) => currentAccount.ownerUserId !== account.ownerUserId,
        ),
        [account],
      ),
    );

    if (isSupabaseConfigured) {
      void saveVirtualAccountToSupabase(account).catch(() => undefined);
    }
  };

  const ensureUserVirtualAccount = async (accountUser: AppUser) => {
    const existingAccount = getVirtualAccountForOwner(accountUser.id);

    if (existingAccount) {
      return existingAccount;
    }

    if (!isSupabaseConfigured) {
      throw new Error('Flutterwave account creation needs Supabase to be configured.');
    }

    const account = await createFlutterwaveVirtualAccount(accountUser, {
      purpose: 'deposit',
    });

    saveVirtualAccountRecord(account);

    appendNotification({
      userId: accountUser.id,
      userName: accountUser.fullName,
      recipientEmail: accountUser.email,
      audience: accountUser.role,
      title: 'Deposit account ready',
      body: `Your Flutterwave deposit account is ${account.bankName} ${account.accountNumber}.`,
      contextType: 'general',
      contextId: account.id,
      createdAt: account.createdAt,
    });

    appendAuditLog(
      accountUser.fullName,
      'system',
      'Deposit account created',
      `${account.ownerName} received Flutterwave account ${account.bankName} ${account.accountNumber}.`,
    );

    return account;
  };

  const verifyOwnerVirtualAccount = async (
    owner: AppUser,
    values: {
      kycType: WithdrawalRequest['kycType'];
      kycNumber: string;
      idDocumentUri: string;
      idDocumentName?: string;
    },
  ) => {
    if (owner.role !== 'businessOwner') {
      throw new Error('Only business owners can verify a withdrawal account.');
    }

    const kycNumber = values.kycNumber.replace(/\D/g, '');

    if (kycNumber.length !== 11) {
      throw new Error('Enter an 11-digit BVN or NIN for Flutterwave verification.');
    }

    if (!values.idDocumentUri.trim()) {
      throw new Error('Upload your government ID before Flutterwave verification.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Flutterwave verification needs Supabase to be configured.');
    }

    const account = await createFlutterwaveVirtualAccount(owner, {
      kycType: values.kycType,
      kycNumber,
      purpose: 'withdrawal',
    });
    const accountWithDocument: VirtualAccount = {
      ...account,
      idDocumentUri: values.idDocumentUri.trim(),
      ...(values.idDocumentName?.trim() ? { idDocumentName: values.idDocumentName.trim() } : {}),
    };

    saveVirtualAccountRecord(accountWithDocument);

    appendNotification({
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: 'businessOwner',
      title: 'Withdrawal account verified',
      body: `Flutterwave verified ${accountWithDocument.kycReference ?? 'your KYC'} with your uploaded ID document.`,
      contextType: 'general',
      contextId: accountWithDocument.id,
      createdAt: accountWithDocument.createdAt,
    });

    appendAuditLog(
      owner.fullName,
      'owner',
      'Withdrawal KYC verified',
      `${accountWithDocument.ownerName} verified ${accountWithDocument.kycReference ?? 'KYC'} with Flutterwave and uploaded ID.`,
    );

    return accountWithDocument;
  };

  const requestWithdrawal = (
    owner: AppUser,
    values: {
      amount: number;
      bankName: string;
      accountNumber: string;
      accountName?: string;
    },
  ) => {
    if (owner.role !== 'businessOwner') {
      throw new Error('Only business owners can withdraw seller earnings.');
    }

    const amount = Math.max(0, Math.floor(values.amount));

    if (amount <= 0) {
      throw new Error('Enter a valid withdrawal amount.');
    }

    const bankName = values.bankName.trim();
    const accountNumber = values.accountNumber.replace(/\D/g, '').trim();
    const accountName = values.accountName?.trim() ?? '';

    if (!bankName || !accountNumber || !accountName) {
      throw new Error('Add your bank name, account number, and account name.');
    }

    const virtualAccount = getVirtualAccountForOwner(owner.id);

    if (
      !virtualAccount ||
      virtualAccount.status !== 'verified' ||
      !virtualAccount.kycType ||
      !virtualAccount.kycLast4 ||
      !virtualAccount.kycReference ||
      !virtualAccount.idDocumentUri
    ) {
      throw new Error('Verify your BVN or NIN with Flutterwave and upload your ID before withdrawal.');
    }

    const accountNameMatchesIdentity = [
      virtualAccount.accountName,
      owner.businessName,
      owner.fullName,
    ].some((verifiedName) => identityNamesMatch(accountName, verifiedName));

    if (!accountNameMatchesIdentity) {
      throw new Error(
        `Withdrawal account name must match the verified ${virtualAccount.kycType.toUpperCase()} identity.`,
      );
    }

    const createdAt = new Date().toISOString();
    const withdrawal: WithdrawalRequest = {
      id: `withdrawal-${Date.now()}`,
      ownerUserId: owner.id,
      ownerName: owner.businessName ?? owner.fullName,
      ownerEmail: owner.email,
      bankName,
      accountNumber,
      accountName,
      kycType: virtualAccount.kycType,
      kycLast4: virtualAccount.kycLast4,
      kycReference: virtualAccount.kycReference,
      idDocumentUri: virtualAccount.idDocumentUri,
      ...(virtualAccount.idDocumentName ? { idDocumentName: virtualAccount.idDocumentName } : {}),
      amount,
      status: 'paid',
      createdAt,
    };

    setWithdrawalRequests((currentWithdrawals) => [withdrawal, ...currentWithdrawals]);

    if (isSupabaseConfigured) {
      void saveWithdrawalToSupabase(withdrawal).catch(() => undefined);
    }

    appendNotification({
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: 'businessOwner',
      title: 'Withdrawal paid',
      body: `${formatCurrency(amount)} was withdrawn to ${withdrawal.bankName} ${withdrawal.accountNumber} after ${withdrawal.kycReference} verification.`,
      contextType: 'general',
      contextId: withdrawal.id,
      createdAt,
    });

    appendEmailLog({
      recipientType: 'owner',
      recipientName: owner.fullName,
      recipientEmail: owner.email,
      subject: 'UrbanConnect withdrawal paid',
      body: `${formatCurrency(amount)} was withdrawn to ${withdrawal.bankName} ${withdrawal.accountNumber}. KYC: ${withdrawal.kycReference}.`,
    });

    appendAuditLog(
      owner.fullName,
      'owner',
      'Withdrawal paid',
      `${withdrawal.ownerName} withdrew ${amount} to ${withdrawal.bankName} with ${withdrawal.kycReference}.`,
    );

    return withdrawal;
  };

  const getAvailableStock = (businessId: string) => {
    const business = getBusinessById(businessId);

    if (!business || business.listingType !== 'product' || !isPublicBusiness(business)) {
      return 0;
    }

    return Math.max(0, business.stockQuantity ?? 0);
  };

  const addToCart = (businessId: string) => {
    const business = getBusinessById(businessId);

    if (!business || business.listingType !== 'product' || !isPublicBusiness(business)) {
      return;
    }

    const maxStock = getAvailableStock(businessId);

    if (maxStock <= 0) {
      return;
    }

    setCartItems((currentCartItems) => {
      const existingItem = currentCartItems.find((item) => item.businessId === businessId);

      if (existingItem) {
        if (existingItem.quantity >= maxStock) {
          return currentCartItems;
        }

        return currentCartItems.map((item) =>
          item.businessId === businessId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [{ businessId, quantity: 1 }, ...currentCartItems];
    });
  };

  const removeFromCart = (businessId: string) => {
    setCartItems((currentCartItems) =>
      currentCartItems.filter((item) => item.businessId !== businessId),
    );
  };

  const updateCartQuantity = (businessId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(businessId);
      return;
    }

    const maxStock = getAvailableStock(businessId);

    if (maxStock <= 0) {
      removeFromCart(businessId);
      return;
    }

    setCartItems((currentCartItems) =>
      currentCartItems.map((item) =>
        item.businessId === businessId
          ? { ...item, quantity: Math.min(quantity, maxStock) }
          : item,
      ),
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getChatMessages = (businessId: string) => chatThreads[businessId] ?? [];

  const getChatConversations = () =>
    businesses
      .map((business) => {
        const messages = getChatMessages(business.id);
        const lastMessage = messages[messages.length - 1];

        if (messages.length === 0 || !lastMessage) {
          return null;
        }

        return {
          business,
          messages,
          lastMessage,
        } satisfies ChatConversation;
      })
      .filter((conversation): conversation is ChatConversation => conversation !== null)
      .sort(
        (leftConversation, rightConversation) =>
          new Date(rightConversation.lastMessage.createdAt).getTime() -
          new Date(leftConversation.lastMessage.createdAt).getTime(),
      );

  const sendChatMessage = (businessId: string, senderName: string, text: string) => {
    const trimmedText = text.trim();
    const business = getBusinessById(businessId);

    if (!trimmedText || !business) {
      return;
    }

    const createdAt = new Date().toISOString();
    const customerMessage: ChatMessage = {
      id: `chat-${Date.now()}`,
      businessId,
      senderName,
      senderType: 'resident',
      text: trimmedText,
      createdAt,
    };
    const ownerReply: ChatMessage = {
      id: `chat-owner-${Date.now() + 1}`,
      businessId,
      senderName: business.ownerName,
      senderType: 'owner',
      text: `Thanks for reaching out. ${business.ownerName} will reply shortly.`,
      createdAt: new Date(Date.now() + 1000).toISOString(),
    };

    setChatThreads((currentThreads) => ({
      ...currentThreads,
      [businessId]: [...(currentThreads[businessId] ?? []), customerMessage, ownerReply],
    }));
  };

  const persistPaidOrder = (
    order: Order,
    auditActorName = 'System',
    auditActorRole: AuditActorRole = 'system',
    auditAction = 'Paid order created',
    auditDetails = `${order.userName} paid immediately for ${order.id} worth ${order.totalAmount}.`,
  ) => {
    setOrders((currentOrders) =>
      currentOrders.some((currentOrder) => currentOrder.id === order.id)
        ? currentOrders.map((currentOrder) => (currentOrder.id === order.id ? order : currentOrder))
        : [order, ...currentOrders],
    );

    if (isSupabaseConfigured) {
      void saveOrderToSupabase(order).catch(() => undefined);
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        const orderedQuantity = order.items
          .filter((item) => item.businessId === business.id)
          .reduce((total, item) => total + item.quantity, 0);

        if (orderedQuantity <= 0 || business.listingType !== 'product') {
          return business;
        }

        const nextBusiness = {
          ...business,
          stockQuantity: Math.max(0, (business.stockQuantity ?? 0) - orderedQuantity),
          updatedAt: order.updatedAt,
        };

        if (isSupabaseConfigured) {
          void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
        }

        return nextBusiness;
      }),
    );

    setCartItems([]);
    notifyBuyerOrderPlaced(order);
    queuePurchaseEmails(order);
    notifySellersForCollection(order);
    notifyBuyerPaymentConfirmed(order);
    appendAuditLog(auditActorName, auditActorRole, auditAction, auditDetails);

    return order;
  };

  const checkoutCart = (payload: CheckoutPayload, customer?: AppUser | null) => {
    if (!customer) {
      throw new Error('You need to sign in before placing an order.');
    }

    if (securitySettings.maintenanceMode) {
      throw new Error('Checkout is temporarily paused while the marketplace is in maintenance mode.');
    }

    if (securitySettings.blockCheckout) {
      throw new Error('Checkout has been paused by the owner. Please try again later.');
    }

    if (cartEntries.length === 0) {
      throw new Error('Your cart is empty.');
    }

    const unavailableEntries = cartEntries.filter((entry) => !isPublicBusiness(entry.business));
    const invalidEntries = cartEntries.filter(
      (entry) => entry.quantity > getAvailableStock(entry.business.id),
    );

    if (unavailableEntries.length > 0) {
      throw new Error(
        `${unavailableEntries.map((entry) => entry.business.name).join(', ')} is currently paused or waiting for approval.`,
      );
    }

    if (invalidEntries.length > 0) {
      throw new Error(
        `${invalidEntries.map((entry) => entry.business.name).join(', ')} no longer has enough stock for this order.`,
      );
    }

    const selfOwnedEntries =
      customer.role === 'businessOwner'
        ? cartEntries.filter((entry) => isBusinessOwnedByUser(entry.business, customer))
        : [];

    if (selfOwnedEntries.length > 0) {
      throw new Error(
        `${selfOwnedEntries.map((entry) => entry.business.name).join(', ')} is your own listing. Business owners cannot buy items they sell.`,
      );
    }

    const createdAt = new Date().toISOString();
    const subtotal = cartEntries.reduce((total, entry) => total + entry.lineTotal, 0);
    const serviceFee = 0;
    const deliveryFee = subtotal >= 20000 ? 0 : 2000;
    const totalAmount = subtotal + serviceFee + deliveryFee;
    const walletBalance = getAccountWalletBalance(
      customer,
      getOrdersForUser(customer.id),
      subscriptionPayments.filter((payment) => payment.ownerUserId === customer.id),
      dynamicDepositAccounts.filter((deposit) => deposit.userId === customer.id),
    );

    if (totalAmount > walletBalance) {
      throw new Error(
        `Your portfolio balance is ${formatCurrency(walletBalance)}. Add funds before paying ${formatCurrency(totalAmount)}.`,
      );
    }

    const orderId = `order-${Date.now()}`;
    const order: Order = {
      id: orderId,
      userId: customer.id,
      userEmail: customer.email,
      userName: customer.fullName,
      estateId: customer.estateId,
      deliveryAddress: payload.deliveryAddress.trim(),
      deliveryCluster: payload.deliveryCluster.trim(),
      ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
      items: cartEntries.map((entry) => ({
        businessId: entry.business.id,
        businessName: entry.business.name,
        ownerName: entry.business.ownerName,
        quantity: entry.quantity,
        unitPrice: entry.business.price,
        lineTotal: entry.lineTotal,
        ...(entry.business.ownerUserId ? { ownerUserId: entry.business.ownerUserId } : {}),
        ...(entry.business.sku ? { sku: entry.business.sku } : {}),
      })),
      subtotal,
      serviceFee,
      deliveryFee,
      totalAmount,
      paymentMethod: payload.paymentMethod,
      paymentStatus: 'paid',
      status: 'placed',
      createdAt,
      updatedAt: createdAt,
      expectedDeliveryAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
      timeline: [
        buildTimelineEvent(
          orderId,
          'placed',
          createdAt,
          `Wallet payment was recorded for ${cartEntries.length} cart item${cartEntries.length > 1 ? 's' : ''}.`,
        ),
      ],
    };

    return persistPaidOrder(order);
  };

  const startCartFlutterwaveCheckout = async (
    payload: Omit<CheckoutPayload, 'paymentMethod'>,
    customer?: AppUser | null,
    paymentOptions?: string[],
  ) => {
    if (!customer) {
      throw new Error('You need to sign in before paying.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Flutterwave live checkout needs Supabase to be configured.');
    }

    if (securitySettings.maintenanceMode) {
      throw new Error('Checkout is temporarily paused while the marketplace is in maintenance mode.');
    }

    if (securitySettings.blockCheckout) {
      throw new Error('Checkout has been paused by the owner. Please try again later.');
    }

    if (cartEntries.length === 0) {
      throw new Error('Your cart is empty.');
    }

    const unavailableEntries = cartEntries.filter((entry) => !isPublicBusiness(entry.business));
    const invalidEntries = cartEntries.filter(
      (entry) => entry.quantity > getAvailableStock(entry.business.id),
    );

    if (unavailableEntries.length > 0) {
      throw new Error(
        `${unavailableEntries.map((entry) => entry.business.name).join(', ')} is currently paused or waiting for approval.`,
      );
    }

    if (invalidEntries.length > 0) {
      throw new Error(
        `${invalidEntries.map((entry) => entry.business.name).join(', ')} no longer has enough stock for this order.`,
      );
    }

    const selfOwnedEntries =
      customer.role === 'businessOwner'
        ? cartEntries.filter((entry) => isBusinessOwnedByUser(entry.business, customer))
        : [];

    if (selfOwnedEntries.length > 0) {
      throw new Error(
        `${selfOwnedEntries.map((entry) => entry.business.name).join(', ')} is your own listing. Business owners cannot buy items they sell.`,
      );
    }

    const createdAt = new Date().toISOString();
    const subtotal = cartEntries.reduce((total, entry) => total + entry.lineTotal, 0);
    const serviceFee = 0;
    const deliveryFee = subtotal >= 20000 ? 0 : 2000;
    const totalAmount = subtotal + serviceFee + deliveryFee;
    const orderId = `order-${Date.now()}`;
    const order: Order = {
      id: orderId,
      userId: customer.id,
      userEmail: customer.email,
      userName: customer.fullName,
      estateId: customer.estateId,
      deliveryAddress: payload.deliveryAddress.trim(),
      deliveryCluster: payload.deliveryCluster.trim(),
      ...(payload.note?.trim() ? { note: payload.note.trim() } : {}),
      items: cartEntries.map((entry) => ({
        businessId: entry.business.id,
        businessName: entry.business.name,
        ownerName: entry.business.ownerName,
        quantity: entry.quantity,
        unitPrice: entry.business.price,
        lineTotal: entry.lineTotal,
        ...(entry.business.ownerUserId ? { ownerUserId: entry.business.ownerUserId } : {}),
        ...(entry.business.sku ? { sku: entry.business.sku } : {}),
      })),
      subtotal,
      serviceFee,
      deliveryFee,
      totalAmount,
      paymentMethod: 'flutterwave',
      paymentStatus: 'pending',
      status: 'placed',
      createdAt,
      updatedAt: createdAt,
      expectedDeliveryAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
      timeline: [
        buildTimelineEvent(
          orderId,
          'placed',
          createdAt,
          `Flutterwave checkout opened for ${cartEntries.length} cart item${cartEntries.length > 1 ? 's' : ''}.`,
        ),
      ],
    };
    const session = await createFlutterwaveCheckoutSession({
      reference: order.id,
      amount: totalAmount,
      customerName: customer.fullName,
      customerEmail: customer.email,
      customerPhone: customer.phoneNumber,
      title: 'UrbanConnect order payment',
      description: `Order ${order.id} for ${cartEntries.length} item${cartEntries.length > 1 ? 's' : ''}.`,
      purpose: 'cart',
      ...(paymentOptions ? { paymentOptions } : {}),
      meta: {
        orderId: order.id,
        userId: customer.id,
      },
    });

    appendAuditLog(
      customer.fullName,
      'system',
      'Flutterwave order checkout started',
      `${customer.fullName} started Flutterwave checkout for ${order.id} worth ${order.totalAmount}.`,
    );

    return { ...session, order };
  };

  const completeCartFlutterwaveCheckout = (order: Order, customer?: AppUser | null) => {
    if (!customer) {
      throw new Error('You need to sign in before confirming this payment.');
    }

    if (order.userId !== customer.id) {
      throw new Error('This checkout belongs to another account.');
    }

    const confirmedAt = new Date().toISOString();
    const paidOrder: Order = {
      ...order,
      paymentStatus: 'paid',
      status: 'placed',
      createdAt: confirmedAt,
      updatedAt: confirmedAt,
      timeline: [
        buildTimelineEvent(
          order.id,
          'placed',
          confirmedAt,
          'Flutterwave confirmed the card or bank payment.',
        ),
      ],
    };

    return persistPaidOrder(
      paidOrder,
      customer.fullName,
      'system',
      'Flutterwave order paid',
      `${customer.fullName} paid with Flutterwave for ${paidOrder.id} worth ${paidOrder.totalAmount}.`,
    );
  };

  const toggleBusinessVerification = (
    businessId: string,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canVerifyListings(actorRole)) {
      return;
    }

    const business = getBusinessById(businessId);
    const nextVerified = !business?.verified;
    const updatedAt = new Date().toISOString();

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        if (business.id !== businessId) {
          return business;
        }

        const nextBusiness = {
          ...business,
          status: 'active' as const,
          verified: !business.verified,
          riverParkVerified: !business.verified ? true : business.riverParkVerified ?? false,
          updatedAt,
        };

        if (isSupabaseConfigured) {
          void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
        }

        return nextBusiness;
      }),
    );

    if (business) {
      appendAuditLog(
        actorName,
        actorRole,
        nextVerified ? 'Listing verified' : 'Listing verification revoked',
        `${business.name} was marked ${nextVerified ? 'verified' : 'pending'}.`,
      );

      if (business.ownerUserId) {
        appendNotification({
          userId: business.ownerUserId,
          userName: business.ownerName,
          recipientEmail: business.ownerEmail ?? business.contact.email,
          audience: 'businessOwner',
          title: nextVerified ? 'Listing approved' : 'Listing returned to pending',
          body: nextVerified
            ? `${business.name} has been approved by customer care and can now appear in UrbanConnect.`
            : `${business.name} was moved back to pending. Please contact customer care for more information.`,
          contextType: 'listing',
          contextId: business.id,
        });
      }

      if (business.ownerEmail) {
        appendEmailLog({
          businessId: business.id,
          recipientType: 'owner',
          recipientName: business.ownerName,
          recipientEmail: business.ownerEmail,
          subject: nextVerified
            ? `${business.name} listing approved`
            : `${business.name} listing moved to pending`,
          body: nextVerified
            ? `Customer care approved ${business.name}. It can now appear in UrbanConnect.`
            : `Customer care moved ${business.name} back to pending. Please contact support for next steps.`,
        });
      }
    }
  };

  const restockBusinessStock = (
    businessId: string,
    quantity: number,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    if (quantity <= 0) {
      return;
    }

    const business = getBusinessById(businessId);

    if (!business || !isPublicBusiness(business)) {
      return;
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) =>
        business.id === businessId &&
        business.listingType === 'product' &&
        isPublicBusiness(business)
          ? {
              ...business,
              stockQuantity: Math.max(0, (business.stockQuantity ?? 0) + quantity),
              updatedAt: new Date().toISOString(),
            }
          : business,
      ),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Inventory restocked',
      `${quantity} units were added to ${business.name}.`,
    );
  };

  const updateBusinessReorderLevel = (
    businessId: string,
    reorderLevel: number,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    if (reorderLevel <= 0) {
      return;
    }

    const business = getBusinessById(businessId);

    if (!business || !isPublicBusiness(business)) {
      return;
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) =>
        business.id === businessId &&
        business.listingType === 'product' &&
        isPublicBusiness(business)
          ? {
              ...business,
              reorderLevel,
              updatedAt: new Date().toISOString(),
            }
          : business,
      ),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Reorder level updated',
      `${business.name} reorder level was set to ${reorderLevel}.`,
    );
  };

  const updateOrderProgressCode = (
    code: string,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    const trimmedCode = code.trim();

    if (!/^\d{4}$/.test(trimmedCode)) {
      throw new Error('Admin PIN must be exactly 4 digits.');
    }

    const updatedAt = new Date().toISOString();

    setOrderProgressSettings({
      code: trimmedCode,
      updatedAt,
    });

    appendAuditLog(
      actorName,
      actorRole,
      'Admin PIN updated',
      'The 4 digit admin PIN was changed.',
    );
  };

  const restoreInventoryForOrders = (ordersToRestore: Order[], restoredAt: string) => {
    if (ordersToRestore.length === 0) {
      return;
    }

    const quantitiesByBusinessId = ordersToRestore.reduce<Record<string, number>>(
      (accumulator, order) => {
        order.items.forEach((item) => {
          accumulator[item.businessId] = (accumulator[item.businessId] ?? 0) + item.quantity;
        });
        return accumulator;
      },
      {},
    );

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((business) => {
        const quantity = quantitiesByBusinessId[business.id] ?? 0;

        if (quantity <= 0 || business.listingType !== 'product') {
          return business;
        }

        const nextBusiness = {
          ...business,
          stockQuantity: Math.max(0, (business.stockQuantity ?? 0) + quantity),
          updatedAt: restoredAt,
        };

        if (isSupabaseConfigured) {
          void saveBusinessToSupabase(nextBusiness).catch(() => undefined);
        }

        return nextBusiness;
      }),
    );
  };

  const clearOrderTestingState = (
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    const resetAt = new Date().toISOString();
    const ordersToRestore = orders.filter((order) => !order.inventoryRestoredAt);

    restoreInventoryForOrders(ordersToRestore, resetAt);
    setOrderResetAt(resetAt);
    setOrders([]);
    setCartItems([]);
    setWithdrawalRequests([]);
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.contextType !== 'order'),
    );
    setEmailLogs((currentLogs) => currentLogs.filter((log) => !log.orderId));
    setSupportThreads((currentThreads) =>
      Object.fromEntries(
        Object.entries(currentThreads)
          .map(([conversationId, messages]) => [
            conversationId,
            messages.filter((message) => message.contextType !== 'order'),
          ] as const)
          .filter(([, messages]) => messages.length > 0),
      ),
    );

    if (isSupabaseConfigured) {
      void deleteOrderTestingStateFromSupabase().catch(() => undefined);
    }

    appendAuditLog(
      actorName,
      actorRole,
      'Order testing state cleared',
      'Orders, cart items, seller withdrawals, and order notifications were cleared for fresh testing.',
    );
  };

  const deleteOrder = (
    orderId: string,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    const order = getOrderById(orderId);

    if (!order) {
      return;
    }

    const deletedAt = new Date().toISOString();

    if (!order.inventoryRestoredAt) {
      restoreInventoryForOrders([order], deletedAt);
    }

    setOrders((currentOrders) => currentOrders.filter((currentOrder) => currentOrder.id !== orderId));
    setNotifications((currentNotifications) =>
      currentNotifications.filter(
        (notification) =>
          notification.contextType !== 'order' || notification.contextId !== orderId,
      ),
    );
    setEmailLogs((currentLogs) => currentLogs.filter((log) => log.orderId !== orderId));
    setSupportThreads((currentThreads) =>
      Object.fromEntries(
        Object.entries(currentThreads)
          .map(([conversationId, messages]) => [
            conversationId,
            messages.filter(
              (message) => message.contextType !== 'order' || message.contextId !== orderId,
            ),
          ] as const)
          .filter(([, messages]) => messages.length > 0),
      ),
    );

    if (isSupabaseConfigured) {
      void deleteOrderFromSupabase(orderId).catch(() => undefined);
    }

    appendAuditLog(
      actorName,
      actorRole,
      'Order deleted',
      `${order.id} was deleted and its product quantities were returned to inventory.`,
    );
  };

  const updateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
    progressCode = '',
    actorUserId?: string,
    actor?: AppUser | null,
  ) => {
    if (!canUpdateOrderProgress(actorRole)) {
      return;
    }

    const orderBeforeUpdate = getOrderById(orderId);

    if (!orderBeforeUpdate) {
      return;
    }

    if (!orderProgressSettings.code) {
      throw new Error('Create a 4 digit admin PIN before changing delivery progress.');
    }

    if (progressCode.trim() !== orderProgressSettings.code) {
      throw new Error('Enter the active 4 digit admin PIN before confirming progress.');
    }

    const updatedAt = new Date().toISOString();

    if (status === 'cancelled' && !orderBeforeUpdate.inventoryRestoredAt) {
      restoreInventoryForOrders([orderBeforeUpdate], updatedAt);
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId || order.status === status) {
          return order;
        }

        const nextOrder = {
          ...order,
          status,
          updatedAt,
          ...(status === 'cancelled' ? { inventoryRestoredAt: updatedAt } : {}),
          timeline: [...order.timeline, buildTimelineEvent(orderId, status, updatedAt)],
        };

        if (isSupabaseConfigured) {
          void saveOrderToSupabase(nextOrder).catch(() => undefined);
        }

        return nextOrder;
      }),
    );

    if (orderBeforeUpdate) {
      if (status === 'delivered' && orderBeforeUpdate.status !== 'delivered') {
        notifyOrderDelivered({
          ...orderBeforeUpdate,
          status: 'delivered',
          updatedAt,
        });
      }

      appendAuditLog(
        actorName,
        actorRole,
        'Order status updated',
        `${orderBeforeUpdate.id} moved to ${orderStatusLabel(status).toLowerCase()}.`,
      );
    }
  };

  const updatePaymentStatus = (
    orderId: string,
    paymentStatus: PaymentStatus,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canConfirmPayments(actorRole)) {
      return;
    }

    const orderBeforeUpdate = getOrderById(orderId);

    if (!orderBeforeUpdate) {
      return;
    }

    if (actorRole === 'customerCare' && paymentStatus !== 'paid') {
      return;
    }

    const updatedAt = new Date().toISOString();

    if (paymentStatus === 'refunded' && !orderBeforeUpdate.inventoryRestoredAt) {
      restoreInventoryForOrders([orderBeforeUpdate], updatedAt);
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        const nextOrder = {
          ...order,
          paymentStatus,
          status: order.status,
          updatedAt,
          ...(paymentStatus === 'refunded' ? { inventoryRestoredAt: updatedAt } : {}),
          timeline:
            paymentStatus === 'refunded'
              ? [
                  ...order.timeline,
                  buildTimelineEvent(
                    orderId,
                    order.status,
                    updatedAt,
                    'The order payment was refunded to the customer in-app account.',
                  ),
                ]
              : order.timeline,
        };

        if (isSupabaseConfigured) {
          void saveOrderToSupabase(nextOrder).catch(() => undefined);
        }

        return nextOrder;
      }),
    );

    const order = getOrderById(orderId);

    if (order) {
      if (paymentStatus === 'paid' && orderBeforeUpdate.paymentStatus !== 'paid') {
        const paidOrder: Order = {
          ...orderBeforeUpdate,
          paymentStatus: 'paid',
          status: orderBeforeUpdate.status,
        };

        queuePurchaseEmails(paidOrder);
        notifySellersForCollection(paidOrder);
        notifyBuyerPaymentConfirmed(paidOrder);
      }

      if (paymentStatus === 'refunded' && orderBeforeUpdate.paymentStatus !== 'refunded') {
        appendNotification({
          userId: orderBeforeUpdate.userId,
          userName: orderBeforeUpdate.userName,
          recipientEmail: resolveRequiredNotificationRecipientEmail({
            userId: orderBeforeUpdate.userId,
            userName: orderBeforeUpdate.userName,
            ...(orderBeforeUpdate.userEmail ? { recipientEmail: orderBeforeUpdate.userEmail } : {}),
            audience: 'resident',
          }),
          audience: 'resident',
          title: 'Order refunded',
          body:
            orderBeforeUpdate.paymentMethod === 'walletAccount'
              ? `${formatCurrency(orderBeforeUpdate.totalAmount)} was returned to your UrbanConnect account balance.`
              : `${formatCurrency(orderBeforeUpdate.totalAmount)} was credited to your UrbanConnect in-app account balance.`,
          contextType: 'order',
          contextId: orderBeforeUpdate.id,
          createdAt: updatedAt,
        });

        if (orderBeforeUpdate.userEmail) {
          appendEmailLog({
            orderId: orderBeforeUpdate.id,
            recipientType: 'buyer',
            recipientName: orderBeforeUpdate.userName,
            recipientEmail: orderBeforeUpdate.userEmail,
            subject: `Refund completed for ${orderBeforeUpdate.id}`,
            body: `Your ${formatCurrency(orderBeforeUpdate.totalAmount)} refund was returned to your UrbanConnect in-app account balance.`,
          });
        }
      }

      appendAuditLog(
        actorName,
        actorRole,
        'Payment status updated',
        `${order.id} payment status changed to ${paymentStatus}.`,
      );
    }
  };

  const updateSecuritySettings = (
    patch: Partial<SecuritySettings>,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    setSecuritySettings((currentSettings) => {
      const nextSettings = {
        ...defaultSecuritySettings,
        ...currentSettings,
        ...patch,
      };

      if (isSupabaseConfigured) {
        void saveSecuritySettingsToSupabase(nextSettings).catch(() => undefined);
      }

      return nextSettings;
    });

    appendAuditLog(
      actorName,
      actorRole,
      'Security settings updated',
      Object.entries(patch)
        .map(([key, value]) => `${key} -> ${String(value)}`)
        .join(', '),
    );
  };

  const deleteBusiness = (
    businessId: string,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canVerifyListings(actorRole)) {
      return;
    }

    const business = getBusinessById(businessId);
    const deletedAt = new Date().toISOString();

    setDeletedBusinessIds((currentIds) =>
      currentIds.includes(businessId) ? currentIds : [...currentIds, businessId],
    );
    setBusinesses((currentBusinesses) =>
      currentBusinesses.filter((currentBusiness) => currentBusiness.id !== businessId),
    );
    setCartItems((currentCartItems) =>
      currentCartItems.filter((item) => item.businessId !== businessId),
    );

    if (isSupabaseConfigured && business) {
      const hiddenBusiness: Business = {
        ...business,
        status: 'archived',
        verified: false,
        updatedAt: deletedAt,
      };

      void deleteBusinessFromSupabase(businessId).catch(() => {
        void saveBusinessToSupabase(hiddenBusiness).catch(() => undefined);
      });
    }

    if (business) {
      appendAuditLog(
        actorName,
        actorRole,
        'Listing deleted',
        `${business.name} was deleted from the marketplace.`,
      );
    }
  };

  const restoreBusiness = (
    businessId: string,
    actorName = 'UrbanConnect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    updateBusinessStatus(businessId, 'active', actorName, actorRole);
  };

  const cartEntries = useMemo<CartEntry[]>(
    () =>
      cartItems
        .map((item) => {
          const business = businesses.find(
            (currentBusiness) =>
              currentBusiness.id === item.businessId && currentBusiness.listingType === 'product',
          );

          if (!business) {
            return null;
          }

          return {
            business,
            quantity: item.quantity,
            lineTotal: business.price * item.quantity,
          };
        })
        .filter((entry): entry is CartEntry => entry !== null),
    [businesses, cartItems],
  );

  const cartCount = useMemo(
    () => cartEntries.reduce((total, entry) => total + entry.quantity, 0),
    [cartEntries],
  );

  const cartTotal = useMemo(
    () => cartEntries.reduce((total, entry) => total + entry.lineTotal, 0),
    [cartEntries],
  );

  useEffect(() => {
    const paidOrders = orders.filter((order) => order.paymentStatus === 'paid');

    if (paidOrders.length === 0) {
      return;
    }

    const hasNotification = (userId: string, title: string, contextId: string) =>
      notifications.some(
        (notification) =>
          notification.userId === userId &&
          notification.title === title &&
          notification.contextId === contextId,
      );

    paidOrders.forEach((order) => {
      const buyerTitle = `Payment confirmed for ${order.id}`;

      if (!hasNotification(order.userId, buyerTitle, order.id)) {
        appendNotification({
          userId: order.userId,
          userName: order.userName,
          recipientEmail:
            order.userEmail ??
            resolveRequiredNotificationRecipientEmail({
              userId: order.userId,
              userName: order.userName,
              audience: 'resident',
              contextType: 'order',
              contextId: order.id,
            }),
          audience: 'resident',
          title: buyerTitle,
          body:
            'Customer care has confirmed your payment. Sellers are being asked to prepare your items for support center collection.',
          contextType: 'order',
          contextId: order.id,
          createdAt: order.updatedAt,
        });
      }

      const sellerGroups = order.items.reduce<
        Record<string, { ownerKey: string; ownerUserId?: string; ownerName: string; itemLines: string[] }>
      >((accumulator, item) => {
        const ownerKey = item.ownerUserId ?? item.ownerName;
        const current = accumulator[ownerKey] ?? {
          ownerKey,
          ...(item.ownerUserId ? { ownerUserId: item.ownerUserId } : {}),
          ownerName: item.ownerName,
          itemLines: [],
        };

        current.itemLines.push(`${item.quantity} x ${item.businessName}`);
        accumulator[ownerKey] = current;
        return accumulator;
      }, {});

      Object.values(sellerGroups).forEach((sellerGroup) => {
        const userId = sellerGroup.ownerUserId ?? sellerGroup.ownerKey;
        const title = `Prepare ${order.id}`;

        if (hasNotification(userId, title, order.id)) {
          return;
        }

        appendNotification({
          userId,
          userName: sellerGroup.ownerName,
          recipientEmail: resolveRequiredNotificationRecipientEmail({
            userId,
            userName: sellerGroup.ownerName,
            audience: 'businessOwner',
            contextType: 'order',
            contextId: order.id,
          }),
          audience: 'businessOwner',
          title,
          body: `Payment is confirmed. Prepare ${sellerGroup.itemLines.join(', ')} for customer care collection at the support center.`,
          contextType: 'order',
          contextId: order.id,
          createdAt: order.updatedAt,
        });
      });
    });
  }, [notifications, orders]);

  const value = useMemo<BusinessDirectoryContextValue>(
    () => ({
      businesses,
      estates,
      currentEstateId,
      cartEntries,
      cartCount,
      cartTotal,
      orders,
      auditLogs,
      paymentPlans,
      ownerBusinessProfiles,
      emailLogs,
      subscriptionPayments,
      withdrawalRequests,
      virtualAccounts,
      dynamicDepositAccounts,
      notifications,
      securitySettings,
      orderProgressSettings,
      appendAuditLog,
      appendNotification,
      appendEmailLog,
      updateEmailLogContent,
      updateNotificationContent,
      updatePaymentPlan,
      confirmBusinessSubscription,
      getChatMessages,
      getChatConversations,
      sendChatMessage,
      getSupportConversation,
      getSupportConversations,
      getNotificationsForUser,
      isRiverParkVerifiedForUser,
      markNotificationsRead,
      sendSupportMessage,
      sendSupportReply,
      deleteSupportConversation,
      deleteLatestSupportConversation,
      setCurrentEstateId,
      registerBusiness,
      getOwnerBusinessProfile,
      isSubscriptionExemptForUser,
      confirmOwnerSubscription,
      payOwnerSubscriptionWithAccount,
      startOwnerSubscriptionFlutterwaveCheckout,
      getWithdrawalsForOwner,
      getVirtualAccountForOwner,
      getDepositAccountsForUser,
      createDynamicDepositAccount,
      startAddFundsFlutterwaveCheckout,
      ensureUserVirtualAccount,
      verifyOwnerVirtualAccount,
      requestWithdrawal,
      notifyBusinessOwnerInspection,
      setOwnerRiverParkVerification,
      updateOwnerBusinessProfile,
      getBusinessById,
      getOrderById,
      getOrdersForUser,
      getOrdersForOwner,
      isBusinessOwnedByUser,
      updateBusinessListing,
      getAvailableStock,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      checkoutCart,
      startCartFlutterwaveCheckout,
      completeCartFlutterwaveCheckout,
      restockBusinessStock,
      updateBusinessReorderLevel,
      updateOrderStatus,
      deleteOrder,
      updateOrderProgressCode,
      clearOrderTestingState,
      updatePaymentStatus,
      updateSecuritySettings,
      toggleBusinessVerification,
      deleteBusiness,
      restoreBusiness,
    }),
    [
      appendAuditLog,
      appendNotification,
      auditLogs,
      businesses,
      cartCount,
      cartEntries,
      cartTotal,
      chatThreads,
      currentEstateId,
      emailLogs,
      ownerBusinessProfiles,
      paymentPlans,
      subscriptionPayments,
      withdrawalRequests,
      virtualAccounts,
      dynamicDepositAccounts,
      notifications,
      orderProgressSettings,
      orders,
      securitySettings,
      supportThreads,
      deletedSupportConversationIds,
      verifiedUserIdsFromNotifications,
      updatePaymentPlan,
      confirmBusinessSubscription,
      updateOwnerBusinessProfile,
    ],
  );

  return (
    <BusinessDirectoryContext.Provider value={value}>
      {children}
    </BusinessDirectoryContext.Provider>
  );
}

export function useBusinessDirectory() {
  const context = useContext(BusinessDirectoryContext);

  if (!context) {
    throw new Error('useBusinessDirectory must be used within BusinessDirectoryProvider');
  }

  return context;
}
