export const listingTypes = ['product', 'profession'] as const;
export type ListingType = (typeof listingTypes)[number];

export const businessStatuses = ['active', 'archived'] as const;
export type BusinessStatus = (typeof businessStatuses)[number];

export const paymentPlanCycles = ['weekly', 'monthly'] as const;
export type PaymentPlanCycle = (typeof paymentPlanCycles)[number];

export const businessSubscriptionStatuses = ['pending', 'paid', 'active'] as const;
export type BusinessSubscriptionStatus = (typeof businessSubscriptionStatuses)[number];

export type PaymentPlan = {
  cycle: PaymentPlanCycle;
  title: string;
  amount: number;
  description: string;
  updatedAt: string;
};

export const productCategories = [
  'Food & Drinks',
  'Groceries',
  'Electronics',
  'Beauty',
  'Fashion',
  'Home Essentials',
] as const;

export const professionCategories = [
  'Doctor',
  'Nurse',
  'Phone Repair',
  'Electrician',
  'Hair Stylist',
  'Plumber',
] as const;

export type BusinessCategory = string;

export const riverParkClusters = [
  'Cluster 1',
  'Cluster 3',
  'Cluster 4',
  'Cluster 5',
] as const;

export type RiverParkCluster = (typeof riverParkClusters)[number];

export type EstateAmenity = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export type Estate = {
  id: string;
  name: string;
  city: string;
  residents: number;
  businessesLive: number;
  averageResponseTime: string;
  clusters: readonly RiverParkCluster[];
  amenities: EstateAmenity[];
};

export type BusinessContact = {
  phone: string;
  whatsapp?: string;
  email: string;
  website?: string;
  instagram?: string;
};

export type ContactAction = {
  id: 'call' | 'whatsapp' | 'email' | 'website';
  icon: string;
  label: string;
  value: string;
  url: string;
};

export type BusinessMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  label: string;
  thumbnailUrl?: string;
};

export type Business = {
  id: string;
  estateId: string;
  listingType: ListingType;
  status?: BusinessStatus;
  subscriptionCycle?: PaymentPlanCycle;
  subscriptionStatus?: BusinessSubscriptionStatus;
  verifiedAmount?: number;
  subscriptionPaidAt?: string;
  subscriptionNextBillingAt?: string;
  subscriptionItemCount?: number;
  name: string;
  ownerName: string;
  ownerUserId?: string;
  ownerEmail?: string;
  cluster: RiverParkCluster;
  category: BusinessCategory;
  description: string;
  longDescription: string;
  imageUrl: string;
  media: BusinessMedia[];
  address: string;
  sku?: string;
  stockQuantity?: number;
  reorderLevel?: number;
  price: number;
  priceLabel?: string;
  responseTime: string;
  verified: boolean;
  riverParkVerified?: boolean;
  services: string[];
  tags: string[];
  contact: BusinessContact;
  createdAt: string;
  updatedAt?: string;
};

export type BusinessProfileFormValues = {
  listingType: ListingType;
  businessName: string;
  ownerName: string;
  estateId: string;
  subscriptionCycle: PaymentPlanCycle;
  cluster: RiverParkCluster;
  category: BusinessCategory;
  shortDescription: string;
  longDescription: string;
  price: string;
  stockQuantity: string;
  reorderLevel: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  coverImage: string;
  galleryImages: string;
  galleryVideos: string;
  services: string;
};

export type OwnerBusinessProfileValues = {
  ownerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  coverImage: string;
  galleryImages: string;
  galleryVideos: string;
};

export type OwnerBusinessProfile = OwnerBusinessProfileValues & {
  id: string;
  ownerUserId: string;
  accountName: string;
  accountEmail: string;
  subscriptionCycle?: PaymentPlanCycle;
  subscriptionStatus?: BusinessSubscriptionStatus;
  verifiedAmount?: number;
  subscriptionPaidAt?: string;
  subscriptionNextBillingAt?: string;
  subscriptionItemCount?: number;
  riverParkVerified?: boolean;
  updatedAt: string;
};

export type SubscriptionPaymentStatus = 'pending' | 'paid' | 'failed';

export type SubscriptionPayment = {
  id: string;
  reference: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  cycle: PaymentPlanCycle;
  amount: number;
  currency: string;
  status: SubscriptionPaymentStatus;
  checkoutUrl?: string;
  paidAt?: string;
  rawPayload?: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportSenderRole = 'resident' | 'businessOwner' | 'customerCare' | 'owner' | 'system';

export type SupportMessage = {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  userRole: 'resident' | 'businessOwner';
  senderName: string;
  senderRole: SupportSenderRole;
  text: string;
  contextType?: 'order' | 'listing' | 'general';
  contextId?: string;
  contextLabel?: string;
  createdAt: string;
};

export type SupportConversation = {
  id: string;
  userId: string;
  userName: string;
  userRole: 'resident' | 'businessOwner';
  messages: SupportMessage[];
  lastMessage: SupportMessage;
};

export type AppNotificationAudience = 'resident' | 'businessOwner';

export type AppNotification = {
  id: string;
  userId: string;
  userName: string;
  recipientEmail?: string;
  audience: AppNotificationAudience;
  title: string;
  body: string;
  contextType?: 'order' | 'listing' | 'general';
  contextId?: string;
  createdAt: string;
  readAt?: string;
};

export type CartItem = {
  businessId: string;
  quantity: number;
};

export type CartEntry = {
  business: Business;
  quantity: number;
  lineTotal: number;
};

export type ChatMessage = {
  id: string;
  businessId: string;
  senderName: string;
  senderType: 'resident' | 'owner';
  text: string;
  createdAt: string;
};

export type ChatConversation = {
  business: Business;
  messages: ChatMessage[];
  lastMessage: ChatMessage;
};

export const orderStatuses = [
  'placed',
  'packed',
  'outForDelivery',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentStatuses = ['pending', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentMethods = ['walletAccount', 'flutterwave', 'bankTransfer', 'cashOnDelivery'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export type OrderTimelineEvent = {
  id: string;
  status: OrderStatus;
  label: string;
  note: string;
  createdAt: string;
};

export type OrderItem = {
  businessId: string;
  businessName: string;
  ownerName: string;
  ownerUserId?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  userId: string;
  userEmail?: string;
  userName: string;
  estateId: string;
  deliveryAddress: string;
  deliveryCluster: string;
  note?: string;
  items: OrderItem[];
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  expectedDeliveryAt?: string;
  timeline: OrderTimelineEvent[];
  inventoryRestoredAt?: string;
};

export type OrderProgressSettings = {
  code: string;
  updatedAt: string;
};

export type CheckoutPayload = {
  deliveryAddress: string;
  deliveryCluster: string;
  note?: string;
  paymentMethod: PaymentMethod;
};

export type FlutterwaveCheckoutSession = {
  reference: string;
  amount: number;
  currency: string;
  checkoutUrl: string;
  paymentOptions: string[];
  mode?: 'test' | 'live';
  providerBody?: string;
};

export type SecuritySettings = {
  allowResidentSignups: boolean;
  allowBusinessOwnerSignups: boolean;
  maintenanceMode: boolean;
  blockCheckout: boolean;
  requireManualListingApproval: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  loginAnnouncementEnabled: boolean;
  loginAnnouncementTitle: string;
  loginAnnouncementBody: string;
  subscriptionExemptAccountEmail: string;
};

export type AuditActorRole = 'system' | 'owner' | 'customerCare' | 'businessOwner';

export type AutomatedEmailRecipient = 'buyer' | 'owner' | 'admin' | 'customerCare';
export type AutomatedEmailStatus = 'queued' | 'sent';

export type AutomatedEmailLog = {
  id: string;
  orderId?: string;
  businessId?: string;
  recipientType: AutomatedEmailRecipient;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: AutomatedEmailStatus;
  createdAt: string;
  sentAt?: string;
};

export type WithdrawalStatus = 'paid';
export type WithdrawalKycType = 'bvn' | 'nin';

export type VirtualAccountProvider = 'flutterwave';
export type VirtualAccountStatus = 'depositReady' | 'verified';

export type VirtualAccount = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  provider: VirtualAccountProvider;
  providerReference: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  kycType?: WithdrawalKycType;
  kycLast4?: string;
  kycReference?: string;
  idDocumentUri?: string;
  idDocumentName?: string;
  status: VirtualAccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type DynamicDepositStatus = 'pending' | 'paid' | 'expired';

export type DynamicDepositAccount = {
  id: string;
  reference: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'resident' | 'businessOwner';
  provider: VirtualAccountProvider;
  providerReference: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  currency: string;
  status: DynamicDepositStatus;
  expiresAt?: string;
  paidAt?: string;
  providerChargeId?: string;
  failureReason?: string;
  rawPayload?: string;
  createdAt: string;
  updatedAt: string;
};

export type WithdrawalRequest = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  bankName: string;
  accountNumber: string;
  accountName?: string;
  kycType: WithdrawalKycType;
  kycLast4: string;
  kycReference: string;
  idDocumentUri?: string;
  idDocumentName?: string;
  amount: number;
  status: WithdrawalStatus;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actorName: string;
  actorRole: AuditActorRole;
  action: string;
  details: string;
  createdAt: string;
};
