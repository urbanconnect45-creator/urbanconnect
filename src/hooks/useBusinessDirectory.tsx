import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

import { estates } from '../data/estates';
import { isUrbanConnectLocalTestMode } from '../config/runtime';
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
  CentralCatalogProductValues,
  CartEntry,
  CartItem,
  ChatConversation,
  ChatMessage,
  CheckoutPayload,
  DeliveryLocation,
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
  VerifiedSellerPayoutAccount,
  WithdrawalRequest,
} from '../types/business';
import { riverParkClusters } from '../types/business';
import { buildBusinessMedia, isLocalOnlyMediaUrl } from '../utils/businessMedia';
import {
  getBusinessStatusLabel,
  isPublicBusiness,
  isSubscriptionActive,
} from '../utils/businessState';
import {
  DYNAMIC_DEPOSIT_EXPIRY_MINUTES,
  MINIMUM_ADD_FUNDS_DEPOSIT,
  expirePendingDeposits,
  getDepositStatusLabel,
} from '../utils/deposits';
import { formatCurrency } from '../utils/format';
import {
  getAccountWalletBalance,
  getCommittedWithdrawalTotal,
} from '../utils/wallet';
import { calculateProgressiveVat, calculateSellerPackingSupport } from '../utils/cart';
import {
  createFlutterwaveVirtualAccount,
  createFlutterwaveCheckoutSession,
  createServerMarketplaceOrder,
  createFlutterwaveDynamicDepositAccount,
  clearCustomerCartInSupabase,
  deleteBusinessFromSupabase,
  deleteCartItemFromSupabase,
  deleteOrderFromSupabase,
  deleteOrderTestingStateFromSupabase,
  deleteSupportConversationFromSupabase,
  fetchCustomerCartFromSupabase,
  fetchCustomerDeliveryLocationFromSupabase,
  fetchMarketplaceSnapshot,
  fetchAdminActionPinStatus,
  isSupabaseConfigured,
  saveBusinessToSupabase,
  saveAdminCatalogProductToSupabase,
  saveCatalogManagementAccessToSupabase,
  saveCartItemToSupabase,
  saveChatMessageToSupabase,
  saveCustomerDeliveryLocationToSupabase,
  saveEmailLogToSupabase,
  sendEmailLogThroughSupabaseFunction,
  saveNotificationToSupabase,
  saveOrderToSupabase,
  saveOwnerBusinessProfileToSupabase,
  savePaymentPlanToSupabase,
  saveStaffSupportReplyToSupabase,
  saveSecuritySettingsToSupabase,
  saveAdminActionPin,
  saveSubscriptionPaymentToSupabase,
  requestSellerWithdrawalFromSupabase,
  reviewStoreApplicationInSupabase,
  setListingVerificationInSupabase,
  updateWithdrawalStatusInSupabase,
  verifyAdminActionPin as verifyAdminActionPinInSupabase,
  saveSupportMessageToSupabase,
  subscribeToSupabaseAccessToken,
  uploadBusinessMediaToSupabase,
  uploadChatAttachmentToSupabaseStorage,
  uploadPrivateDocumentToSupabaseStorage,
  updateOrderStatusInSupabase,
  markSellerOrderReadyInSupabase,
  markMyNotificationsReadInSupabase,
} from '../services/supabaseApi';
import { normalizeOrderStatus } from '../utils/order';
import {
  isCustomerAdvertisement as isCustomerAdvertisementListing,
  isCustomerAdvertisementSource as isCustomerAdvertisementSourceListing,
  isStoreOwnerListing as isBusinessStoreOwnerListing,
  isStoreOwnerListingSource as isBusinessStoreOwnerListingSource,
  isStoreOwnerProduct,
} from '../utils/marketplaceListings';
import { usePersistentState } from './usePersistentState';

type BusinessDirectoryContextValue = {
  businesses: Business[];
  centralCatalogProducts: Business[];
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
  ) => Promise<void>;
  confirmBusinessSubscription: (
    businessId: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  getChatMessages: (businessId: string) => ChatMessage[];
  getChatConversations: (user?: AppUser | null) => ChatConversation[];
  sendChatMessage: (
    businessId: string,
    sender: AppUser | string,
    text: string,
    attachments?: ChatMessage['attachments'],
  ) => Promise<void>;
  getSupportConversation: (user?: AppUser | null) => SupportConversation | undefined;
  getSupportConversations: () => SupportConversation[];
  getNotificationsForUser: (user?: AppUser | null) => AppNotification[];
  isRiverParkVerifiedForUser: (user?: AppUser | null) => boolean;
  isCustomerAdvertisement: (business: Business) => boolean;
  isCustomerAdvertisementSource: (business: Business) => boolean;
  isStoreOwnerListing: (business: Business) => boolean;
  isStoreOwnerListingSource: (business: Business) => boolean;
  hasCatalogManagementAccess: (ownerUserId: string) => boolean;
  setCatalogManagementAccess: (owner: AppUser, allowed: boolean) => Promise<void>;
  markNotificationsRead: (userId: string) => Promise<void>;
  sendSupportMessage: (
    user: AppUser,
    text: string,
    context?: Pick<SupportMessage, 'contextType' | 'contextId' | 'contextLabel'>,
    attachments?: SupportMessage['attachments'],
  ) => Promise<void>;
  sendSupportReply: (
    conversationId: string,
    actorName: string,
    actorRole: AuditActorRole,
    text: string,
  ) => Promise<void>;
  deleteSupportConversation: (conversationId: string) => Promise<void>;
  deleteLatestSupportConversation: () => Promise<void>;
  setCurrentEstateId: (estateId: string) => void;
  registerBusiness: (
    values: BusinessProfileFormValues,
    owner?: AppUser | null,
  ) => Promise<Business>;
  createCentralCatalogProduct: (
    values: CentralCatalogProductValues,
    managedOwner?: AppUser,
    adminPin?: string,
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
  payCustomerBenefitSubscriptionWithAccount: (
    customer: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths?: number,
    durationMinutes?: number,
    amountOverride?: number,
    discountAmount?: number,
  ) => SubscriptionPayment;
  startCustomerBenefitFlutterwaveCheckout: (
    customer: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths?: number,
    durationMinutes?: number,
    amountOverride?: number,
    discountAmount?: number,
  ) => Promise<FlutterwaveCheckoutSession & { payment: SubscriptionPayment }>;
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
  ) => Promise<WithdrawalRequest>;
  updateWithdrawalStatus: (
    withdrawalId: string,
    status: Exclude<WithdrawalRequest['status'], 'pending'>,
    providerReference?: string,
    failureReason?: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => Promise<WithdrawalRequest>;
  notifyBusinessOwnerInspection: (owner: AppUser) => void;
  setOwnerRiverParkVerification: (
    ownerUserId: string,
    verified: boolean,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  approveStoreApplicationForOwner: (
    owner: AppUser,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => void;
  reviewStoreApplicationForOwner: (
    owner: AppUser,
    decision: 'approved' | 'changesRequested',
    message: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => Promise<void>;
  updateOwnerBusinessProfile: (
    owner: AppUser,
    values: OwnerBusinessProfileValues,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => Promise<void>;
  setVerifiedSellerPayoutAccount: (
    owner: AppUser,
    account: VerifiedSellerPayoutAccount,
  ) => void;
  getBusinessById: (businessId: string) => Business | undefined;
  getOrderById: (orderId: string) => Order | undefined;
  getOrdersForUser: (userId: string) => Order[];
  getOrdersForOwner: (ownerUserId: string, owner?: AppUser | null) => Order[];
  markSellerOrderReady: (orderId: string, owner: AppUser) => Promise<boolean>;
  syncCustomerAccountData: (user?: AppUser | null) => Promise<void>;
  getCustomerDeliveryLocation: (user?: AppUser | null) => DeliveryLocation | undefined;
  saveCustomerDeliveryLocation: (
    user: AppUser,
    location: DeliveryLocation,
  ) => Promise<DeliveryLocation>;
  getAvailableAccountBalanceForUser: (user: AppUser) => number;
  isBusinessOwnedByUser: (business: Business, user?: AppUser | null) => boolean;
  updateBusinessListing: (
    businessId: string,
    values: {
      name: string;
      description: string;
      longDescription: string;
      category?: string;
      address?: string;
      imageUrl?: string;
      services?: string[];
      sku?: string;
      price?: number;
      stockQuantity?: number;
      reorderLevel?: number;
    },
    owner?: AppUser | null,
  ) => Promise<Business>;
  deleteOwnedBusinessListing: (businessId: string, owner?: AppUser | null) => Promise<void>;
  getAvailableStock: (businessId: string) => number;
  addToCart: (businessId: string, user?: AppUser | null) => Promise<void>;
  removeFromCart: (businessId: string, user?: AppUser | null) => Promise<void>;
  updateCartQuantity: (
    businessId: string,
    quantity: number,
    user?: AppUser | null,
  ) => Promise<void>;
  clearCart: (user?: AppUser | null) => Promise<void>;
  checkoutCart: (payload: CheckoutPayload, customer?: AppUser | null) => Order;
  startCartFlutterwaveCheckout: (
    payload: Omit<CheckoutPayload, 'paymentMethod'>,
    customer?: AppUser | null,
    paymentOptions?: string[],
  ) => Promise<FlutterwaveCheckoutSession & { order: Order }>;
  restockBusinessStock: (
    businessId: string,
    quantity: number,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => Promise<void>;
  updateBusinessReorderLevel: (
    businessId: string,
    reorderLevel: number,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    actorName?: string,
    actorRole?: AuditActorRole,
    progressCode?: string,
    actorUserId?: string,
    actor?: AppUser | null,
  ) => Promise<void>;
  deleteOrder: (orderId: string, actorName?: string, actorRole?: AuditActorRole) => void;
  updateOrderProgressCode: (
    code: string,
    actorName?: string,
    actorRole?: AuditActorRole,
  ) => Promise<void>;
  syncOrderProgressSettings: () => Promise<void>;
  verifyOrderProgressCode: (code: string) => Promise<boolean>;
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
  ) => Promise<void>;
  toggleBusinessVerification: (
    businessId: string,
    actorName?: string,
    actorRole?: AuditActorRole,
    adminPin?: string,
  ) => Promise<void>;
  deleteBusiness: (businessId: string, actorName?: string, actorRole?: AuditActorRole) => Promise<void>;
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
    ? 'Thanks for reaching View2Connect support. Please describe the listing, order, payment, or verification issue clearly. A support agent will attend to you shortly.'
    : 'Thanks for reaching View2Connect support. Please describe the problem clearly. A support agent will attend to you shortly.';
}

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
  const persistenceOptions = { enabled: isUrbanConnectLocalTestMode };
  const [rawBusinesses, setBusinesses] = usePersistentState<Business[]>(
    'urbanconnect.businesses.v3',
    isUrbanConnectLocalTestMode ? mockBusinesses : [],
    persistenceOptions,
  );
  const [deletedBusinessIds, setDeletedBusinessIds] = usePersistentState<string[]>(
    'urbanconnect.deletedBusinessIds.v1',
    [],
    persistenceOptions,
  );
  const [cartItems, setCartItems] = usePersistentState<CartItem[]>(
    'urbanconnect.cart.v2',
    [],
    persistenceOptions,
  );
  const cartItemsRef = useRef<CartItem[]>(cartItems);
  const cartMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [customerDeliveryLocations, setCustomerDeliveryLocations] = usePersistentState<
    DeliveryLocation[]
  >('urbanconnect.customerDeliveryLocations.v1', [], persistenceOptions);
  const [chatThreads, setChatThreads] = usePersistentState<Record<string, ChatMessage[]>>(
    'urbanconnect.chats.v2',
    {},
    persistenceOptions,
  );
  const [supportThreads, setSupportThreads] = usePersistentState<Record<string, SupportMessage[]>>(
    'urbanconnect.supportChats.v2',
    {},
    persistenceOptions,
  );
  const [deletedSupportConversationIds, setDeletedSupportConversationIds] = usePersistentState<
    string[]
  >('urbanconnect.deletedSupportConversationIds.v1', [], persistenceOptions);
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>(
    'urbanconnect.notifications.v2',
    [],
    persistenceOptions,
  );
  const [orders, setOrders] = usePersistentState<Order[]>(
    'urbanconnect.orders.v3',
    isUrbanConnectLocalTestMode ? seededOrders : [],
    persistenceOptions,
  );
  const [orderResetAt, setOrderResetAt] = usePersistentState<string>(
    'urbanconnect.orderResetAt.v1',
    '',
    persistenceOptions,
  );
  const [orderProgressSettings, setOrderProgressSettings] =
    usePersistentState<OrderProgressSettings>(
      'urbanconnect.orderProgressCode.v1',
      { code: '', updatedAt: '' },
      persistenceOptions,
    );
  const [paymentPlans, setPaymentPlans] = usePersistentState<PaymentPlan[]>(
    'urbanconnect.paymentPlans.v1',
    defaultPaymentPlans,
    persistenceOptions,
  );
  const [ownerBusinessProfiles, setOwnerBusinessProfiles] = usePersistentState<
    OwnerBusinessProfile[]
  >('urbanconnect.ownerBusinessProfiles.v2', [], persistenceOptions);
  const [subscriptionPayments, setSubscriptionPayments] = usePersistentState<
    SubscriptionPayment[]
  >('urbanconnect.subscriptionPayments.v1', [], persistenceOptions);
  const [withdrawalRequests, setWithdrawalRequests] = usePersistentState<WithdrawalRequest[]>(
    'urbanconnect.withdrawals.v2',
    [],
    persistenceOptions,
  );
  const [virtualAccounts, setVirtualAccounts] = usePersistentState<VirtualAccount[]>(
    'urbanconnect.virtualAccounts.v1',
    [],
    persistenceOptions,
  );
  const [dynamicDepositAccounts, setDynamicDepositAccounts] = usePersistentState<
    DynamicDepositAccount[]
  >('urbanconnect.dynamicDepositAccounts.v1', [], persistenceOptions);
  const [emailLogs, setEmailLogs] = usePersistentState<AutomatedEmailLog[]>(
    'urbanconnect.emailLogs.v2',
    isUrbanConnectLocalTestMode ? seededEmailLogs : [],
    persistenceOptions,
  );
  const emailDeliveryAttemptedAtRef = useRef<Record<string, number>>({});
  const [rawSecuritySettings, setSecuritySettings] = usePersistentState<SecuritySettings>(
    'urbanconnect.security.v1',
    defaultSecuritySettings,
    persistenceOptions,
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
    isUrbanConnectLocalTestMode ? seededAuditLogs : [],
    persistenceOptions,
  );
  const [currentEstateId, setCurrentEstateId] = usePersistentState<string>(
    'urbanconnect.currentEstateId.v2',
    estates[0]?.id ?? 'river-park',
    persistenceOptions,
  );

  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);
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
          const staticBusinesses = (isUrbanConnectLocalTestMode ? mockBusinesses : []).filter(
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

          return isUrbanConnectLocalTestMode
            ? mergeNewestById(staticBusinesses, remoteBusinesses)
            : remoteBusinesses;
        });
        setOrders((currentOrders) => {
          const resetTime = new Date(orderResetAt).getTime();
          const remoteOrders = Number.isFinite(resetTime)
            ? snapshot.orders.filter(
                (order) => new Date(order.createdAt).getTime() > resetTime,
              )
            : snapshot.orders;

          const mergedOrders = isUrbanConnectLocalTestMode
            ? mergeRemoteOrdersWithRecentLocal(currentOrders, remoteOrders)
            : remoteOrders;
          const mergedOrderIds = new Set(mergedOrders.map((order) => order.id));
          const droppedLocalOrders = currentOrders.filter(
            (order) =>
              !mergedOrderIds.has(order.id) &&
              !order.inventoryRestoredAt &&
              order.status !== 'cancelled' &&
              order.paymentStatus !== 'refunded',
          );

          if (isUrbanConnectLocalTestMode && droppedLocalOrders.length > 0) {
            restoreInventoryForOrders(droppedLocalOrders, new Date().toISOString());
          }

          return mergedOrders;
        });
        setOwnerBusinessProfiles((currentProfiles) =>
          isUrbanConnectLocalTestMode
            ? mergeNewestById(currentProfiles, snapshot.ownerBusinessProfiles)
            : snapshot.ownerBusinessProfiles,
        );
        setEmailLogs((currentLogs) =>
          isUrbanConnectLocalTestMode
            ? mergeNewestById(currentLogs, snapshot.emailLogs)
            : snapshot.emailLogs,
        );
        setAuditLogs(snapshot.auditLogs);
        setNotifications((currentNotifications) =>
          isUrbanConnectLocalTestMode
            ? mergeNewestById(currentNotifications, snapshot.notifications)
            : snapshot.notifications,
        );
        setChatThreads(snapshot.chatThreads);
        setSupportThreads(() => {
          const deletedIds = new Set(deletedSupportConversationIds);

          return Object.fromEntries(
            Object.entries(snapshot.supportThreads).filter(
              ([conversationId]) => !deletedIds.has(conversationId),
            ),
          );
        });
        setSubscriptionPayments((currentPayments) =>
          isUrbanConnectLocalTestMode
            ? mergeNewestById(currentPayments, snapshot.subscriptionPayments)
            : snapshot.subscriptionPayments,
        );
        setWithdrawalRequests((currentWithdrawals) =>
          isUrbanConnectLocalTestMode
            ? mergeNewestById(currentWithdrawals, snapshot.withdrawalRequests)
            : snapshot.withdrawalRequests,
        );
        setVirtualAccounts((currentAccounts) =>
          isUrbanConnectLocalTestMode
            ? mergeNewestById(currentAccounts, snapshot.virtualAccounts)
            : snapshot.virtualAccounts,
        );
        setDynamicDepositAccounts((currentDeposits) =>
          isUrbanConnectLocalTestMode
            ? mergeNewestById(currentDeposits, snapshot.dynamicDepositAccounts)
            : snapshot.dynamicDepositAccounts,
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
    const refreshInterval = setInterval(loadSnapshot, 30_000);
    const unsubscribeFromAccessToken = subscribeToSupabaseAccessToken(loadSnapshot);

    return () => {
      isCancelled = true;
      clearInterval(refreshInterval);
      unsubscribeFromAccessToken();
    };
  }, [
    setAuditLogs,
    setBusinesses,
    deletedBusinessIds,
    setChatThreads,
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
    return owner?.role === 'businessOwner';
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

    return Boolean(user);
  };

  const isStoreOwnerListingForDirectory = (business: Business) =>
    isBusinessStoreOwnerListing(business, ownerBusinessProfiles);

  const isStoreOwnerListingSourceForDirectory = (business: Business) =>
    isBusinessStoreOwnerListingSource(business, ownerBusinessProfiles);

  const isCustomerAdvertisementForDirectory = (business: Business) =>
    isCustomerAdvertisementListing(business, ownerBusinessProfiles);

  const isCustomerAdvertisementSourceForDirectory = (business: Business) =>
    isCustomerAdvertisementSourceListing(business, ownerBusinessProfiles);

  const markNotificationsRead = async (userId: string) => {
    const readAt = new Date().toISOString();

    if (isSupabaseConfigured) {
      await markMyNotificationsReadInSupabase();
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.userId === userId && !notification.readAt
          ? { ...notification, readAt }
          : notification,
      ),
    );
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
    const prefix =
      notification.audience === 'businessOwner'
        ? 'business-owner'
        : notification.audience === 'dispatch'
          ? 'dispatch'
          : 'resident';

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
      recipientType:
        notification.audience === 'businessOwner'
          ? 'owner'
          : notification.audience === 'dispatch'
            ? 'dispatch'
            : 'buyer',
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

  const hasCatalogManagementAccess = (ownerUserId: string) => {
    const latestDecision = notifications
      .filter(
        (notification) =>
          notification.userId === ownerUserId &&
          notification.contextType === 'general' &&
          notification.contextId === `catalog-management-${ownerUserId}`,
      )
      .sort(
        (leftNotification, rightNotification) =>
          new Date(rightNotification.createdAt).getTime() -
          new Date(leftNotification.createdAt).getTime(),
      )[0];

    return latestDecision?.title === 'Catalog management access granted';
  };

  const setCatalogManagementAccess = async (owner: AppUser, allowed: boolean) => {
    if (owner.role !== 'businessOwner') {
      throw new Error('Only store owners can change catalog management access.');
    }

    const notification: AppNotification = {
      id: `notification-catalog-management-${owner.id}`,
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: 'businessOwner',
      title: allowed
        ? 'Catalog management access granted'
        : 'Catalog management access revoked',
      body: allowed
        ? 'You allowed View2Connect Admin to create and update products for your store. You can revoke this permission from your seller profile.'
        : 'View2Connect Admin can no longer create or update products for your store.',
      contextType: 'general',
      contextId: `catalog-management-${owner.id}`,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      await saveCatalogManagementAccessToSupabase(allowed);
    }

    setNotifications((currentNotifications) => [
      notification,
      ...currentNotifications.filter(
        (currentNotification) => currentNotification.id !== notification.id,
      ),
    ]);

    if (!isSupabaseConfigured) {
      appendAuditLog(
        owner.fullName,
        'businessOwner',
        allowed ? 'Catalog management access granted' : 'Catalog management access revoked',
        `${owner.businessName ?? owner.fullName} ${allowed ? 'granted' : 'revoked'} Admin catalog access.`,
      );
    }
  };

  useEffect(() => {
    dynamicDepositAccounts
      .filter((deposit) => deposit.status === 'paid')
      .forEach((deposit) => {
        const confirmedAt = deposit.paidAt ?? deposit.updatedAt;
        const title = `Add funds receipt ${deposit.reference}`;
        const body = `${formatCurrency(deposit.amount)} was received by Flutterwave and added to your View2Connect account.`;
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

  const sendSupportMessage = async (
    user: AppUser,
    text: string,
    context?: Pick<SupportMessage, 'contextType' | 'contextId' | 'contextLabel'>,
    attachments: SupportMessage['attachments'] = [],
  ) => {
    const trimmedText = text.trim();
    const hasAttachments = attachments.length > 0;

    if (!trimmedText && !hasAttachments) {
      return;
    }

    const createdAt = new Date().toISOString();
    const conversationId = supportConversationId(user.id);
    const messageId = `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const uploadedAttachments = await Promise.all(
      attachments.map((attachment) =>
        uploadChatAttachmentToSupabaseStorage(
          attachment,
          messageId,
          user.id,
        ),
      ),
    );
    const message: SupportMessage = {
      id: messageId,
      conversationId,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      senderName: user.fullName,
      senderRole: user.role,
      text: trimmedText || (uploadedAttachments.length > 1 ? 'Sent attachments' : 'Sent an attachment'),
      ...(context?.contextType ? { contextType: context.contextType } : {}),
      ...(context?.contextId ? { contextId: context.contextId } : {}),
      ...(context?.contextLabel ? { contextLabel: context.contextLabel } : {}),
      ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
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
      senderName: 'View2Connect support',
      senderRole: 'system',
      text: supportAutoReplyText(user.role),
      ...(context?.contextType ? { contextType: context.contextType } : {}),
      ...(context?.contextId ? { contextId: context.contextId } : {}),
      ...(context?.contextLabel ? { contextLabel: context.contextLabel } : {}),
      createdAt: new Date(Date.now() + 500).toISOString(),
    };
    const nextMessages = shouldSendAutoReply ? [message, autoReply] : [message];

    if (isSupabaseConfigured) {
      await saveSupportMessageToSupabase(message);
      if (shouldSendAutoReply) {
        await saveSupportMessageToSupabase(autoReply);
      }
    }

    setDeletedSupportConversationIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== conversationId),
    );
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
  };

  const sendSupportReply = async (
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

    if (isSupabaseConfigured) {
      await saveStaffSupportReplyToSupabase(message);
    }

    setSupportThreads((currentThreads) => ({
      ...currentThreads,
      [conversationId]: [...(currentThreads[conversationId] ?? []), message],
    }));

    if (!isSupabaseConfigured) {
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
    }

  };

  const deleteSupportConversation = async (conversationId: string) => {
    if (isSupabaseConfigured) {
      await deleteSupportConversationFromSupabase(conversationId);
    }

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

  };

  const deleteLatestSupportConversation = async () => {
    const latestConversation = getSupportConversations()[0];

    if (latestConversation) {
      await deleteSupportConversation(latestConversation.id);
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
      title: 'Store application received',
      body:
        'Your email is verified and your seller dashboard is ready. Admin is reviewing your store application.',
      contextType: 'general',
      contextId: owner.id,
    });

    appendEmailLog({
      recipientType: 'owner',
      recipientName: owner.fullName,
      recipientEmail: owner.email,
      subject: 'View2Connect received your store application',
      body:
        'Your email is verified and your seller dashboard is ready. Admin is reviewing your store application.',
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
        senderName: 'View2Connect support',
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
      body: 'Your order was marked delivered. Thank you for shopping with View2Connect.',
      contextType: 'order',
      contextId: order.id,
    });

    appendEmailLog({
      orderId: order.id,
      recipientType: 'buyer',
      recipientName: order.userName,
      recipientEmail: order.userEmail ?? `${order.userId}@buyers.local`,
      subject: `Delivered ${order.id}`,
      body: 'Your order was marked delivered. Thank you for shopping with View2Connect.',
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

  const updatePaymentPlan = async (
    cycle: PaymentPlanCycle,
    patch: Pick<PaymentPlan, 'title' | 'amount' | 'description'>,
    actorName = 'View2Connect Owner',
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

    if (isSupabaseConfigured) {
      await savePaymentPlanToSupabase(nextPlan);
    }

    setPaymentPlans((currentPlans) =>
      currentPlans.some((plan) => plan.cycle === cycle)
        ? currentPlans.map((plan) => (plan.cycle === cycle ? nextPlan : plan))
        : [...currentPlans, nextPlan],
    );

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
    actorName = 'View2Connect Owner',
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
    actorName = 'View2Connect Owner',
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
      subject: `${plan.title} confirmed for your seller profile`,
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
    const balance = getAvailableAccountBalanceForUser(owner);

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
      bio: existingProfile?.bio ?? '',
      profileImage: existingProfile?.profileImage ?? '',
      phone: existingProfile?.phone ?? owner.phoneNumber,
      whatsapp: existingProfile?.whatsapp ?? '',
      email: existingProfile?.email ?? owner.email,
      website: existingProfile?.website ?? '',
      instagram: existingProfile?.instagram ?? '',
      facebook: existingProfile?.facebook ?? '',
      x: existingProfile?.x ?? '',
      tiktok: existingProfile?.tiktok ?? '',
      address: existingProfile?.address ?? owner.businessCluster ?? '',
      openingTime: existingProfile?.openingTime ?? '',
      closingTime: existingProfile?.closingTime ?? '',
      openDays: existingProfile?.openDays ?? [],
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
      body: `Your View2Connect account balance paid ${formatCurrency(amount)}. All listings on this account are active until ${formatDateTimeForEmail(nextBillingAt)}.`,
    });

    return payment;
  };

  const payCustomerBenefitSubscriptionWithAccount = (
    customer: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths = 1,
    durationMinutes?: number,
    amountOverride?: number,
    discountAmount = 0,
  ) => {
    if (customer.role !== 'resident') {
      throw new Error('Customer benefits are available only from a customer account.');
    }

    const plan = getPaymentPlanByCycle(cycle);
    const minuteDuration =
      typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? Math.floor(durationMinutes)
        : undefined;
    const durationMultiplier = Math.max(1, Math.floor(durationMonths));
    const amountBeforeDiscount =
      minuteDuration && amountOverride !== undefined
        ? amountOverride + discountAmount
        : plan.amount * durationMultiplier;
    const amount = amountOverride ?? amountBeforeDiscount;
    const balance = getAvailableAccountBalanceForUser(customer);
    const createdAt = new Date().toISOString();
    const nextBillingDate = new Date(createdAt);
    if (minuteDuration) {
      nextBillingDate.setMinutes(nextBillingDate.getMinutes() + minuteDuration);
    } else {
      nextBillingDate.setDate(nextBillingDate.getDate() + 30 * durationMultiplier);
    }
    const nextBillingAt = nextBillingDate.toISOString();
    const durationLabel = minuteDuration
      ? `${minuteDuration} minute${minuteDuration === 1 ? '' : 's'}`
      : `${durationMultiplier} month${durationMultiplier === 1 ? '' : 's'}`;

    if (amount > balance) {
      throw new Error(
        `Your account balance is ${formatCurrency(balance)}. Add funds before subscribing for ${formatCurrency(amount)}.`,
      );
    }

    const reference = `UC-CUST-SUB-${Date.now()}`;
    const payment: SubscriptionPayment = {
      id: reference,
      reference,
      ownerUserId: customer.id,
      ownerName: customer.fullName,
      ownerEmail: customer.email,
      cycle,
      amount,
      currency: 'NGN',
      status: 'paid',
      paidAt: createdAt,
      rawPayload: JSON.stringify({
        method: 'accountBalance',
        subscriptionType: 'customerBenefits',
        planTitle: plan.title,
        durationLabel,
        durationMonths: durationMultiplier,
        ...(minuteDuration ? { durationMinutes: minuteDuration } : {}),
        amountBeforeDiscount,
        discountAmount,
        nextBillingAt,
      }),
      createdAt,
      updatedAt: createdAt,
    };

    setSubscriptionPayments((currentPayments) => [
      payment,
      ...currentPayments.filter((currentPayment) => currentPayment.reference !== reference),
    ]);

    if (isSupabaseConfigured) {
      void saveSubscriptionPaymentToSupabase(payment).catch(() => undefined);
    }

    appendAuditLog(
      customer.fullName,
      'system',
      'Customer benefits subscription paid',
      `${customer.fullName} paid ${formatCurrency(amount)} for ${plan.title} (${durationLabel}).`,
    );
    appendNotification({
      userId: customer.id,
      userName: customer.fullName,
      recipientEmail: customer.email,
      audience: 'resident',
      title: 'Benefits subscription active',
      body: `${plan.title} is active for ${durationLabel} until ${formatDateTimeForEmail(nextBillingAt)}.`,
      contextType: 'general',
      contextId: reference,
      createdAt,
    });
    appendEmailLog({
      recipientType: 'buyer',
      recipientName: customer.fullName,
      recipientEmail: customer.email,
      subject: 'View2Connect benefits active',
      body: `Your ${plan.title} subscription is active for ${durationLabel} until ${formatDateTimeForEmail(nextBillingAt)}.`,
    });

    return payment;
  };

  const startCustomerBenefitFlutterwaveCheckout = async (
    customer: AppUser,
    cycle: PaymentPlanCycle,
    durationMonths = 1,
    durationMinutes?: number,
    amountOverride?: number,
    discountAmount = 0,
  ) => {
    if (!isSupabaseConfigured) {
      throw new Error('Flutterwave live checkout needs Supabase to be configured.');
    }
    if (customer.role !== 'resident') {
      throw new Error('Customer advert promotion is available only to customer accounts.');
    }

    const plan = getPaymentPlanByCycle(cycle);
    const minuteDuration =
      typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? Math.floor(durationMinutes)
        : undefined;
    const durationMultiplier = Math.max(1, Math.floor(durationMonths));
    const amountBeforeDiscount =
      minuteDuration && amountOverride !== undefined
        ? amountOverride + discountAmount
        : plan.amount * durationMultiplier;
    const amount = amountOverride ?? amountBeforeDiscount;
    const createdAt = new Date().toISOString();
    const nextBillingDate = new Date(createdAt);
    if (minuteDuration) {
      nextBillingDate.setMinutes(nextBillingDate.getMinutes() + minuteDuration);
    } else {
      nextBillingDate.setDate(nextBillingDate.getDate() + 30 * durationMultiplier);
    }
    const nextBillingAt = nextBillingDate.toISOString();
    const durationLabel = minuteDuration
      ? `${minuteDuration} minute${minuteDuration === 1 ? '' : 's'}`
      : `${durationMultiplier} month${durationMultiplier === 1 ? '' : 's'}`;
    const reference = `UC-CUST-SUB-${customer.id}-${Date.now()}`;
    const pendingPayment: SubscriptionPayment = {
      id: reference,
      reference,
      ownerUserId: customer.id,
      ownerName: customer.fullName,
      ownerEmail: customer.email,
      cycle,
      amount,
      currency: 'NGN',
      status: 'pending',
      rawPayload: JSON.stringify({
        method: 'flutterwaveCheckout',
        subscriptionType: 'customerBenefits',
        planTitle: plan.title,
        durationLabel,
        durationMonths: durationMultiplier,
        ...(minuteDuration ? { durationMinutes: minuteDuration } : {}),
        amountBeforeDiscount,
        discountAmount,
        nextBillingAt,
        itemCount: 1,
      }),
      createdAt,
      updatedAt: createdAt,
    };

    await saveSubscriptionPaymentToSupabase(pendingPayment);
    const session = await createFlutterwaveCheckoutSession({
      reference,
      amount,
      customerName: customer.fullName,
      customerEmail: customer.email,
      customerPhone: customer.phoneNumber,
      title: 'View2Connect advert promotion',
      description: `${plan.title} promotion for ${durationLabel}.`,
      purpose: 'subscription',
      meta: { userId: customer.id },
    });
    const payment: SubscriptionPayment = {
      ...pendingPayment,
      currency: session.currency,
      checkoutUrl: session.checkoutUrl,
      rawPayload: JSON.stringify({
        ...JSON.parse(pendingPayment.rawPayload ?? '{}'),
        checkoutUrl: session.checkoutUrl,
        paymentOptions: session.paymentOptions,
        mode: session.mode,
        providerBody: session.providerBody,
      }),
    };

    await saveSubscriptionPaymentToSupabase(payment);
    setSubscriptionPayments((currentPayments) => [
      payment,
      ...currentPayments.filter((item) => item.reference !== reference),
    ]);

    return { ...session, payment };
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
    const pendingPayment: SubscriptionPayment = {
      id: reference,
      reference,
      ownerUserId: owner.id,
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      cycle,
      amount,
      currency: 'NGN',
      status: 'pending',
      rawPayload: JSON.stringify({
        method: 'flutterwaveCheckout',
        durationLabel,
        durationMonths: durationMultiplier,
        ...(hasMinuteDuration ? { durationMinutes } : {}),
        amountPerListing,
        itemCount,
      }),
      createdAt,
      updatedAt: createdAt,
    };

    await saveSubscriptionPaymentToSupabase(pendingPayment);
    const session = await createFlutterwaveCheckoutSession({
      reference,
      amount,
      customerName: owner.businessName ?? owner.fullName,
      customerEmail: owner.email,
      customerPhone: owner.phoneNumber,
      title: 'View2Connect business subscription',
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
      ...pendingPayment,
      currency: session.currency,
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
    actorName = 'View2Connect Owner',
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
      verified ? 'Seller verified' : 'Seller verification revoked',
      `${profile?.ownerName ?? ownerUserId} was marked ${verified ? 'verified' : 'pending'} for marketplace selling.`,
    );

    if (profile) {
      appendNotification({
        userId: profile.ownerUserId,
        userName: profile.ownerName,
        recipientEmail: profile.accountEmail || profile.email,
        audience: 'businessOwner',
        title: verified ? 'Seller verification approved' : 'Seller verification pending',
        body: verified
          ? 'Customer care has verified your seller account. Listing approval is tracked separately.'
          : 'Your seller verification has been moved back to pending. Customer care may contact you for more information.',
        contextType: 'general',
        contextId: profile.ownerUserId,
      });
    }
  };

  const approveStoreApplicationForOwner = (
    owner: AppUser,
    actorName = 'View2Connect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole) || owner.role !== 'businessOwner') {
      return;
    }

    const updatedAt = new Date().toISOString();
    const existingProfile = getOwnerBusinessProfile(owner);

    const nextProfile: OwnerBusinessProfile = {
      ...(existingProfile ?? {
        id: owner.id,
        ownerUserId: owner.id,
        accountName: owner.businessName ?? owner.fullName,
        accountEmail: owner.email,
        ownerName: owner.businessName ?? owner.fullName,
        bio: '',
        profileImage: '',
        phone: owner.phoneNumber,
        whatsapp: owner.phoneNumber,
        email: owner.email,
        website: '',
        instagram: '',
        facebook: '',
        x: '',
        tiktok: '',
        address: owner.businessCluster ?? '',
        openingTime: '',
        closingTime: '',
        openDays: [],
        coverImage: '',
        galleryImages: '',
        galleryVideos: '',
      }),
      riverParkVerified: true,
      updatedAt,
    };
    const ownerKeys = [
      owner.id,
      owner.email,
      owner.fullName,
      owner.businessName,
      nextProfile.accountEmail,
      nextProfile.email,
      nextProfile.accountName,
      nextProfile.ownerName,
    ]
      .map((ownerKey) => ownerKey?.trim().toLowerCase())
      .filter((ownerKey): ownerKey is string => Boolean(ownerKey));

    setOwnerBusinessProfiles((currentProfiles) => {
      const existingIndex = currentProfiles.findIndex((profile) =>
        [
          profile.ownerUserId,
          profile.accountEmail,
          profile.email,
          profile.accountName,
          profile.ownerName,
        ]
          .map((ownerKey) => ownerKey?.trim().toLowerCase())
          .some((ownerKey) => Boolean(ownerKey && ownerKeys.includes(ownerKey))),
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
        const matchesOwner = [business.ownerUserId, business.ownerEmail, business.ownerName]
          .map((ownerKey) => ownerKey?.trim().toLowerCase())
          .some((ownerKey) => Boolean(ownerKey && ownerKeys.includes(ownerKey)));

        if (!matchesOwner) {
          return business;
        }

        const nextBusiness: Business = {
          ...business,
          status: 'active',
          verified: true,
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
      'Store application listings activated',
      `${owner.businessName ?? owner.fullName} was approved and matching listings were marked public-ready.`,
    );
  };

  const reviewStoreApplicationForOwner = async (
    owner: AppUser,
    decision: 'approved' | 'changesRequested',
    message: string,
    actorName = 'View2Connect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole) || owner.role !== 'businessOwner') {
      throw new Error('Only the owner admin can review store applications.');
    }

    if (isSupabaseConfigured) {
      await reviewStoreApplicationInSupabase({
        userId: owner.id,
        decision,
        message,
      });
    }

    if (decision === 'approved') {
      if (isSupabaseConfigured) {
        const updatedAt = new Date().toISOString();
        setOwnerBusinessProfiles((currentProfiles) =>
          currentProfiles.map((profile) =>
            profile.ownerUserId === owner.id
              ? { ...profile, riverParkVerified: true, updatedAt }
              : profile,
          ),
        );
        setBusinesses((currentBusinesses) =>
          currentBusinesses.map((business) =>
            business.ownerUserId === owner.id
              ? { ...business, riverParkVerified: true, status: 'active', updatedAt }
              : business,
          ),
        );
      } else {
        approveStoreApplicationForOwner(owner, actorName, actorRole);
      }
    }

    appendAuditLog(
      actorName,
      actorRole,
      decision === 'approved' ? 'Store application approved' : 'Store application changes requested',
      `${owner.businessName ?? owner.fullName}: ${message}`,
    );
  };

  function formatDateTimeForEmail(value: string) {
    return new Date(value).toLocaleString();
  }

  const updateBusinessStatus = (
    businessId: string,
    status: 'active' | 'archived',
    actorName = 'View2Connect Owner',
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
    const individualSeller = owner?.role === 'resident';
    const isCustomerAdvert = Boolean(individualSeller);
    const profileContact = {
      phone: ownerProfile?.phone?.trim() || owner?.phoneNumber.trim() || values.phone.trim(),
      whatsapp:
        ownerProfile?.whatsapp?.trim() || owner?.phoneNumber.trim() || values.whatsapp.trim(),
      email: (
        ownerProfile?.email?.trim() ||
        owner?.email.trim() ||
        values.email.trim()
      ).toLowerCase(),
      website: ownerProfile?.website?.trim() || '',
      instagram: ownerProfile?.instagram?.trim() || '',
      facebook: ownerProfile?.facebook?.trim() || '',
      x: ownerProfile?.x?.trim() || '',
      tiktok: ownerProfile?.tiktok?.trim() || '',
    };
    const subscriptionCycle = ownerProfile?.subscriptionCycle ?? 'monthly';
    const sellerAccessEnabled =
      Boolean(individualSeller) || Boolean(owner && isRiverParkVerifiedForUser(owner));
    const submittedAt = new Date().toISOString();

    const business: Business = {
      id: listingId,
      estateId: values.estateId,
      listingType: values.listingType,
      listingSource: isCustomerAdvert ? 'customerAccount' : 'sellerPortal',
      listingAudience: isCustomerAdvert ? 'customerAdvert' : 'storeProduct',
      status: 'active',
      subscriptionCycle,
      subscriptionStatus: 'active',
      verifiedAmount: 0,
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
      ownerEmail: profileContact.email,
      cluster: values.cluster,
      category: values.category,
      description: values.shortDescription.trim(),
      longDescription: values.longDescription.trim(),
      imageUrl: media[0]?.url ?? fallbackImage,
      media,
      address: values.address.trim(),
      sku: `UC-${slugify(values.businessName)}`,
      stockQuantity:
        values.listingType === 'product' && !isCustomerAdvert && Number.isFinite(stockQuantity)
          ? Math.max(0, stockQuantity)
          : 0,
      reorderLevel:
        values.listingType === 'product' && !isCustomerAdvert && Number.isFinite(reorderLevel)
          ? Math.max(1, reorderLevel)
          : 0,
      price: Number.isFinite(price) ? price : 0,
      priceLabel: isCustomerAdvert
        ? 'Advertised price'
        : values.listingType === 'product'
          ? 'Price'
          : 'Discuss in chat',
      responseTime: isCustomerAdvert
        ? 'Contact advertiser directly'
        : values.listingType === 'product'
          ? 'Delivered today'
          : 'Chat to discuss',
      verified: sellerAccessEnabled && !securitySettings.requireManualListingApproval,
      riverParkVerified: sellerAccessEnabled,
      services:
        serviceList.length > 0
          ? serviceList
          : values.listingType === 'product'
            ? ['Fast pickup']
            : ['On-demand support'],
      tags: [
        'New listing',
        values.category,
        ...(values.condition ? [`Condition: ${values.condition}`] : []),
        ...(isCustomerAdvert
          ? ['Customer advertisement', 'Customer account advert', 'Advertiser']
          : ['Store owner', 'Seller portal listing', 'Free listing']),
      ],
      contact: {
        phone: profileContact.phone,
        email: profileContact.email,
        ...(profileContact.whatsapp ? { whatsapp: profileContact.whatsapp } : {}),
        ...(profileContact.website ? { website: profileContact.website } : {}),
        ...(profileContact.instagram ? { instagram: profileContact.instagram } : {}),
        ...(profileContact.facebook ? { facebook: profileContact.facebook } : {}),
        ...(profileContact.x ? { x: profileContact.x } : {}),
        ...(profileContact.tiktok ? { tiktok: profileContact.tiktok } : {}),
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
      owner?.role === 'businessOwner' ? 'owner' : 'system',
      'Listing created',
      `${businessForSave.name} was submitted as a ${businessForSave.listingType} listing for admin review.`,
    );

    appendEmailLog({
      businessId: businessForSave.id,
      recipientType: 'owner',
      recipientName: businessForSave.ownerName,
      recipientEmail: businessForSave.ownerEmail ?? profileContact.email,
      subject: `View2Connect listing review started for ${businessForSave.name}`,
      body: individualSeller
        ? `We received your advertisement. Customer care must approve it before it appears on Home. Buyers will contact you directly.`
        : `We received your store listing. Customer care will review the image, category, price, and short description before it appears publicly. Listing is free.`,
    });

    return businessForSave;
  };

  const createCentralCatalogProduct = async (
    values: CentralCatalogProductValues,
    managedOwner?: AppUser,
    adminPin?: string,
  ) => {
    const createdAt = new Date().toISOString();
    const managedProfile = managedOwner ? getOwnerBusinessProfile(managedOwner) : undefined;
    const catalogOwnerEmail = managedOwner?.email ?? 'catalog@view2connect.ng';
    const catalogOwnerUserId = managedOwner?.id;
    const matchingCatalogProduct = businesses.find(
      (business) =>
        business.ownerEmail === catalogOwnerEmail &&
        business.name.trim().toLowerCase() === values.name.trim().toLowerCase(),
    );
    const catalogId = matchingCatalogProduct?.id ?? `catalog-${Date.now()}`;
    const fallbackImage =
      values.image || fallbackImageForListing('product', values.category);
    const media = buildBusinessMedia({
      baseId: catalogId,
      coverImage: values.image,
      galleryImages: '',
      galleryVideos: '',
      fallbackImage,
    });
    const catalogProduct: Business = {
      id: catalogId,
      estateId: estates[0]?.id ?? currentEstateId,
      listingType: 'product',
      listingSource: managedOwner ? 'sellerPortal' : 'adminCatalog',
      listingAudience: 'storeProduct',
      status: managedOwner ? 'active' : 'archived',
      subscriptionCycle: 'monthly',
      subscriptionStatus: managedProfile?.subscriptionStatus ?? 'active',
      verifiedAmount: 0,
      subscriptionItemCount: 0,
      name: values.name.trim(),
      ownerName: managedOwner?.fullName ?? 'View2Connect Catalog',
      ...(catalogOwnerUserId ? { ownerUserId: catalogOwnerUserId } : {}),
      ownerEmail: catalogOwnerEmail,
      cluster: managedOwner?.businessCluster ?? riverParkClusters[0],
      category: values.category,
      description: values.description.trim(),
      longDescription: values.description.trim(),
      imageUrl: media[0]?.url ?? fallbackImage,
      media,
      address: managedProfile?.address || managedOwner?.businessCluster || 'Nigeria',
      sku:
        values.hasBarcode && values.barcode.trim()
          ? values.barcode.trim()
          : `CAT-${slugify(values.name)}`,
      stockQuantity: 0,
      reorderLevel: 1,
      price: Number.parseFloat(values.price) || 0,
      priceLabel: 'Catalog price',
      responseTime: 'Available from participating stores',
      verified: Boolean(managedOwner?.riverParkVerified),
      riverParkVerified: Boolean(managedOwner?.riverParkVerified),
      services: [],
      tags: [
        managedOwner ? 'Admin managed catalog' : 'Central catalog',
        values.category,
        ...(values.hasSize && values.size.trim()
          ? [`Size: ${values.size.trim()}`]
          : []),
      ],
      contact: {
        phone: managedProfile?.phone ?? managedOwner?.phoneNumber ?? '',
        email: managedProfile?.email ?? catalogOwnerEmail,
      },
      createdAt: matchingCatalogProduct?.createdAt ?? createdAt,
      updatedAt: createdAt,
    };
    let productForSave = isSupabaseConfigured
      ? await uploadBusinessMediaToSupabase(catalogProduct)
      : catalogProduct;

    if (isSupabaseConfigured) {
      if (!/^\d{4}$/.test(adminPin ?? '')) {
        throw new Error('Enter the 4 digit Admin PIN before saving this catalog product.');
      }
      productForSave = await saveAdminCatalogProductToSupabase(productForSave, adminPin!);
    }

    setBusinesses((currentBusinesses) => [
      productForSave,
      ...currentBusinesses.filter(
        (business) =>
          !(
            business.ownerEmail === catalogOwnerEmail &&
            business.name.trim().toLowerCase() === values.name.trim().toLowerCase()
          ),
      ),
    ]);
    appendAuditLog(
      'View2Connect Owner',
      'owner',
      managedOwner ? 'Managed store product created' : 'Central catalog product created',
      managedOwner
        ? `${productForSave.name} was added to ${managedOwner.businessName ?? managedOwner.fullName} with seller permission.`
        : `${productForSave.name} was added to the owner-managed catalog.`,
    );

    return productForSave;
  };

  const updateOwnerBusinessProfile = async (
    owner: AppUser,
    values: OwnerBusinessProfileValues,
    actorName = owner.fullName,
    actorRole: AuditActorRole = 'owner',
  ) => {
    const ownerKeys = [owner.id, owner.email, owner.fullName, owner.businessName]
      .map((ownerKey) => ownerKey?.trim().toLowerCase())
      .filter((ownerKey): ownerKey is string => Boolean(ownerKey));
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
      bio: values.bio.trim(),
      profileImage: values.profileImage.trim(),
      phone: values.phone.trim() || owner.phoneNumber,
      whatsapp: values.whatsapp.trim(),
      email: profileEmail || owner.email,
      website: values.website.trim(),
      instagram: values.instagram.trim(),
      facebook: values.facebook.trim(),
      x: values.x.trim(),
      tiktok: values.tiktok.trim(),
      address: values.address.trim() || owner.businessCluster || '',
      openingTime: values.openingTime?.trim() ?? '',
      closingTime: values.closingTime?.trim() ?? '',
      openDays: values.openDays ?? [],
      coverImage: values.coverImage.trim(),
      galleryImages: values.galleryImages.trim(),
      galleryVideos: values.galleryVideos.trim(),
      riverParkVerified: existingProfile?.riverParkVerified ?? owner.riverParkVerified ?? false,
      updatedAt,
    };

    if (isSupabaseConfigured) {
      await saveOwnerBusinessProfileToSupabase(nextProfile);
    }

    setOwnerBusinessProfiles((currentProfiles) => {
      const existingIndex = currentProfiles.findIndex(
        (profile) =>
          [
            profile.ownerUserId,
            profile.accountEmail,
            profile.email,
            profile.accountName,
            profile.ownerName,
          ]
            .map((ownerKey) => ownerKey?.trim().toLowerCase())
            .some((ownerKey) => Boolean(ownerKey && ownerKeys.includes(ownerKey))),
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
        const matchesOwner = [business.ownerUserId, business.ownerEmail, business.ownerName]
          .map((ownerKey) => ownerKey?.trim().toLowerCase())
          .some((ownerKey) => Boolean(ownerKey && ownerKeys.includes(ownerKey)));

        if (!matchesOwner) {
          return business;
        }

        const nextOwnerEmail = nextProfile.email || business.ownerEmail;

        const nextBusiness = {
          ...business,
          ownerName: nextProfile.ownerName || business.ownerName,
          riverParkVerified: nextProfile.riverParkVerified ?? false,
          ...(nextOwnerEmail ? { ownerEmail: nextOwnerEmail } : {}),
          address: nextProfile.address || business.address,
          contact: {
            phone: nextProfile.phone || business.contact.phone,
            email: nextProfile.email || business.contact.email,
            ...(nextProfile.whatsapp ? { whatsapp: nextProfile.whatsapp } : {}),
            ...(nextProfile.website ? { website: nextProfile.website } : {}),
            ...(nextProfile.instagram ? { instagram: nextProfile.instagram } : {}),
            ...(nextProfile.facebook ? { facebook: nextProfile.facebook } : {}),
            ...(nextProfile.x ? { x: nextProfile.x } : {}),
            ...(nextProfile.tiktok ? { tiktok: nextProfile.tiktok } : {}),
          },
          updatedAt,
        };

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

  const setVerifiedSellerPayoutAccount = (
    owner: AppUser,
    account: VerifiedSellerPayoutAccount,
  ) => {
    const existingProfile = getOwnerBusinessProfile(owner);


    const nextProfile: OwnerBusinessProfile = {
      ...(existingProfile ?? {
        id: owner.id,
        ownerUserId: owner.id,
        accountName: owner.businessName ?? owner.fullName,
        accountEmail: owner.email,
        ownerName: owner.fullName,
        bio: '',
        profileImage: '',
        phone: owner.phoneNumber,
        whatsapp: owner.phoneNumber,
        email: owner.email,
        website: '',
        instagram: '',
        facebook: '',
        x: '',
        tiktok: '',
        address: owner.businessCluster ?? '',
        openingTime: '',
        closingTime: '',
        openDays: [],
        coverImage: '',
        galleryImages: '',
        galleryVideos: '',
      }),
      payoutBankCode: account.bankCode,
      payoutBankName: account.bankName,
      payoutAccountNumber: account.accountNumber,
      payoutAccountName: account.accountName,
      payoutVerifiedAt: account.verifiedAt,
      updatedAt: account.verifiedAt,
    };

    setOwnerBusinessProfiles((currentProfiles) => [
      nextProfile,
      ...currentProfiles.filter(
        (profile) =>
          profile.ownerUserId !== owner.id && profile.accountEmail !== owner.email,
      ),
    ]);

    appendAuditLog(
      owner.fullName,
      'businessOwner',
      'Seller payout account verified',
      `${account.bankName} account ending ${account.accountNumber.slice(-4)} was verified through Flutterwave.`,
    );
  };

  const getBusinessById = (businessId: string) =>
    businesses.find((business) => business.id === businessId);

  const getOrderById = (orderId: string) => orders.find((order) => order.id === orderId);

  const getOrdersForUser = (userId: string) =>
    orders
      .filter(
        (order) =>
          order.userId === userId &&
          !(order.paymentMethod === 'flutterwave' && order.paymentStatus === 'pending'),
      )
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
      .filter(
        (order) =>
          !(order.paymentMethod === 'flutterwave' && order.paymentStatus === 'pending') &&
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

  const syncCustomerAccountData = async (accountUser?: AppUser | null) => {
    if (!accountUser) {
      setCartItems([]);
      return;
    }

    if (!isSupabaseConfigured) {
      return;
    }

    const [remoteCartItems, remoteDeliveryLocation] = await Promise.all([
      fetchCustomerCartFromSupabase(accountUser.id).catch(() => undefined),
      fetchCustomerDeliveryLocationFromSupabase(accountUser.id).catch(() => undefined),
    ]);

    if (remoteCartItems) {
      setCartItems(remoteCartItems);
    }

    if (remoteDeliveryLocation) {
      setCustomerDeliveryLocations((currentLocations) => [
        remoteDeliveryLocation,
        ...currentLocations.filter((location) => location.userId !== accountUser.id),
      ]);
    }
  };

  const getCustomerDeliveryLocation = (accountUser?: AppUser | null) => {
    if (!accountUser) {
      return undefined;
    }

    return customerDeliveryLocations.find((location) => location.userId === accountUser.id);
  };

  const saveCustomerDeliveryLocation = async (
    accountUser: AppUser,
    location: DeliveryLocation,
  ) => {
    const nextLocation = {
      ...location,
      userId: accountUser.id,
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      await saveCustomerDeliveryLocationToSupabase(nextLocation);
    }

    setCustomerDeliveryLocations((currentLocations) => [
      nextLocation,
      ...currentLocations.filter((currentLocation) => currentLocation.userId !== accountUser.id),
    ]);

    return nextLocation;
  };

  const getAvailableAccountBalanceForUser = (accountUser: AppUser) => {
    const customerWalletBeforeWithdrawals = getAccountWalletBalance(
      accountUser,
      getOrdersForUser(accountUser.id),
      subscriptionPayments.filter((payment) => payment.ownerUserId === accountUser.id),
      dynamicDepositAccounts.filter((deposit) => deposit.userId === accountUser.id),
    );
    const ownerProfile = getOwnerBusinessProfile(accountUser);
    const ownerKeys = new Set(getUserOwnerKeys(accountUser, ownerProfile));

    businesses
      .filter((business) => getBusinessOwnerKeys(business).some((key) => ownerKeys.has(key)))
      .forEach((business) => {
        getBusinessOwnerKeys(business).forEach((key) => ownerKeys.add(key));
      });

    const releasedSellerEarnings = getOrdersForOwner(accountUser.id, accountUser).reduce(
      (total, order) => {
        if (order.paymentStatus !== 'paid' || order.status !== 'delivered') {
          return total;
        }

        const sellerSubtotal = order.items
          .filter((item) =>
            [item.ownerUserId, item.ownerName]
              .map(normalizeOwnerKey)
              .some((key) => Boolean(key && ownerKeys.has(key))),
          )
          .reduce((itemTotal, item) => itemTotal + item.lineTotal, 0);
        const sellerPackingShare =
          order.subtotal > 0
            ? (order.sellerPackingSupport * sellerSubtotal) / order.subtotal
            : 0;

        return total + sellerSubtotal + sellerPackingShare;
      },
      0,
    );
    const committedWithdrawals = getCommittedWithdrawalTotal(withdrawalRequests, accountUser);

    return Math.max(
      0,
      customerWalletBeforeWithdrawals + releasedSellerEarnings - committedWithdrawals,
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

  const updateBusinessListing = async (
    businessId: string,
    values: {
      name: string;
      description: string;
      longDescription: string;
      category?: string;
      address?: string;
      imageUrl?: string;
      services?: string[];
      sku?: string;
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
    const requestedImageUrl = values.imageUrl?.trim();
    let replacedPrimaryImage = false;
    const nextMedia = requestedImageUrl
      ? business.media.map((item) => {
          if (item.type !== 'image' || replacedPrimaryImage) {
            return item;
          }
          replacedPrimaryImage = true;
          return { ...item, url: requestedImageUrl };
        })
      : business.media;
    if (requestedImageUrl && !replacedPrimaryImage) {
      nextMedia.unshift({
        id: `${business.id}-image-${Date.now()}`,
        type: 'image',
        url: requestedImageUrl,
        label: 'Cover image',
      });
    }
    const nextBusiness: Business = {
      ...business,
      name,
      description,
      longDescription,
      category: values.category ?? business.category,
      address: values.address?.trim() || business.address,
      imageUrl: requestedImageUrl || business.imageUrl,
      media: nextMedia,
      services: values.services ?? business.services,
      ...(values.sku?.trim() ? { sku: values.sku.trim() } : {}),
      ...(isProduct
        ? {
            price: Math.round(productPrice),
            stockQuantity: Math.max(0, Math.floor(productStockQuantity)),
            reorderLevel: Math.max(1, Math.floor(productReorderLevel)),
          }
        : {}),
      updatedAt,
    };

    if (isSupabaseConfigured) {
      await saveBusinessToSupabase(nextBusiness);
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((currentBusiness) =>
        currentBusiness.id === businessId ? nextBusiness : currentBusiness,
      ),
    );

    appendAuditLog(
      owner?.fullName ?? nextBusiness.ownerName,
      owner ? 'businessOwner' : 'system',
      'Listing updated',
      `${nextBusiness.name} listing information was updated.`,
    );

    return nextBusiness;
  };

  const deleteOwnedBusinessListing = async (businessId: string, owner?: AppUser | null) => {
    const business = getBusinessById(businessId);

    if (!business) {
      throw new Error('This listing could not be found.');
    }

    if (!isBusinessOwnedByUser(business, owner)) {
      throw new Error('You can only delete listings that belong to your business account.');
    }

    const deletedAt = new Date().toISOString();

    if (isSupabaseConfigured) {
      const hiddenBusiness: Business = {
        ...business,
        status: 'archived',
        verified: false,
        updatedAt: deletedAt,
      };

      try {
        await deleteBusinessFromSupabase(businessId);
      } catch {
        await saveBusinessToSupabase(hiddenBusiness);
      }
    }

    setDeletedBusinessIds((currentIds) =>
      currentIds.includes(businessId) ? currentIds : [...currentIds, businessId],
    );
    setBusinesses((currentBusinesses) =>
      currentBusinesses.filter((currentBusiness) => currentBusiness.id !== businessId),
    );
    setCartItems((currentCartItems) =>
      currentCartItems.filter((item) => item.businessId !== businessId),
    );

    appendAuditLog(
      owner?.fullName ?? business.ownerName,
      'businessOwner',
      'Listing deleted',
      `${business.name} was deleted by the seller.`,
    );
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

    if (MINIMUM_ADD_FUNDS_DEPOSIT > 0 && roundedAmount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
      throw new Error(
        `Add funds must be higher than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)}.`,
      );
    }

    const deposit = await createFlutterwaveDynamicDepositAccount(accountUser, roundedAmount);

    setDynamicDepositAccounts((currentDeposits) => mergeNewestById(currentDeposits, [deposit]));

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

    if (MINIMUM_ADD_FUNDS_DEPOSIT > 0 && roundedAmount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
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
      title: 'View2Connect portfolio top-up',
      description: 'Add money to your View2Connect portfolio.',
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

  const saveVirtualAccountRecord = async (account: VirtualAccount) => {
    setVirtualAccounts((currentAccounts) =>
      mergeNewestById(
        currentAccounts.filter(
          (currentAccount) => currentAccount.ownerUserId !== account.ownerUserId,
        ),
        [account],
      ),
    );
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

    await saveVirtualAccountRecord(account);

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

    const safeDocumentName = (values.idDocumentName || 'id-document')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'id-document';
    const idDocumentPath = values.idDocumentUri.startsWith('seller-identity/')
      ? values.idDocumentUri
      : await uploadPrivateDocumentToSupabaseStorage(
          values.idDocumentUri,
          `seller-identity/${owner.id}/${safeDocumentName}-${Date.now()}`,
        );
    const account = await createFlutterwaveVirtualAccount(owner, {
      kycType: values.kycType,
      kycNumber,
      purpose: 'withdrawal',
      idDocumentPath,
      ...(values.idDocumentName ? { idDocumentName: values.idDocumentName } : {}),
    });
    const accountWithDocument: VirtualAccount = {
      ...account,
      idDocumentUri: idDocumentPath,
      ...(values.idDocumentName?.trim() ? { idDocumentName: values.idDocumentName.trim() } : {}),
    };

    await saveVirtualAccountRecord(accountWithDocument);

    appendNotification({
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: owner.role,
      title: 'Withdrawal account verified',
      body: `Flutterwave verified ${accountWithDocument.kycReference ?? 'your KYC'} with your uploaded ID document.`,
      contextType: 'general',
      contextId: accountWithDocument.id,
      createdAt: accountWithDocument.createdAt,
    });

    appendAuditLog(
      owner.fullName,
      owner.role === 'businessOwner' ? 'owner' : 'system',
      'Withdrawal KYC verified',
      `${accountWithDocument.ownerName} verified ${accountWithDocument.kycReference ?? 'KYC'} with Flutterwave and uploaded ID.`,
    );

    return accountWithDocument;
  };

  const requestWithdrawal = async (
    owner: AppUser,
    values: {
      amount: number;
      bankName: string;
      accountNumber: string;
      accountName?: string;
    },
  ) => {
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

    const payoutProfile = getOwnerBusinessProfile(owner);

    if (
      !payoutProfile?.payoutVerifiedAt ||
      !payoutProfile.payoutBankName ||
      !payoutProfile.payoutAccountNumber ||
      !payoutProfile.payoutAccountName
    ) {
      throw new Error('Verify and save a payout bank account in your seller profile first.');
    }

    if (
      payoutProfile.payoutBankName !== bankName ||
      payoutProfile.payoutAccountNumber !== accountNumber ||
      payoutProfile.payoutAccountName.toLowerCase() !== accountName.toLowerCase()
    ) {
      throw new Error('Use the verified payout account saved in your seller profile.');
    }

    if (amount > getAvailableAccountBalanceForUser(owner)) {
      throw new Error('Withdrawal amount is higher than your available delivered earnings.');
    }

    if (isSupabaseConfigured) {
      const savedWithdrawal = await requestSellerWithdrawalFromSupabase(amount);
      setWithdrawalRequests((currentWithdrawals) => [
        savedWithdrawal,
        ...currentWithdrawals.filter((item) => item.id !== savedWithdrawal.id),
      ]);
      return savedWithdrawal;
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
      kycType: 'bvn',
      kycLast4: payoutProfile.payoutAccountNumber.slice(-4),
      kycReference: 'Payout account verified by Flutterwave',
      amount,
      status: 'pending',
      createdAt,
    };

    setWithdrawalRequests((currentWithdrawals) => [withdrawal, ...currentWithdrawals]);

    appendNotification({
      userId: owner.id,
      userName: owner.fullName,
      recipientEmail: owner.email,
      audience: owner.role,
      title: 'Withdrawal submitted',
      body: `${formatCurrency(amount)} is pending payout review for ${withdrawal.bankName} ${withdrawal.accountNumber}.`,
      contextType: 'general',
      contextId: withdrawal.id,
      createdAt,
    });

    appendEmailLog({
      recipientType: owner.role === 'businessOwner' ? 'owner' : 'buyer',
      recipientName: owner.fullName,
      recipientEmail: owner.email,
      subject: 'View2Connect withdrawal submitted',
      body: `${formatCurrency(amount)} is pending payout review for ${withdrawal.bankName} ${withdrawal.accountNumber}.`,
    });

    appendAuditLog(
      owner.fullName,
      owner.role === 'businessOwner' ? 'owner' : 'system',
      'Withdrawal submitted',
      `${withdrawal.ownerName} requested ${amount} to ${withdrawal.bankName}.`,
    );

    return withdrawal;
  };

  const updateWithdrawalStatus = async (
    withdrawalId: string,
    status: Exclude<WithdrawalRequest['status'], 'pending'>,
    providerReference?: string,
    failureReason?: string,
    actorName = 'View2Connect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (actorRole !== 'owner') {
      throw new Error('Only the owner admin can process seller withdrawals.');
    }

    const existing = withdrawalRequests.find((item) => item.id === withdrawalId);
    if (!existing) {
      throw new Error('Withdrawal request was not found.');
    }

    if (status === 'paid' && !providerReference?.trim()) {
      throw new Error('Enter the payout provider reference before marking this withdrawal paid.');
    }

    const updatedAt = new Date().toISOString();
    const nextWithdrawal = isSupabaseConfigured
      ? await updateWithdrawalStatusInSupabase(
          withdrawalId,
          status,
          providerReference,
          failureReason,
        )
      : {
          ...existing,
          status,
          updatedAt,
          ...(providerReference?.trim()
            ? { providerReference: providerReference.trim() }
            : {}),
          ...(failureReason?.trim() ? { failureReason: failureReason.trim() } : {}),
        };

    setWithdrawalRequests((currentWithdrawals) =>
      currentWithdrawals.map((item) =>
        item.id === withdrawalId ? nextWithdrawal : item,
      ),
    );
    appendAuditLog(
      actorName,
      actorRole,
      `Withdrawal ${status}`,
      `${existing.ownerName}'s ${formatCurrency(existing.amount)} withdrawal was marked ${status}.`,
    );

    return nextWithdrawal;
  };

  const getAvailableStock = (businessId: string) => {
    const business = getBusinessById(businessId);

    if (!business || !isStoreOwnerProduct(business, ownerBusinessProfiles)) {
      return 0;
    }

    return Math.max(0, business.stockQuantity ?? 0);
  };

  const commitCartItems = (nextItems: CartItem[]) => {
    cartItemsRef.current = nextItems;
    setCartItems(nextItems);
  };

  const queueCartMutation = (operation: () => Promise<void>) => {
    const queuedOperation = cartMutationQueueRef.current
      .catch(() => undefined)
      .then(operation);
    cartMutationQueueRef.current = queuedOperation.catch(() => undefined);
    return queuedOperation;
  };

  const addToCart = (businessId: string, accountUser?: AppUser | null) =>
    queueCartMutation(async () => {
      const business = getBusinessById(businessId);

      if (!business || !isStoreOwnerProduct(business, ownerBusinessProfiles)) {
        throw new Error('This product is no longer available for purchase.');
      }

      const maxStock = getAvailableStock(businessId);

      if (maxStock <= 0) {
        throw new Error(`${business.name} is currently out of stock.`);
      }

      const currentCartItems = cartItemsRef.current;
      const existingItem = currentCartItems.find((item) => item.businessId === businessId);

      if (existingItem?.quantity && existingItem.quantity >= maxStock) {
        throw new Error(`Only ${maxStock} ${business.name} item${maxStock === 1 ? '' : 's'} available.`);
      }

      const nextItem: CartItem = {
        ...(existingItem ?? { businessId, quantity: 0 }),
        quantity: (existingItem?.quantity ?? 0) + 1,
        ...(accountUser ? { userId: accountUser.id } : {}),
        updatedAt: new Date().toISOString(),
      };

      if (accountUser && isSupabaseConfigured) {
        await saveCartItemToSupabase(accountUser.id, nextItem);
      }

      commitCartItems(
        existingItem
          ? currentCartItems.map((item) => (item.businessId === businessId ? nextItem : item))
          : [nextItem, ...currentCartItems],
      );
    });

  const removeFromCart = (businessId: string, accountUser?: AppUser | null) =>
    queueCartMutation(async () => {
      if (accountUser && isSupabaseConfigured) {
        await deleteCartItemFromSupabase(accountUser.id, businessId);
      }

      commitCartItems(
        cartItemsRef.current.filter((item) => item.businessId !== businessId),
      );
    });

  const updateCartQuantity = (
    businessId: string,
    quantity: number,
    accountUser?: AppUser | null,
  ) =>
    queueCartMutation(async () => {
      const currentCartItems = cartItemsRef.current;
      const existingItem = currentCartItems.find((item) => item.businessId === businessId);

      if (!existingItem) {
        return;
      }

      const maxStock = getAvailableStock(businessId);
      const nextQuantity = Math.min(quantity, maxStock);

      if (nextQuantity <= 0) {
        if (accountUser && isSupabaseConfigured) {
          await deleteCartItemFromSupabase(accountUser.id, businessId);
        }
        commitCartItems(currentCartItems.filter((item) => item.businessId !== businessId));
        return;
      }

      const nextItem: CartItem = {
        ...existingItem,
        quantity: nextQuantity,
        ...(accountUser ? { userId: accountUser.id } : {}),
        updatedAt: new Date().toISOString(),
      };

      if (accountUser && isSupabaseConfigured) {
        await saveCartItemToSupabase(accountUser.id, nextItem);
      }

      commitCartItems(
        currentCartItems.map((item) => (item.businessId === businessId ? nextItem : item)),
      );
    });

  const clearCart = (accountUser?: AppUser | null) =>
    queueCartMutation(async () => {
      if (accountUser && isSupabaseConfigured) {
        await clearCustomerCartInSupabase(accountUser.id);
      }
      commitCartItems([]);
    });

  const getChatMessages = (businessId: string) => chatThreads[businessId] ?? [];

  const getChatConversations = (currentUser?: AppUser | null) =>
    businesses
      .map((business) => {
        const messages = getChatMessages(business.id);
        const visibleMessages = currentUser
          ? messages.filter(
              (message) =>
                message.senderUserId === currentUser.id ||
                message.recipientUserId === currentUser.id ||
                (!message.senderUserId && message.senderName === currentUser.fullName) ||
                business.ownerUserId === currentUser.id,
            )
          : messages;
        const lastMessage = visibleMessages[visibleMessages.length - 1];

        if (visibleMessages.length === 0 || !lastMessage) {
          return null;
        }

        return {
          business,
          messages: visibleMessages,
          lastMessage,
        } satisfies ChatConversation;
      })
      .filter((conversation): conversation is ChatConversation => conversation !== null)
      .sort(
        (leftConversation, rightConversation) =>
          new Date(rightConversation.lastMessage.createdAt).getTime() -
          new Date(leftConversation.lastMessage.createdAt).getTime(),
      );

  const sendChatMessage = async (
    businessId: string,
    sender: AppUser | string,
    text: string,
    attachments: ChatMessage['attachments'] = [],
  ) => {
    const trimmedText = text.trim();
    const business = getBusinessById(businessId);
    const hasAttachments = attachments.length > 0;

    if ((!trimmedText && !hasAttachments) || !business) {
      return;
    }

    const createdAt = new Date().toISOString();
    const senderName = typeof sender === 'string' ? sender : sender.fullName;
    const senderUserId = typeof sender === 'string' ? undefined : sender.id;
    const messageId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const senderType: ChatMessage['senderType'] =
      senderUserId && senderUserId === business.ownerUserId ? 'owner' : 'resident';
    const existingMessages = chatThreads[businessId] ?? [];
    const recipientUserId =
      senderType === 'owner'
        ? [...existingMessages]
            .reverse()
            .find((message) => message.senderUserId && message.senderUserId !== senderUserId)
            ?.senderUserId
        : business.ownerUserId;
    const uploadedAttachments = await Promise.all(
      attachments.map((attachment) =>
        uploadChatAttachmentToSupabaseStorage(
          attachment,
          messageId,
          senderUserId ?? senderName,
        ),
      ),
    );
    const customerMessage: ChatMessage = {
      id: messageId,
      businessId,
      ...(senderUserId ? { senderUserId } : {}),
      ...(recipientUserId && recipientUserId !== senderUserId ? { recipientUserId } : {}),
      senderName,
      senderType,
      text: trimmedText || (uploadedAttachments.length > 1 ? 'Sent attachments' : 'Sent an attachment'),
      ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
      createdAt,
    };

    if (isSupabaseConfigured) {
      await saveChatMessageToSupabase(customerMessage);
    }

    setChatThreads((currentThreads) => ({
      ...currentThreads,
      [businessId]: [...(currentThreads[businessId] ?? []), customerMessage],
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
    if (isSupabaseConfigured) {
      void clearCustomerCartInSupabase(order.userId).catch(() => undefined);
    }
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

    if (isSupabaseConfigured) {
      throw new Error(
        'Portfolio checkout is temporarily unavailable while the secure wallet ledger is activated. Use Flutterwave checkout.',
      );
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

    const unavailableEntries = cartEntries.filter(
      (entry) => !isStoreOwnerProduct(entry.business, ownerBusinessProfiles),
    );
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

    const selfOwnedEntries = cartEntries.filter((entry) =>
      isBusinessOwnedByUser(entry.business, customer),
    );

    if (selfOwnedEntries.length > 0) {
      throw new Error(
        `${selfOwnedEntries.map((entry) => entry.business.name).join(', ')} is your own listing. Sellers cannot buy items they posted.`,
      );
    }

    const createdAt = new Date().toISOString();
    const subtotal = cartEntries.reduce((total, entry) => total + entry.lineTotal, 0);
    const sellerPackingSupport = calculateSellerPackingSupport(subtotal, securitySettings);
    const serviceFee = calculateProgressiveVat(subtotal, securitySettings);
    const deliveryFee = 0;
    const totalAmount = subtotal + sellerPackingSupport + serviceFee + deliveryFee;
    const walletBalance = getAvailableAccountBalanceForUser(customer);

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
      deliveryContactPhone: payload.deliveryContactPhone.trim(),
      ...(payload.deliveryLocation ? { deliveryLocation: payload.deliveryLocation } : {}),
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
      sellerPackingSupport,
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

    const unavailableEntries = cartEntries.filter(
      (entry) => !isStoreOwnerProduct(entry.business, ownerBusinessProfiles),
    );
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

    const selfOwnedEntries = cartEntries.filter((entry) =>
      isBusinessOwnedByUser(entry.business, customer),
    );

    if (selfOwnedEntries.length > 0) {
      throw new Error(
        `${selfOwnedEntries.map((entry) => entry.business.name).join(', ')} is your own listing. Sellers cannot buy items they posted.`,
      );
    }

    const order = await createServerMarketplaceOrder({
      items: cartEntries.map((entry) => ({
        businessId: entry.business.id,
        quantity: entry.quantity,
      })),
      deliveryAddress: payload.deliveryAddress,
      deliveryCluster: payload.deliveryCluster,
      deliveryContactPhone: payload.deliveryContactPhone,
      ...(payload.deliveryLocation ? { deliveryLocation: payload.deliveryLocation } : {}),
      ...(payload.note ? { note: payload.note } : {}),
      paymentMethod: 'flutterwave',
    });
    const session = await createFlutterwaveCheckoutSession({
      reference: order.id,
      amount: order.totalAmount,
      customerName: customer.fullName,
      customerEmail: customer.email,
      customerPhone: payload.deliveryContactPhone.trim() || customer.phoneNumber,
      title: 'View2Connect order payment',
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

  const toggleBusinessVerification = async (
    businessId: string,
    actorName = 'View2Connect Owner',
    actorRole: AuditActorRole = 'owner',
    adminPin = '',
  ) => {
    if (!canVerifyListings(actorRole)) {
      return;
    }

    const business = getBusinessById(businessId);
    if (!business) {
      throw new Error('This listing could not be found.');
    }

    const nextVerified = !business?.verified;
    const updatedAt = new Date().toISOString();
    let nextBusiness: Business = {
      ...business,
      status: 'active',
      verified: nextVerified,
      subscriptionCycle: business.subscriptionCycle ?? 'monthly',
      subscriptionItemCount: Math.max(1, business.subscriptionItemCount ?? 1),
      updatedAt,
    };

    if (isSupabaseConfigured) {
      if (!/^\d{4}$/.test(adminPin.trim())) {
        throw new Error('Enter the active 4 digit Admin PIN.');
      }
      nextBusiness = await setListingVerificationInSupabase({
        businessId,
        verified: nextVerified,
        adminPin: adminPin.trim(),
      });
    } else if (adminPin.trim() !== orderProgressSettings.code) {
      throw new Error('Wrong PIN. Enter the active owner Admin PIN.');
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((currentBusiness) =>
        currentBusiness.id === businessId ? nextBusiness : currentBusiness,
      ),
    );

    appendAuditLog(
      actorName,
      actorRole,
      nextVerified ? 'Listing verified' : 'Listing verification revoked',
      `${business.name} was marked ${nextVerified ? 'verified' : 'pending'}.`,
    );

    if (!isSupabaseConfigured && business.ownerUserId) {
      appendNotification({
        userId: business.ownerUserId,
        userName: business.ownerName,
        recipientEmail: business.ownerEmail ?? business.contact.email,
        audience: 'businessOwner',
        title: nextVerified ? 'Listing approved' : 'Listing returned to pending',
        body: nextVerified
          ? `${business.name} has been approved and can now appear in View2Connect.`
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
          ? `${business.name} was approved. It can now appear in View2Connect.`
          : `Customer care moved ${business.name} back to pending. Please contact support for next steps.`,
      });
    }
  };

  const restockBusinessStock = async (
    businessId: string,
    quantity: number,
    actorName = 'View2Connect Owner',
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

    const nextBusiness: Business = {
      ...business,
      stockQuantity: Math.max(0, (business.stockQuantity ?? 0) + quantity),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      await saveBusinessToSupabase(nextBusiness);
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((item) => (item.id === businessId ? nextBusiness : item)),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Inventory restocked',
      `${quantity} units were added to ${business.name}.`,
    );
  };

  const updateBusinessReorderLevel = async (
    businessId: string,
    reorderLevel: number,
    actorName = 'View2Connect Owner',
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

    const nextBusiness: Business = {
      ...business,
      reorderLevel,
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      await saveBusinessToSupabase(nextBusiness);
    }

    setBusinesses((currentBusinesses) =>
      currentBusinesses.map((item) => (item.id === businessId ? nextBusiness : item)),
    );

    appendAuditLog(
      actorName,
      actorRole,
      'Reorder level updated',
      `${business.name} reorder level was set to ${reorderLevel}.`,
    );
  };

  const syncOrderProgressSettings = async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    const status = await fetchAdminActionPinStatus();
    setOrderProgressSettings({
      code: status.configured ? 'configured' : '',
      updatedAt: status.updatedAt,
    });
  };

  const verifyOrderProgressCode = async (code: string) => {
    if (isSupabaseConfigured) {
      return verifyAdminActionPinInSupabase(code.trim());
    }

    return Boolean(orderProgressSettings.code && code.trim() === orderProgressSettings.code);
  };

  const updateOrderProgressCode = async (
    code: string,
    actorName = 'View2Connect Owner',
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

    if (isSupabaseConfigured) {
      await saveAdminActionPin(trimmedCode);
    }

    setOrderProgressSettings({
      code: isSupabaseConfigured ? 'configured' : trimmedCode,
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
    actorName = 'View2Connect Owner',
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
    actorName = 'View2Connect Owner',
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

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    actorName = 'View2Connect Owner',
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

    if (!isSupabaseConfigured && !orderProgressSettings.code) {
      throw new Error('Create a 4 digit admin PIN before changing delivery progress.');
    }

    if (!isSupabaseConfigured && progressCode.trim() !== orderProgressSettings.code) {
      throw new Error('Enter the active 4 digit admin PIN before confirming progress.');
    }

    if (isSupabaseConfigured) {
      await updateOrderStatusInSupabase(orderId, status);
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

  const markSellerOrderReady = async (orderId: string, owner: AppUser) => {
    if (owner.role !== 'businessOwner') {
      throw new Error('Only a store owner can prepare seller items for dispatch.');
    }

    const order = getOrderById(orderId);
    if (!order || !getOrdersForOwner(owner.id, owner).some((item) => item.id === orderId)) {
      throw new Error('This order does not contain items from your store.');
    }
    if (order.paymentStatus !== 'paid') {
      throw new Error('Wait for confirmed payment before preparing this order.');
    }

    const allSellersReady = isSupabaseConfigured
      ? await markSellerOrderReadyInSupabase(orderId)
      : true;
    const updatedAt = new Date().toISOString();

    if (allSellersReady) {
      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === orderId && currentOrder.status === 'placed'
            ? {
                ...currentOrder,
                status: 'packed',
                updatedAt,
                timeline: [
                  ...currentOrder.timeline,
                  buildTimelineEvent(orderId, 'packed', updatedAt),
                ],
              }
            : currentOrder,
        ),
      );
    }

    appendAuditLog(
      owner.fullName,
      'businessOwner',
      'Seller items ready',
      `${owner.businessName ?? owner.fullName} marked its items in ${orderId} ready for dispatch.`,
    );

    return allSellersReady;
  };

  const updatePaymentStatus = (
    orderId: string,
    paymentStatus: PaymentStatus,
    actorName = 'View2Connect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canConfirmPayments(actorRole)) {
      return;
    }

    if (isSupabaseConfigured) {
      throw new Error(
        'Live payment status is controlled by the Flutterwave webhook. Verify or refund the transaction with Flutterwave instead of changing it manually.',
      );
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
              ? `${formatCurrency(orderBeforeUpdate.totalAmount)} was returned to your View2Connect account balance.`
              : `${formatCurrency(orderBeforeUpdate.totalAmount)} was credited to your View2Connect in-app account balance.`,
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
            body: `Your ${formatCurrency(orderBeforeUpdate.totalAmount)} refund was returned to your View2Connect in-app account balance.`,
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

  const updateSecuritySettings = async (
    patch: Partial<SecuritySettings>,
    actorName = 'View2Connect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canEditSensitiveData(actorRole)) {
      return;
    }

    const nextSettings = {
      ...defaultSecuritySettings,
      ...securitySettings,
      ...patch,
    };

    if (isSupabaseConfigured) {
      await saveSecuritySettingsToSupabase(nextSettings);
    }

    setSecuritySettings(nextSettings);

    appendAuditLog(
      actorName,
      actorRole,
      'Security settings updated',
      Object.entries(patch)
        .map(([key, value]) => `${key} -> ${String(value)}`)
        .join(', '),
    );
  };

  const deleteBusiness = async (
    businessId: string,
    actorName = 'View2Connect Owner',
    actorRole: AuditActorRole = 'owner',
  ) => {
    if (!canVerifyListings(actorRole)) {
      return;
    }

    const business = getBusinessById(businessId);
    const deletedAt = new Date().toISOString();

    if (isSupabaseConfigured && business) {
      await deleteBusinessFromSupabase(businessId);
    }

    setDeletedBusinessIds((currentIds) =>
      currentIds.includes(businessId) ? currentIds : [...currentIds, businessId],
    );
    setBusinesses((currentBusinesses) =>
      currentBusinesses.filter((currentBusiness) => currentBusiness.id !== businessId),
    );
    setCartItems((currentCartItems) =>
      currentCartItems.filter((item) => item.businessId !== businessId),
    );

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
    actorName = 'View2Connect Owner',
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
              currentBusiness.id === item.businessId &&
              isStoreOwnerProduct(currentBusiness, ownerBusinessProfiles),
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
    [businesses, cartItems, ownerBusinessProfiles],
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

  const centralCatalogProducts = useMemo(
    () =>
      businesses.filter(
        (business) =>
          business.ownerEmail === 'catalog@view2connect.ng' &&
          business.tags.includes('Central catalog'),
      ),
    [businesses],
  );

  const value = useMemo<BusinessDirectoryContextValue>(
    () => ({
      businesses,
      centralCatalogProducts,
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
      isCustomerAdvertisement: isCustomerAdvertisementForDirectory,
      isCustomerAdvertisementSource: isCustomerAdvertisementSourceForDirectory,
      isStoreOwnerListing: isStoreOwnerListingForDirectory,
      isStoreOwnerListingSource: isStoreOwnerListingSourceForDirectory,
      hasCatalogManagementAccess,
      setCatalogManagementAccess,
      markNotificationsRead,
      sendSupportMessage,
      sendSupportReply,
      deleteSupportConversation,
      deleteLatestSupportConversation,
      setCurrentEstateId,
      registerBusiness,
      createCentralCatalogProduct,
      getOwnerBusinessProfile,
      isSubscriptionExemptForUser,
      confirmOwnerSubscription,
      payOwnerSubscriptionWithAccount,
      payCustomerBenefitSubscriptionWithAccount,
      startCustomerBenefitFlutterwaveCheckout,
      startOwnerSubscriptionFlutterwaveCheckout,
      getWithdrawalsForOwner,
      getVirtualAccountForOwner,
      getDepositAccountsForUser,
      createDynamicDepositAccount,
      startAddFundsFlutterwaveCheckout,
      ensureUserVirtualAccount,
      verifyOwnerVirtualAccount,
      requestWithdrawal,
      updateWithdrawalStatus,
      notifyBusinessOwnerInspection,
      setOwnerRiverParkVerification,
      approveStoreApplicationForOwner,
      reviewStoreApplicationForOwner,
      updateOwnerBusinessProfile,
      setVerifiedSellerPayoutAccount,
      getBusinessById,
      getOrderById,
      getOrdersForUser,
      getOrdersForOwner,
      markSellerOrderReady,
      syncCustomerAccountData,
      getCustomerDeliveryLocation,
      saveCustomerDeliveryLocation,
      getAvailableAccountBalanceForUser,
      isBusinessOwnedByUser,
      updateBusinessListing,
      deleteOwnedBusinessListing,
      getAvailableStock,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      checkoutCart,
      startCartFlutterwaveCheckout,
      restockBusinessStock,
      updateBusinessReorderLevel,
      updateOrderStatus,
      deleteOrder,
      updateOrderProgressCode,
      syncOrderProgressSettings,
      verifyOrderProgressCode,
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
      centralCatalogProducts,
      cartCount,
      cartEntries,
      cartTotal,
      chatThreads,
      currentEstateId,
      customerDeliveryLocations,
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
      approveStoreApplicationForOwner,
      reviewStoreApplicationForOwner,
      updateOwnerBusinessProfile,
      payCustomerBenefitSubscriptionWithAccount,
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
