import type { AdminUser, AppUser, SignUpFormValues, StoredUser, UserRole } from '../types/auth';
import type {
  AppNotification,
  AuditLog,
  AutomatedEmailLog,
  Business,
  BusinessMedia,
  CartItem,
  ChatMessage,
  ChatMessageAttachment,
  DeliveryLocation,
  ListingAudience,
  ListingSource,
  DispatchDeliveryJob,
  DispatchRiderProfile,
  DynamicDepositAccount,
  FlutterwaveBank,
  FlutterwaveCheckoutSession,
  OwnerBusinessProfile,
  PaymentPlan,
  SecuritySettings,
  SupportMessage,
  Order,
  OrderDeliveryUpdate,
  OrderItem,
  OrderTimelineEvent,
  PaymentPlanCycle,
  RiverParkCluster,
  SubscriptionPayment,
  VirtualAccount,
  VerifiedSellerPayoutAccount,
  WithdrawalRequest,
} from '../types/business';
import {
  getDynamicDepositExpiresAt,
  MINIMUM_ADD_FUNDS_DEPOSIT,
  withDynamicDepositExpiry,
} from '../utils/deposits';
import { isUrbanConnectLocalTestMode, readPublicEnv } from '../config/runtime';
import { formatCurrency } from '../utils/format';
import { normalizeOrderStatus } from '../utils/order';
import { normalizeProductCategory } from '../utils/category';

type JsonRecord = Record<string, unknown>;

type SupabaseAuthUser = {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: JsonRecord;
};

type SupabaseAuthUserUpdateResponse =
  | SupabaseAuthUser
  | {
      user?: SupabaseAuthUser | null;
    };

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: SupabaseAuthUser;
};

type CompleteAccountSignupResponse = {
  status?: string;
  authUserId?: string;
  profile?: SupabaseProfileRow;
};

type CreateDispatchAccountResponse = {
  profile?: SupabaseProfileRow;
};

export type SupabaseSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  portal?: 'app' | 'admin';
};

type SupabaseProfileRow = {
  id: string;
  user_number?: number | string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  auth_email?: string | null;
  phone_number: string;
  password_hash?: string | null;
  role: UserRole;
  estate_id: string;
  business_name?: string | null;
  business_cluster?: string | null;
  river_park_verified?: boolean | null;
  status?: 'active' | 'suspended' | null;
  created_at: string;
  updated_at?: string | null;
};

type SupabaseAdminRow = {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'admin' | 'customerCare';
  is_active: boolean;
  created_at: string;
};

type SupabasePaymentPlanRow = {
  cycle: PaymentPlanCycle;
  title: string;
  amount: number | string;
  description: string;
  updated_at: string;
};

type SupabaseBusinessRow = {
  id: string;
  estate_id: string;
  listing_type: 'product' | 'profession';
  listing_source?: ListingSource | null;
  listing_audience?: ListingAudience | null;
  status?: 'active' | 'archived' | null;
  subscription_cycle?: PaymentPlanCycle | null;
  subscription_status?: 'pending' | 'paid' | 'active' | null;
  verified_amount?: number | string | null;
  subscription_paid_at?: string | null;
  subscription_next_billing_at?: string | null;
  subscription_item_count?: number | null;
  name: string;
  owner_name: string;
  owner_user_id?: string | null;
  owner_email?: string | null;
  cluster: string;
  category: string;
  description: string;
  long_description: string;
  image_url: string;
  media?: BusinessMedia[] | null;
  address: string;
  sku?: string | null;
  stock_quantity?: number | null;
  reorder_level?: number | null;
  price: number | string;
  price_label?: string | null;
  response_time: string;
  verified: boolean;
  river_park_verified?: boolean | null;
  services?: string[] | null;
  tags?: string[] | null;
  contact?: Business['contact'] | null;
  created_at: string;
  updated_at?: string | null;
};

type SupabaseOrderItemRow = {
  business_id: string;
  business_name: string;
  owner_name: string;
  owner_user_id?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
};

type SupabaseTimelineRow = {
  id: string;
  status: string;
  label: string;
  note: string;
  created_at: string;
};

type SupabaseOrderRow = {
  id: string;
  user_id: string;
  user_email?: string | null;
  user_name: string;
  estate_id: string;
  delivery_address: string;
  delivery_cluster: string;
  delivery_contact_phone?: string | null;
  delivery_country?: string | null;
  delivery_state_region?: string | null;
  delivery_city?: string | null;
  delivery_area_district?: string | null;
  delivery_street_name?: string | null;
  delivery_building_info?: string | null;
  delivery_landmark?: string | null;
  delivery_latitude?: number | string | null;
  delivery_longitude?: number | string | null;
  delivery_place_id?: string | null;
  delivery_location_source?: DeliveryLocation['source'] | null;
  delivery_instructions?: string | null;
  note?: string | null;
  subtotal: number | string;
  seller_packing_support?: number | string | null;
  service_fee: number | string;
  delivery_fee: number | string;
  total_amount: number | string;
  payment_method: Order['paymentMethod'];
  payment_status: Order['paymentStatus'];
  status: string;
  expected_delivery_at?: string | null;
  created_at: string;
  updated_at: string;
  order_items?: SupabaseOrderItemRow[] | null;
  order_timeline_events?: SupabaseTimelineRow[] | null;
};

type SupabaseOwnerProfileRow = {
  id: string;
  owner_user_id: string;
  account_name: string;
  account_email: string;
  owner_name: string;
  bio?: string | null;
  profile_image?: string | null;
  phone: string;
  whatsapp?: string | null;
  email: string;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  x?: string | null;
  tiktok?: string | null;
  address: string;
  opening_time?: string | null;
  closing_time?: string | null;
  open_days?: string[] | null;
  cover_image?: string | null;
  gallery_images?: string | null;
  gallery_videos?: string | null;
  subscription_cycle?: PaymentPlanCycle | null;
  subscription_status?: 'pending' | 'paid' | 'active' | null;
  verified_amount?: number | string | null;
  subscription_paid_at?: string | null;
  subscription_next_billing_at?: string | null;
  subscription_item_count?: number | null;
  river_park_verified?: boolean | null;
  payout_bank_code?: string | null;
  payout_bank_name?: string | null;
  payout_account_number?: string | null;
  payout_account_name?: string | null;
  payout_verified_at?: string | null;
  updated_at: string;
};

type SupabaseSubscriptionPaymentRow = {
  id: string;
  reference: string;
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  cycle: PaymentPlanCycle;
  amount: number | string;
  currency: string;
  status: SubscriptionPayment['status'];
  checkout_url?: string | null;
  paid_at?: string | null;
  raw_payload?: unknown;
  created_at: string;
  updated_at: string;
};

type SupabaseWithdrawalRow = {
  id: string;
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  bank_name: string;
  account_number: string;
  account_name?: string | null;
  kyc_type?: WithdrawalRequest['kycType'] | null;
  kyc_last4?: string | null;
  kyc_reference?: string | null;
  amount: number | string;
  status: WithdrawalRequest['status'];
  created_at: string;
  updated_at?: string | null;
  provider_reference?: string | null;
  failure_reason?: string | null;
};

type SupabaseVirtualAccountRow = {
  id: string;
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  provider: VirtualAccount['provider'];
  provider_reference: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  kyc_type?: VirtualAccount['kycType'] | null;
  kyc_last4?: string | null;
  kyc_reference?: string | null;
  id_document_path?: string | null;
  id_document_name?: string | null;
  status: VirtualAccount['status'];
  created_at: string;
  updated_at: string;
};

type SupabaseDynamicDepositRow = {
  id: string;
  reference: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: DynamicDepositAccount['userRole'];
  provider: DynamicDepositAccount['provider'];
  provider_reference: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  amount: number | string;
  currency: string;
  status: DynamicDepositAccount['status'];
  expires_at?: string | null;
  paid_at?: string | null;
  provider_charge_id?: string | null;
  failure_reason?: string | null;
  raw_payload?: unknown;
  created_at: string;
  updated_at: string;
};

type FlutterwaveVirtualAccountFunctionResponse = {
  status?: string;
  txRef?: string;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  amount?: number | string;
  currency?: string;
  expiresAt?: string;
  kycLast4?: string;
  kycReference?: string;
  providerBody?: unknown;
};

type FlutterwaveCheckoutFunctionResponse = {
  status?: string;
  reference?: string;
  amount?: number | string;
  currency?: string;
  checkoutUrl?: string;
  paymentOptions?: string[];
  mode?: 'test' | 'live';
  providerBody?: unknown;
};

const flutterwaveCheckoutReturnUrl =
  'https://www.view2connect.ng/payments/flutterwave/return';

type SupabaseSecurityRow = {
  allow_resident_signups: boolean;
  allow_business_owner_signups: boolean;
  maintenance_mode: boolean;
  block_checkout: boolean;
  require_manual_listing_approval: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  login_announcement_enabled?: boolean | null;
  login_announcement_title?: string | null;
  login_announcement_body?: string | null;
  subscription_exempt_account_email?: string | null;
  minimum_withdrawal_amount?: number | string | null;
  maximum_withdrawal_amount?: number | string | null;
  vat_tier_one_amount?: number | string | null;
  vat_tier_two_base_amount?: number | string | null;
  vat_additional_band_amount?: number | string | null;
  packing_tier_one_amount?: number | string | null;
  packing_tier_two_amount?: number | string | null;
  packing_tier_three_amount?: number | string | null;
  packing_tier_four_amount?: number | string | null;
  packing_tier_five_amount?: number | string | null;
  packing_tier_six_amount?: number | string | null;
};

type SupabaseEmailRow = {
  id: string;
  order_id?: string | null;
  business_id?: string | null;
  recipient_type: AutomatedEmailLog['recipientType'];
  recipient_name: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: AutomatedEmailLog['status'];
  created_at: string;
  sent_at?: string | null;
};

type SupabaseAuditRow = {
  id: string;
  actor_name: string;
  actor_role: AuditLog['actorRole'];
  action: string;
  details: string;
  created_at: string;
};

type SupabaseNotificationRow = {
  id: string;
  user_id: string;
  user_name: string;
  audience: AppNotification['audience'];
  title: string;
  body: string;
  context_type?: AppNotification['contextType'] | null;
  context_id?: string | null;
  created_at: string;
  read_at?: string | null;
};

type SupabaseSupportMessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  user_name: string;
  user_role: SupportMessage['userRole'];
  sender_name: string;
  sender_role: SupportMessage['senderRole'];
  text: string;
  context_type?: SupportMessage['contextType'] | null;
  context_id?: string | null;
  context_label?: string | null;
  attachments?: unknown;
  created_at: string;
};

type SupabaseChatMessageRow = {
  id: string;
  business_id: string;
  sender_user_id?: string | null;
  recipient_user_id?: string | null;
  sender_name: string;
  sender_type: ChatMessage['senderType'];
  text: string;
  attachments?: unknown;
  created_at: string;
};

type SupabaseCustomerCartItemRow = {
  user_id: string;
  business_id: string;
  quantity: number;
  updated_at: string;
};

type SupabaseDeliveryLocationRow = {
  user_id: string;
  formatted_address: string;
  country?: string | null;
  state_region?: string | null;
  city?: string | null;
  area_district?: string | null;
  street_name?: string | null;
  building_info?: string | null;
  landmark?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  additional_instructions?: string | null;
  place_id?: string | null;
  source?: DeliveryLocation['source'] | null;
  updated_at: string;
};

export type MarketplaceSnapshot = {
  businesses: Business[];
  orders: Order[];
  paymentPlans: PaymentPlan[];
  securitySettings?: SecuritySettings;
  ownerBusinessProfiles: OwnerBusinessProfile[];
  emailLogs: AutomatedEmailLog[];
  auditLogs: AuditLog[];
  notifications: AppNotification[];
  chatThreads: Record<string, ChatMessage[]>;
  supportThreads: Record<string, SupportMessage[]>;
  subscriptionPayments: SubscriptionPayment[];
  withdrawalRequests: WithdrawalRequest[];
  virtualAccounts: VirtualAccount[];
  dynamicDepositAccounts: DynamicDepositAccount[];
};

type SupabaseDeliveryJobRow = {
  id: string;
  order_id: string;
  seller_key: string;
  seller_user_id?: string | null;
  seller_name: string;
  seller_type: 'storeOwner' | 'individualSeller';
  pickup_address: string;
  delivery_address: string;
  delivery_contact_phone?: string | null;
  delivery_country?: string | null;
  delivery_state_region?: string | null;
  delivery_city?: string | null;
  delivery_area_district?: string | null;
  delivery_street_name?: string | null;
  delivery_building_info?: string | null;
  delivery_landmark?: string | null;
  delivery_latitude?: number | string | null;
  delivery_longitude?: number | string | null;
  delivery_place_id?: string | null;
  delivery_location_source?: DeliveryLocation['source'] | null;
  delivery_instructions?: string | null;
  item_subtotal: number | string;
  delivery_fee: number | string;
  status: DispatchDeliveryJob['status'];
  rider_user_id?: string | null;
  seller_release_status: DispatchDeliveryJob['sellerReleaseStatus'];
  accepted_at?: string | null;
  picked_up_at?: string | null;
  rider_confirmed_at?: string | null;
  buyer_confirmed_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseOrderDeliveryUpdateRow = {
  id: string;
  order_id: string;
  seller_name: string;
  delivery_address: string;
  delivery_contact_phone?: string | null;
  status: DispatchDeliveryJob['status'];
  rider_user_id?: string | null;
  rider_full_name?: string | null;
  rider_phone_number?: string | null;
  accepted_at?: string | null;
  picked_up_at?: string | null;
  rider_confirmed_at?: string | null;
  buyer_confirmed_at?: string | null;
  completed_at?: string | null;
  updated_at: string;
};
type SupabaseRiderProfileRow = {
  auth_user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  whatsapp?: string | null;
  address?: string | null;
  profile_image?: string | null;
  bio?: string | null;
  vehicle_type?: string | null;
  plate_number?: string | null;
  status: DispatchRiderProfile['status'];
  created_at: string;
  updated_at: string;
};

export class SupabaseApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseApiError';
    this.status = status;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeSupabaseUrl(value?: string) {
  const candidate = value?.trim() ?? '';

  if (
    !candidate ||
    /your-project-ref|myprojectid|your-project-id/i.test(candidate)
  ) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    return trimTrailingSlash(new URL(withProtocol).toString());
  } catch {
    return undefined;
  }
}

export const supabaseConfig = {
  url: normalizeSupabaseUrl(readPublicEnv('EXPO_PUBLIC_SUPABASE_URL')),
  publishableKey: readPublicEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY')?.trim() || undefined,
};

let activeSupabaseAccessToken: string | undefined;
const accessTokenListeners = new Set<() => void>();

export function setSupabaseAccessToken(accessToken?: string) {
  const nextAccessToken = accessToken?.trim() || undefined;
  if (nextAccessToken === activeSupabaseAccessToken) {
    return;
  }

  activeSupabaseAccessToken = nextAccessToken;
  accessTokenListeners.forEach((listener) => listener());
}

export function subscribeToSupabaseAccessToken(listener: () => void) {
  accessTokenListeners.add(listener);
  return () => accessTokenListeners.delete(listener);
}

const listingMediaBucket = 'urbanconnect-listing-media';
const privateDocumentBucket = 'urbanconnect-private-documents';

export const isSupabaseConfigured = Boolean(
  !isUrbanConnectLocalTestMode && supabaseConfig.url && supabaseConfig.publishableKey,
);

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function optionalString(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function normalizeUserRole(value: unknown): UserRole {
  return value === 'businessOwner' || value === 'dispatch' ? value : 'resident';
}

function roleLabel(role: UserRole) {
  if (role === 'businessOwner') {
    return 'store owner';
  }

  if (role === 'dispatch') {
    return 'dispatch';
  }

  return 'customer';
}

function getPayloadMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as JsonRecord;
    const message =
      record.message ?? record.msg ?? record.error_description ?? record.error;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function supabaseRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    accessToken?: string | undefined;
    headers?: Record<string, string>;
  } = {},
) {
  if (isUrbanConnectLocalTestMode) {
    throw new SupabaseApiError(
      'View2Connect local test mode is enabled. Supabase calls are disabled.',
      0,
    );
  }

  if (!isSupabaseConfigured) {
    throw new SupabaseApiError('Supabase is not configured for this app.', 0);
  }

  const supabaseUrl = supabaseConfig.url;
  const publishableKey = supabaseConfig.publishableKey;

  if (!supabaseUrl || !publishableKey) {
    throw new SupabaseApiError('Supabase is not configured for this app.', 0);
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${options.accessToken ?? activeSupabaseAccessToken ?? publishableKey}`,
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new SupabaseApiError(
      getPayloadMessage(payload, `Supabase request failed with status ${response.status}.`),
      response.status,
    );
  }

  return payload as T;
}

function isHostedMediaUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

type StorageMediaKind = BusinessMedia['type'] | 'file';

function extensionFromMimeType(mimeType: string, kind: StorageMediaKind) {
  if (/png/i.test(mimeType)) {
    return 'png';
  }

  if (/webp/i.test(mimeType)) {
    return 'webp';
  }

  if (/gif/i.test(mimeType)) {
    return 'gif';
  }

  if (/quicktime|mov/i.test(mimeType)) {
    return 'mov';
  }

  if (/webm/i.test(mimeType)) {
    return 'webm';
  }

  if (/video/i.test(mimeType)) {
    return 'mp4';
  }

  if (/pdf/i.test(mimeType)) {
    return 'pdf';
  }

  if (/wordprocessingml|msword/i.test(mimeType)) {
    return /wordprocessingml/i.test(mimeType) ? 'docx' : 'doc';
  }

  if (/spreadsheetml|excel/i.test(mimeType)) {
    return /spreadsheetml/i.test(mimeType) ? 'xlsx' : 'xls';
  }

  if (/plain/i.test(mimeType)) {
    return 'txt';
  }

  return kind === 'video' ? 'mp4' : kind === 'file' ? 'bin' : 'jpg';
}

function mimeTypeFromUri(uri: string, kind: StorageMediaKind) {
  const cleanUri = uri.split('?')[0]?.toLowerCase() ?? '';

  if (cleanUri.endsWith('.png')) {
    return 'image/png';
  }

  if (cleanUri.endsWith('.webp')) {
    return 'image/webp';
  }

  if (cleanUri.endsWith('.gif')) {
    return 'image/gif';
  }

  if (cleanUri.endsWith('.mov')) {
    return 'video/quicktime';
  }

  if (cleanUri.endsWith('.webm')) {
    return 'video/webm';
  }

  if (cleanUri.endsWith('.mp4') || kind === 'video') {
    return 'video/mp4';
  }

  if (cleanUri.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (cleanUri.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  if (cleanUri.endsWith('.doc')) {
    return 'application/msword';
  }

  if (cleanUri.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  if (cleanUri.endsWith('.xls')) {
    return 'application/vnd.ms-excel';
  }

  if (cleanUri.endsWith('.txt')) {
    return 'text/plain';
  }

  return kind === 'file' ? 'application/octet-stream' : 'image/jpeg';
}

function sanitizeStorageSegment(value: string) {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'media';
}

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function uploadMediaUriToSupabaseBucket(
  uri: string,
  path: string,
  kind: StorageMediaKind,
  bucket: string,
  isPublic: boolean,
) {
  const supabaseUrl = supabaseConfig.url;
  const publishableKey = supabaseConfig.publishableKey;
  const accessToken = activeSupabaseAccessToken;

  if (!isSupabaseConfigured || !supabaseUrl || !publishableKey) {
    throw new SupabaseApiError('Supabase storage is not configured for this app.', 0);
  }

  if (!accessToken) {
    throw new SupabaseApiError('Sign in before uploading media.', 401);
  }

  const mediaResponse = await fetch(uri);
  if (!mediaResponse.ok) {
    throw new SupabaseApiError('The selected media file could not be read.', 400);
  }
  const mediaBlob = await mediaResponse.blob();
  const contentType = mediaBlob.type || mimeTypeFromUri(uri, kind);
  const allowedContentType =
    kind === 'image'
      ? /^image\/(jpeg|png|webp)$/i.test(contentType)
      : kind === 'video'
        ? /^video\/(mp4|webm|quicktime)$/i.test(contentType)
        : /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|text\/plain)$/i.test(
            contentType,
          );
  const maximumSize = kind === 'video' ? 30 * 1024 * 1024 : 10 * 1024 * 1024;

  if (!allowedContentType) {
    throw new SupabaseApiError(`This ${kind} file type is not supported.`, 415);
  }

  if (mediaBlob.size > maximumSize) {
    throw new SupabaseApiError(
      `${kind === 'video' ? 'Videos' : 'Files'} must be ${maximumSize / 1024 / 1024} MB or smaller.`,
      413,
    );
  }

  const extension = extensionFromMimeType(contentType, kind);
  const normalizedPath = path.includes('.') ? path : `${path}.${extension}`;
  const encodedPath = encodeStoragePath(normalizedPath);
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'cache-control': '3600',
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: mediaBlob,
    },
  );
  const payload = await parseResponse(uploadResponse);

  if (!uploadResponse.ok) {
    throw new SupabaseApiError(
      getPayloadMessage(
        payload,
        `${isPublic ? 'Listing media' : 'Private document'} could not be uploaded. Check the Supabase storage bucket and policies, then try again.`,
      ),
      uploadResponse.status,
    );
  }

  return isPublic
    ? `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`
    : normalizedPath;
}

export async function uploadMediaUriToSupabaseStorage(
  uri: string,
  path: string,
  kind: StorageMediaKind,
) {
  return uploadMediaUriToSupabaseBucket(uri, path, kind, listingMediaBucket, true);
}

export async function uploadPrivateDocumentToSupabaseStorage(
  uri: string,
  path: string,
) {
  return uploadMediaUriToSupabaseBucket(uri, path, 'image', privateDocumentBucket, false);
}

export async function uploadChatAttachmentToSupabaseStorage(
  attachment: ChatMessageAttachment,
  messageId: string,
  ownerKey: string,
) {
  if (!isSupabaseConfigured || !attachment.url || isHostedMediaUri(attachment.url)) {
    return attachment;
  }

  const path = [
    'chat-attachments',
    sanitizeStorageSegment(ownerKey),
    sanitizeStorageSegment(messageId),
    sanitizeStorageSegment(attachment.name || attachment.id),
  ].join('/');
  const publicUrl = await uploadMediaUriToSupabaseStorage(attachment.url, path, attachment.type);

  return {
    ...attachment,
    url: publicUrl,
  };
}

export async function uploadBusinessMediaToSupabase(business: Business) {
  if (!isSupabaseConfigured) {
    return business;
  }

  const uploadedUrls = new Map<string, string>();
  const ownerSegment = sanitizeStorageSegment(
    business.ownerUserId ?? business.ownerEmail ?? business.ownerName,
  );
  const businessSegment = sanitizeStorageSegment(business.id);

  const uploadUrl = async (uri: string, kind: BusinessMedia['type'], name: string) => {
    if (!uri || isHostedMediaUri(uri)) {
      return uri;
    }

    const existingUrl = uploadedUrls.get(uri);

    if (existingUrl) {
      return existingUrl;
    }

    const path = [
      'businesses',
      ownerSegment,
      businessSegment,
      sanitizeStorageSegment(name),
    ].join('/');
    const publicUrl = await uploadMediaUriToSupabaseStorage(uri, path, kind);
    uploadedUrls.set(uri, publicUrl);
    return publicUrl;
  };

  const media = await Promise.all(
    business.media.map(async (item, index) => ({
      ...item,
      url: await uploadUrl(item.url, item.type, item.id || `${item.type}-${index + 1}`),
      ...(item.thumbnailUrl
        ? { thumbnailUrl: await uploadUrl(item.thumbnailUrl, 'image', `${item.id}-thumbnail`) }
        : {}),
    })),
  );
  const imageUrl = await uploadUrl(business.imageUrl, 'image', 'cover-image');

  return {
    ...business,
    imageUrl,
    media,
  };
}

function toSession(response: SupabaseAuthResponse): SupabaseSession | null {
  if (!response.access_token) {
    return null;
  }

  return {
    accessToken: response.access_token,
    ...(response.refresh_token ? { refreshToken: response.refresh_token } : {}),
    ...(response.expires_in
      ? { expiresAt: Math.floor(Date.now() / 1000) + response.expires_in }
      : {}),
    ...(response.token_type ? { tokenType: response.token_type } : {}),
  };
}

export async function refreshSupabaseSession(refreshToken: string) {
  const response = await supabaseRequest<SupabaseAuthResponse>(
    '/auth/v1/token?grant_type=refresh_token',
    {
      method: 'POST',
      body: { refresh_token: refreshToken },
    },
  );
  const session = toSession(response);

  if (!session) {
    throw new SupabaseApiError('Supabase did not return a refreshed session.', 401);
  }

  return session;
}

function profileToAppUser(row: SupabaseProfileRow): AppUser {
  const businessName = optionalString(row.business_name);
  const businessCluster = optionalString(row.business_cluster);
  const role = normalizeUserRole(row.role);

  return {
    id: row.id,
    ...(row.user_number !== undefined && row.user_number !== null
      ? { userNumber: Number(row.user_number) }
      : {}),
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    role,
    estateId: row.estate_id,
    riverParkVerified: Boolean(row.river_park_verified),
    status: row.status ?? 'active',
    createdAt: row.created_at,
    ...(businessName ? { businessName } : {}),
    ...(businessCluster ? { businessCluster: businessCluster as RiverParkCluster } : {}),
  };
}

function getProfileAuthEmail(row: SupabaseProfileRow) {
  return optionalString(row.auth_email) ?? row.email;
}

function profileToStoredUser(row: SupabaseProfileRow): StoredUser {
  return {
    ...profileToAppUser(row),
    password: '',
  };
}

function adminRowToUser(row: SupabaseAdminRow): AdminUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function buildSignupMetadata(values: SignUpFormValues) {
  return {
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
    full_name: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
    phone_number: values.phoneNumber.trim(),
    role: values.role,
    estate_id: values.estateId,
    business_name: values.role === 'businessOwner' ? values.businessName.trim() : null,
    business_cluster: values.role === 'businessOwner' ? values.businessCluster : null,
    accepted_user_agreement: true,
    river_park_verified:
      values.role === 'resident' || values.role === 'businessOwner' || values.role === 'dispatch',
  };
}

function buildProfilePayload(
  authUser: SupabaseAuthUser,
  values?: SignUpFormValues,
): SupabaseProfileRow {
  const metadata = authUser.user_metadata ?? {};
  const metadataFullName = String(metadata.full_name ?? metadata.name ?? '').trim();
  const metadataNameParts = metadataFullName.split(/\s+/).filter(Boolean);
  const firstName =
    values?.firstName.trim() ||
    String(metadata.first_name ?? metadata.firstName ?? metadataNameParts[0] ?? 'View2Connect');
  const lastName =
    values?.lastName.trim() ||
    String(
      metadata.last_name ??
        metadata.lastName ??
        (metadataNameParts.slice(1).join(' ') || 'User'),
    );
  const fullName =
    values
      ? `${firstName} ${lastName}`.trim()
      : metadataFullName || `${firstName} ${lastName}`.trim();
  const role = normalizeUserRole(values?.role ?? metadata.role);
  const businessName =
    role === 'businessOwner'
      ? values?.businessName.trim() || optionalString(String(metadata.business_name ?? ''))
      : undefined;
  const businessCluster =
    role === 'businessOwner'
      ? values?.businessCluster || optionalString(String(metadata.business_cluster ?? ''))
      : undefined;

  return {
    id: authUser.id,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: values?.email.trim().toLowerCase() || authUser.email || '',
    auth_email: authUser.email || values?.email.trim().toLowerCase() || '',
    phone_number:
      values?.phoneNumber.trim() ||
      authUser.phone ||
      String(metadata.phone_number ?? '').trim() ||
      `oauth-${authUser.id}`,
    password_hash: 'supabase-auth-managed',
    role,
    estate_id: values?.estateId ?? String(metadata.estate_id ?? 'river-park'),
    ...(businessName ? { business_name: businessName } : {}),
    ...(businessCluster ? { business_cluster: businessCluster } : {}),
    river_park_verified: role === 'resident' || role === 'businessOwner' || role === 'dispatch',
    status: 'active',
    created_at: new Date().toISOString(),
  };
}

function buildOAuthSignupValues(
  authUser: SupabaseAuthUser,
  role: UserRole,
): SignUpFormValues {
  const metadata = authUser.user_metadata ?? {};
  const metadataFullName = String(metadata.full_name ?? metadata.name ?? '').trim();
  const nameParts = metadataFullName.split(/\s+/).filter(Boolean);
  const firstName = String(
    metadata.first_name ?? metadata.firstName ?? nameParts[0] ?? 'View2Connect',
  ).trim() || 'View2Connect';
  const metadataLastName = String(
    metadata.last_name ?? metadata.lastName ?? nameParts.slice(1).join(' '),
  ).trim();
  const lastName = metadataLastName || (role === 'dispatch' ? 'Dispatch' : 'User');
  const fallbackPassword = 'supabase-oauth-managed';

  return {
    firstName,
    lastName,
    phoneNumber: authUser.phone || String(metadata.phone_number ?? '').trim(),
    email: authUser.email?.trim().toLowerCase() ?? '',
    password: fallbackPassword,
    confirmPassword: fallbackPassword,
    role,
    estateId: String(metadata.estate_id ?? 'river-park'),
    businessName:
      role === 'businessOwner' ? String(metadata.business_name ?? '').trim() : '',
    businessCluster:
      role === 'businessOwner'
        ? ((String(metadata.business_cluster ?? '').trim() || 'Cluster 1') as RiverParkCluster)
        : 'Cluster 1',
  };
}

function unwrapAuthUser(
  payload: SupabaseAuthUserUpdateResponse | undefined,
): SupabaseAuthUser | undefined {
  if (!payload) {
    return undefined;
  }

  const directUser = payload as SupabaseAuthUser;

  if (directUser.id) {
    return directUser;
  }

  return (payload as { user?: SupabaseAuthUser | null }).user ?? undefined;
}

async function fetchProfile(userId: string, accessToken?: string) {
  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    `/rest/v1/app_users?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`,
    { accessToken },
  );

  return rows[0] ? profileToAppUser(rows[0]) : undefined;
}

async function fetchProfileByAuthEmail(authEmail: string, accessToken?: string) {
  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    `/rest/v1/app_users?select=*&auth_email=eq.${encodeURIComponent(authEmail.trim().toLowerCase())}&limit=1`,
    { accessToken },
  );

  return rows[0] ? profileToAppUser(rows[0]) : undefined;
}

async function fetchProfileByEmailAndRole(email: string, role: UserRole, accessToken?: string) {
  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    `/rest/v1/app_users?select=*&email=eq.${encodeURIComponent(
      email.trim().toLowerCase(),
    )}&role=eq.${encodeURIComponent(role)}&limit=1`,
    { accessToken },
  );

  return rows[0] ? { profile: profileToAppUser(rows[0]), authEmail: getProfileAuthEmail(rows[0]) } : undefined;
}

async function fetchProfileByPhoneAndRole(phoneNumber: string, role: UserRole, accessToken?: string) {
  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    `/rest/v1/app_users?select=*&phone_number=eq.${encodeURIComponent(
      phoneNumber.trim(),
    )}&role=eq.${encodeURIComponent(role)}&limit=1`,
    { accessToken },
  );

  return rows[0] ? { profile: profileToAppUser(rows[0]), authEmail: getProfileAuthEmail(rows[0]) } : undefined;
}

async function syncProfileNameFromAuth(
  profile: AppUser,
  authUser: SupabaseAuthUser,
  accessToken?: string,
) {
  const metadata = authUser.user_metadata ?? {};
  const hasProviderName = Boolean(
    String(
      metadata.full_name ??
        metadata.name ??
        metadata.first_name ??
        metadata.firstName ??
        '',
    ).trim(),
  );

  if (!hasProviderName) {
    return profile;
  }

  const authProfile = buildProfilePayload(authUser);

  if (
    profile.firstName === authProfile.first_name &&
    profile.lastName === authProfile.last_name &&
    profile.fullName === authProfile.full_name
  ) {
    return profile;
  }

  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    `/rest/v1/app_users?id=eq.${encodeURIComponent(profile.id)}`,
    {
      method: 'PATCH',
      accessToken,
      body: {
        first_name: authProfile.first_name,
        last_name: authProfile.last_name,
        full_name: authProfile.full_name,
        updated_at: new Date().toISOString(),
      },
      headers: {
        Prefer: 'return=representation',
      },
    },
  ).catch((error) => {
    throw error instanceof SupabaseApiError
      ? error
      : new SupabaseApiError('Unable to connect this Google account to the dispatch profile.', 502);
  });

  if (!rows[0]) {
    throw new SupabaseApiError(
      'Unable to connect this Google account to the dispatch profile.',
      502,
    );
  }

  return profileToAppUser(rows[0]);
}

async function attachAuthEmailToProfile(
  profile: AppUser,
  authUser: SupabaseAuthUser,
  accessToken?: string,
) {
  const authEmail = authUser.email?.trim().toLowerCase();

  if (!authEmail) {
    return profile;
  }

  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    `/rest/v1/app_users?id=eq.${encodeURIComponent(profile.id)}`,
    {
      method: 'PATCH',
      accessToken,
      body: {
        auth_email: authEmail,
        updated_at: new Date().toISOString(),
      },
      headers: {
        Prefer: 'return=representation',
      },
    },
  ).catch(() => []);

  return rows[0] ? profileToAppUser(rows[0]) : profile;
}

async function resolveSupabaseEmail(identifier: string, requiredRole?: UserRole) {
  const normalizedIdentifier = identifier.trim();

  if (normalizedIdentifier.includes('@')) {
    const email = normalizedIdentifier.toLowerCase();

    if (requiredRole) {
      const result = await fetchProfileByEmailAndRole(email, requiredRole);

      if (!result) {
        throw new SupabaseApiError(
          `No ${roleLabel(requiredRole)} account was found for this email.`,
          404,
        );
      }

      return result.authEmail;
    }

    return email;
  }

  if (requiredRole) {
    const result = await fetchProfileByPhoneAndRole(normalizedIdentifier, requiredRole);

    if (!result) {
      throw new SupabaseApiError(
        `No ${roleLabel(requiredRole)} account was found for this phone number.`,
        404,
      );
    }

    return result.authEmail;
  }

  const rows = await supabaseRequest<Pick<SupabaseProfileRow, 'email'>[]>(
    `/rest/v1/app_users?select=email&phone_number=eq.${encodeURIComponent(normalizedIdentifier)}&limit=1`,
  );

  return rows[0]?.email ?? normalizedIdentifier;
}

async function upsertProfile(
  authUser: SupabaseAuthUser,
  values?: SignUpFormValues,
  accessToken?: string,
) {
  const payload = buildProfilePayload(authUser, values);
  const saveProfile = (token?: string) =>
    supabaseRequest<SupabaseProfileRow[]>(
      '/rest/v1/app_users?on_conflict=id',
      {
        method: 'POST',
        body: payload,
        accessToken: token,
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
      },
    );
  const rows = await saveProfile(accessToken).catch((error) => {
    if (!accessToken) {
      throw error;
    }

    return saveProfile();
  });

  return rows[0] ? profileToAppUser(rows[0]) : profileToAppUser(payload);
}

async function updateExistingProfileFromSignup(
  profile: AppUser,
  authUser: SupabaseAuthUser,
  values: SignUpFormValues,
  accessToken?: string,
) {
  const nextProfile = buildProfilePayload(authUser, values);
  const patch = {
    first_name: nextProfile.first_name,
    last_name: nextProfile.last_name,
    full_name: nextProfile.full_name,
    email: nextProfile.email,
    auth_email: nextProfile.auth_email ?? nextProfile.email,
    phone_number: nextProfile.phone_number,
    password_hash: 'supabase-auth-managed',
    role: nextProfile.role,
    estate_id: nextProfile.estate_id,
    business_name: nextProfile.business_name ?? null,
    business_cluster: nextProfile.business_cluster ?? null,
    river_park_verified: nextProfile.river_park_verified ?? false,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  const updateProfile = (token?: string) =>
    supabaseRequest<SupabaseProfileRow[]>(
      `/rest/v1/app_users?id=eq.${encodeURIComponent(profile.id)}`,
      {
        method: 'PATCH',
        body: patch,
        accessToken: token,
        headers: {
          Prefer: 'return=representation',
        },
      },
    );
  const rows = await updateProfile(accessToken).catch((error) => {
    if (!accessToken) {
      throw error;
    }

    return updateProfile();
  });

  return rows[0] ? profileToAppUser(rows[0]) : profile;
}

async function getOrCreateProfile(
  authUser: SupabaseAuthUser,
  accessToken?: string,
  values?: SignUpFormValues,
) {
  const existingProfile = await fetchProfile(authUser.id, accessToken).catch(() => undefined);
  const existingAuthProfile = authUser.email
    ? await fetchProfileByAuthEmail(authUser.email, accessToken).catch(() => undefined)
    : undefined;
  const publicAuthProfile =
    !existingAuthProfile && authUser.email && accessToken
      ? await fetchProfileByAuthEmail(authUser.email).catch(() => undefined)
      : undefined;
  const authProfile = existingAuthProfile ?? publicAuthProfile;

  if (authProfile && existingProfile && existingProfile.id !== authProfile.id) {
    if (values) {
      throw new SupabaseApiError(
        'This auth identity is already connected to another account. Please sign in with the existing account instead.',
        409,
      );
    }

    return syncProfileNameFromAuth(authProfile, authUser, accessToken);
  }

  if (existingProfile) {
    return values
      ? updateExistingProfileFromSignup(existingProfile, authUser, values, accessToken)
      : syncProfileNameFromAuth(existingProfile, authUser, accessToken);
  }

  if (authProfile) {
    if (values && authProfile.id !== authUser.id) {
      throw new SupabaseApiError(
        'This auth identity is already connected to another account. Please sign in with the existing account instead.',
        409,
      );
    }

    return values
      ? updateExistingProfileFromSignup(authProfile, authUser, values, accessToken)
      : syncProfileNameFromAuth(authProfile, authUser, accessToken);
  }

  return upsertProfile(authUser, values, accessToken);
}

async function requestPasswordSession(email: string, password: string) {
  const browserHostname =
    typeof window !== 'undefined' && typeof window.location?.hostname === 'string'
      ? window.location.hostname
      : '';
  const isHostedWeb =
    Boolean(browserHostname) &&
    !['localhost', '127.0.0.1', '::1'].includes(browserHostname);

  if (isHostedWeb) {
    try {
      const response = await fetch('/api/auth-login', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const payload = await parseResponse(response);

      if (!response.ok) {
        const message = getPayloadMessage(
          payload,
          `Login failed with status ${response.status}.`,
        );
        throw new SupabaseApiError(
          /invalid login credentials|invalid.*password|email.*password/i.test(message) ||
            response.status === 400 ||
            response.status === 401
            ? 'Incorrect email or password.'
            : message,
          response.status,
        );
      }

      return payload as SupabaseAuthResponse;
    } catch (error) {
      if (
        error instanceof SupabaseApiError &&
        error.status !== 404 &&
        error.status !== 405
      ) {
        throw error;
      }
    }
  }

  return supabaseRequest<SupabaseAuthResponse>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: {
      email,
      password,
    },
  });
}

async function requestRolePasswordSession(
  identifier: string,
  password: string,
  role: UserRole,
) {
  return supabaseRequest<SupabaseAuthResponse>('/functions/v1/role-password-login', {
    method: 'POST',
    body: {
      identifier: identifier.trim(),
      password,
      role,
    },
  });
}

export async function signInWithSupabase(
  identifier: string,
  password: string,
  requiredRole?: UserRole,
) {
  let response: SupabaseAuthResponse;

  try {
    response = requiredRole
      ? await requestRolePasswordSession(identifier, password, requiredRole)
      : await requestPasswordSession(await resolveSupabaseEmail(identifier), password);
  } catch (error) {
    if (
      error instanceof SupabaseApiError &&
      (error.status === 400 ||
        error.status === 401 ||
        /invalid login credentials|invalid.*password|email.*password|hostname/i.test(error.message))
    ) {
      throw new SupabaseApiError('Incorrect email or password.', error.status);
    }

    throw error;
  }

  const authUser = response.user;

  if (!authUser) {
    throw new SupabaseApiError('Supabase did not return a user for this login.', 500);
  }

  const session = toSession(response);
  const user = await getOrCreateProfile(authUser, session?.accessToken);

  if (requiredRole && user.role !== requiredRole) {
    throw new SupabaseApiError(
      `This login belongs to a ${roleLabel(user.role)} account. Use the ${roleLabel(
        requiredRole,
      )} login for this portal.`,
      403,
    );
  }

  return {
    user,
    storedUser: { ...user, password: '' },
    session,
  };
}

export async function sendSupabaseSignupVerificationCode(values: SignUpFormValues) {
  return supabaseRequest('/functions/v1/request-account-signup-otp', {
    method: 'POST',
    body: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phoneNumber: values.phoneNumber.trim(),
      email: values.email.trim().toLowerCase(),
      role: values.role,
      estateId: values.estateId,
      businessName: values.role === 'businessOwner' ? values.businessName.trim() : '',
      businessCluster: values.role === 'businessOwner' ? values.businessCluster : '',
    },
  });
}

export async function signUpWithSupabase(
  values: SignUpFormValues,
  verificationCode: string,
) {
  const token = verificationCode.trim();

  if (!token) {
    throw new SupabaseApiError('Enter the email verification code to create this account.', 400);
  }

  await supabaseRequest<CompleteAccountSignupResponse>('/functions/v1/complete-account-signup', {
    method: 'POST',
    body: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phoneNumber: values.phoneNumber.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
      role: values.role,
      estateId: values.estateId,
      businessName: values.role === 'businessOwner' ? values.businessName.trim() : '',
      businessCluster: values.role === 'businessOwner' ? values.businessCluster : '',
      code: token,
    },
  });
  let passwordResponse: SupabaseAuthResponse;
  const authEmail = await resolveSupabaseEmail(values.email.trim().toLowerCase(), values.role);

  try {
    passwordResponse = await requestPasswordSession(
      authEmail,
      values.password,
    );
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 350));
    passwordResponse = await requestPasswordSession(
      authEmail,
      values.password,
    );
  }

  const passwordSession = toSession(passwordResponse);
  const authUser = passwordResponse.user;

  if (!passwordSession?.accessToken || !authUser) {
    throw new SupabaseApiError(
      'Your email was verified, but the password could not be confirmed. Try creating the password again.',
      500,
    );
  }

  const user = await getOrCreateProfile(authUser, passwordSession.accessToken, values);

  return {
    user,
    storedUser: { ...user, password: '' },
    session: passwordSession,
  };
}

export async function createDispatchAccountWithSupabase(values: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  estateId: string;
  businessCluster?: string;
}) {
  const response = await supabaseRequest<CreateDispatchAccountResponse>(
    '/functions/v1/admin-create-dispatch-account',
    {
      method: 'POST',
      body: {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phoneNumber: values.phoneNumber.trim(),
        password: values.password,
        estateId: values.estateId,
        businessCluster: values.businessCluster?.trim() ?? '',
      },
    },
  );

  if (!response.profile) {
    throw new SupabaseApiError('The dispatch account was created, but no profile was returned.', 502);
  }

  const user = profileToAppUser(response.profile);

  return {
    user,
    storedUser: { ...user, password: '' },
  };
}

export async function syncSupabaseSessionProfile(accessToken: string) {
  const authUser = await supabaseRequest<SupabaseAuthUser>('/auth/v1/user', {
    accessToken,
  });
  const user = await getOrCreateProfile(authUser, accessToken);

  return {
    user,
    storedUser: { ...user, password: '' },
  };
}

export async function updateSupabaseAuthPassword(accessToken: string, nextPassword: string) {
  return supabaseRequest<SupabaseAuthUserUpdateResponse>('/auth/v1/user', {
    method: 'PUT',
    accessToken,
    body: {
      password: nextPassword,
    },
  });
}

export async function signOutSupabase(accessToken: string) {
  return supabaseRequest('/auth/v1/logout?scope=global', {
    method: 'POST',
    accessToken,
  });
}

export async function requestSupabasePasswordReset(
  identifier: string,
  role: UserRole,
) {
  await supabaseRequest('/functions/v1/request-password-reset', {
    method: 'POST',
    body: { identifier: identifier.trim(), role },
  });
}

export async function fetchSupabaseUserProfiles() {
  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    '/rest/v1/app_users?select=*&order=created_at.desc',
  );

  return rows.map(profileToStoredUser);
}

export async function updateSupabaseUserProfile(
  userId: string,
  patch: Partial<Pick<SupabaseProfileRow, 'river_park_verified' | 'status'>>,
) {
  return supabaseRequest(
    `/rest/v1/app_users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: {
        ...patch,
        updated_at: new Date().toISOString(),
      },
      headers: {
        Prefer: 'return=minimal',
      },
    },
  );
}

export async function setRiverParkVerificationInSupabase(userId: string, verified: boolean) {
  try {
    return await supabaseRequest('/rest/v1/rpc/set_river_park_verification', {
      method: 'POST',
      body: {
        target_user_id: userId,
        verified,
      },
    });
  } catch (error) {
    const isAmbiguousLegacyVerificationFunction =
      error instanceof SupabaseApiError &&
      error.status === 400 &&
      /verified.*ambiguous|ambiguous.*verified|42702/i.test(error.message);

    if (!isRecoverableSupabaseSetupError(error) && !isAmbiguousLegacyVerificationFunction) {
      throw error;
    }

    return updateSupabaseUserProfile(userId, { river_park_verified: verified });
  }
}

export async function setSupabaseUserStatus(
  userId: string,
  status: 'active' | 'suspended',
) {
  await supabaseRequest('/rest/v1/rpc/admin_set_app_user_status', {
    method: 'POST',
    body: {
      target_user_id: userId,
      target_status: status,
    },
  });
}

export async function reviewStoreApplicationInSupabase(values: {
  userId: string;
  decision: 'approved' | 'changesRequested';
  message: string;
}) {
  return supabaseRequest<boolean>('/rest/v1/rpc/admin_review_store_application', {
    method: 'POST',
    body: {
      target_user_id: values.userId,
      review_decision: values.decision,
      review_message: values.message,
    },
  });
}

export async function setListingVerificationInSupabase(values: {
  businessId: string;
  verified: boolean;
  adminPin: string;
}) {
  const row = await supabaseRequest<SupabaseBusinessRow>(
    '/rest/v1/rpc/admin_set_listing_verification',
    {
      method: 'POST',
      body: {
        target_business_id: values.businessId,
        target_verified: values.verified,
        admin_pin: values.adminPin,
      },
    },
  );

  return businessRowToBusiness(row);
}

export async function initiateFlutterwaveOrderRefund(values: {
  orderId: string;
  reason: string;
  accessToken?: string;
}) {
  return supabaseRequest<{
    status: 'processing' | 'alreadyRefunded';
    orderId: string;
    refundReference?: string;
  }>('/functions/v1/admin-refund-order', {
    method: 'POST',
    ...(values.accessToken ? { accessToken: values.accessToken } : {}),
    body: {
      orderId: values.orderId,
      reason: values.reason.trim(),
    },
  });
}

export async function verifySupabaseAdmin(email: string, password: string) {
  const authResponse = await supabaseRequest<SupabaseAuthResponse>(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      body: {
        email: email.trim().toLowerCase(),
        password,
      },
    },
  );
  const session = toSession(authResponse);

  if (!session) {
    throw new SupabaseApiError('Supabase did not return an admin session.', 502);
  }
  const rows = await supabaseRequest<SupabaseAdminRow[]>('/rest/v1/rpc/get_my_admin_profile', {
    method: 'POST',
    accessToken: session.accessToken,
    body: {},
  });

  if (!rows[0]) {
    await signOutSupabase(session.accessToken).catch(() => undefined);
    throw new SupabaseApiError('This account is not authorized for admin access.', 403);
  }

  return {
    admin: adminRowToUser(rows[0]),
    session: { ...session, portal: 'admin' as const },
  };
}

export async function fetchMySupabaseAdmin(accessToken: string) {
  const rows = await supabaseRequest<SupabaseAdminRow[]>('/rest/v1/rpc/get_my_admin_profile', {
    method: 'POST',
    accessToken,
    body: {},
  });

  if (!rows[0]) {
    throw new SupabaseApiError('This account is not authorized for admin access.', 403);
  }

  return adminRowToUser(rows[0]);
}

export async function fetchSupabaseAdminUsers() {
  const response = await supabaseRequest<{ admins?: SupabaseAdminRow[] }>(
    '/functions/v1/admin-manage-staff',
    {
      method: 'POST',
      body: { action: 'list' },
    },
  );

  return (response.admins ?? []).map(adminRowToUser);
}

export async function createSupabaseCustomerCareAccount(values: {
  fullName: string;
  email: string;
  password: string;
}) {
  const response = await supabaseRequest<{ admin?: SupabaseAdminRow }>(
    '/functions/v1/admin-manage-staff',
    {
      method: 'POST',
      body: { action: 'create', ...values },
    },
  );

  if (!response.admin) {
    throw new SupabaseApiError('Supabase did not return the new customer-care account.', 502);
  }

  return adminRowToUser(response.admin);
}

export async function setSupabaseAdminAccountActive(adminId: string, isActive: boolean) {
  const response = await supabaseRequest<{ admin?: SupabaseAdminRow }>(
    '/functions/v1/admin-manage-staff',
    {
      method: 'POST',
      body: { action: 'setActive', adminId, isActive },
    },
  );

  if (!response.admin) {
    throw new SupabaseApiError('Supabase did not return the updated staff account.', 502);
  }

  return adminRowToUser(response.admin);
}

export async function updateSupabaseAdminPassword(adminId: string, password: string) {
  await supabaseRequest('/functions/v1/admin-manage-staff', {
    method: 'POST',
    body: { action: 'updatePassword', adminId, password },
  });
}

function parseAuthCallbackParams(url: string) {
  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');
  const query =
    queryStart >= 0
      ? url.slice(queryStart + 1, fragmentStart >= 0 ? fragmentStart : undefined)
      : '';
  const fragment = fragmentStart >= 0 ? url.slice(fragmentStart + 1) : '';

  return new URLSearchParams([query, fragment].filter(Boolean).join('&'));
}

export function addOAuthContextToCallbackUrl(
  callbackUrl: string,
  webRedirectPath?: string,
) {
  const [, redirectQuery] = (webRedirectPath ?? '').split('?');

  if (!redirectQuery) {
    return callbackUrl;
  }

  const callbackParams = parseAuthCallbackParams(callbackUrl);
  const contextParams = new URLSearchParams(redirectQuery);
  const additions = new URLSearchParams();

  contextParams.forEach((value, key) => {
    if (!callbackParams.has(key)) {
      additions.set(key, value);
    }
  });

  const additionQuery = additions.toString();

  if (!additionQuery) {
    return callbackUrl;
  }

  const fragmentStart = callbackUrl.indexOf('#');
  const base = fragmentStart >= 0 ? callbackUrl.slice(0, fragmentStart) : callbackUrl;
  const fragment = fragmentStart >= 0 ? callbackUrl.slice(fragmentStart) : '';
  const separator = base.includes('?') ? '&' : '?';

  return `${base}${separator}${additionQuery}${fragment}`;
}

export async function completeSupabaseOAuth(url: string) {
  const params = parseAuthCallbackParams(url);
  const accessToken = params.get('access_token');
  const requestedRole = params.get('oauthRole');
  const oauthMode = params.get('oauthMode');
  const requestedUserRole: UserRole | undefined =
    requestedRole === 'resident' ||
    requestedRole === 'businessOwner' ||
    requestedRole === 'dispatch'
      ? requestedRole
      : undefined;

  if (!accessToken) {
    return undefined;
  }

  const refreshToken = params.get('refresh_token') ?? undefined;
  const expiresIn = params.get('expires_in');
  const tokenType = params.get('token_type') ?? undefined;
  const authUser = await supabaseRequest<SupabaseAuthUser>('/auth/v1/user', {
    accessToken,
  });
  let user: AppUser;

  if (requestedUserRole) {
    const existingProfile = await fetchProfile(authUser.id, accessToken).catch(() => undefined);
    const existingAuthProfile = authUser.email
      ? await fetchProfileByAuthEmail(authUser.email, accessToken).catch(() => undefined)
      : undefined;
    const publicAuthProfile =
      !existingAuthProfile && authUser.email
        ? await fetchProfileByAuthEmail(authUser.email).catch(() => undefined)
        : undefined;
    const matchingProfile = existingAuthProfile ?? publicAuthProfile ?? existingProfile;
    const requestedEmailProfile =
      !matchingProfile && authUser.email
        ? await fetchProfileByEmailAndRole(authUser.email, requestedUserRole, accessToken)
            .then((result) => result?.profile)
            .catch(() => undefined)
        : undefined;
    const isSignupFlow = oauthMode === 'signup' || requestedUserRole === 'resident';

    if (matchingProfile && matchingProfile.role !== requestedUserRole) {
      await signOutSupabase(accessToken).catch(() => undefined);

      throw new SupabaseApiError(
        `This Google account is already connected to a ${roleLabel(
          matchingProfile.role,
        )} account. Create or log in to ${roleLabel(
          requestedUserRole,
        )} with password/OTP to keep that role isolated.`,
        403,
      );
    } else if (!matchingProfile && requestedEmailProfile) {
      const attachedProfile = await attachAuthEmailToProfile(
        requestedEmailProfile,
        authUser,
        accessToken,
      );
      user = await syncProfileNameFromAuth(attachedProfile, authUser, accessToken);
    } else if (!matchingProfile && !isSignupFlow) {
      await signOutSupabase(accessToken).catch(() => undefined);

      if (requestedUserRole === 'dispatch') {
        throw new SupabaseApiError(
          'This Google account is not connected to a dispatch account yet. Use dispatch password login, or create the dispatch account with Google first.',
          403,
        );
      }

      throw new SupabaseApiError(
        'This account is not registered for this portal.',
        403,
      );
    } else if (matchingProfile) {
      user = await syncProfileNameFromAuth(matchingProfile, authUser, accessToken);
    } else {
      if (!authUser.email) {
        await signOutSupabase(accessToken).catch(() => undefined);
        throw new SupabaseApiError(
          'Google did not return an email address for this account.',
          400,
        );
      }

      user = await getOrCreateProfile(
        authUser,
        accessToken,
        buildOAuthSignupValues(authUser, requestedUserRole),
      );
    }
  } else {
    user = await getOrCreateProfile(authUser, accessToken);
  }

  const parsedExpiresIn = expiresIn ? Number(expiresIn) : undefined;
  const hasExpiresIn =
    typeof parsedExpiresIn === 'number' && Number.isFinite(parsedExpiresIn);
  const session: SupabaseSession = {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(hasExpiresIn
      ? { expiresAt: Math.floor(Date.now() / 1000) + Number(parsedExpiresIn) }
      : {}),
    ...(tokenType ? { tokenType } : {}),
  };

  return {
    user,
    storedUser: { ...user, password: '' },
    session,
  };
}

export function getSupabaseNativeOAuthCallbackUrl() {
  return 'urbanconnect://auth/callback';
}

export function getSupabaseNativeOAuthRedirectUrl(_webRedirectPath = '/auth/callback') {
  // Android's auth-session listener and intent filter must receive the exact
  // same callback URL. Role context is restored in-app after the deep link.
  return getSupabaseNativeOAuthCallbackUrl();
}

export function getSupabaseOAuthUrl(
  provider: 'google' | 'apple',
  webRedirectPath = '/auth/callback',
  options: { redirectTo?: string } = {},
) {
  const encodedProvider = encodeURIComponent(provider);
  const [redirectPath = '/auth/callback', redirectQuery] = webRedirectPath.split('?');

  let redirect = options.redirectTo ?? getSupabaseNativeOAuthRedirectUrl(webRedirectPath);

  if (!options.redirectTo) {
    try {
      if (typeof window !== 'undefined' && (window as any).location?.origin) {
      // Use a web-friendly redirect when running in a browser so the OAuth
      // flow returns to the web app instead of the native deep link.
        const normalizedPath = redirectPath.startsWith('/')
          ? redirectPath
          : `/${redirectPath}`;
        const normalizedRedirect = redirectQuery
          ? `${normalizedPath}?${redirectQuery}`
          : normalizedPath;
        redirect = `${(window as any).location.origin}${normalizedRedirect}`;
      }
    } catch {
      // ignore and fall back to deep link
    }
  }

  const redirectTo = encodeURIComponent(redirect);

  return `${supabaseConfig.url}/auth/v1/authorize?provider=${encodedProvider}&redirect_to=${redirectTo}`;
}

function businessRowToBusiness(row: SupabaseBusinessRow): Business {
  const ownerUserId = optionalString(row.owner_user_id);
  const ownerEmail = optionalString(row.owner_email);
  const subscriptionPaidAt = optionalString(row.subscription_paid_at);
  const subscriptionNextBillingAt = optionalString(row.subscription_next_billing_at);
  const sku = optionalString(row.sku);
  const priceLabel = optionalString(row.price_label);
  const updatedAt = optionalString(row.updated_at);

  return {
    id: row.id,
    estateId: row.estate_id,
    listingType: row.listing_type,
    ...(row.listing_source ? { listingSource: row.listing_source } : {}),
    ...(row.listing_audience ? { listingAudience: row.listing_audience } : {}),
    status: row.status ?? 'active',
    ...(row.subscription_cycle ? { subscriptionCycle: row.subscription_cycle } : {}),
    ...(row.subscription_status ? { subscriptionStatus: row.subscription_status } : {}),
    ...(row.verified_amount !== undefined && row.verified_amount !== null
      ? { verifiedAmount: toNumber(row.verified_amount) }
      : {}),
    ...(subscriptionPaidAt ? { subscriptionPaidAt } : {}),
    ...(subscriptionNextBillingAt ? { subscriptionNextBillingAt } : {}),
    ...(row.subscription_item_count ? { subscriptionItemCount: row.subscription_item_count } : {}),
    name: row.name,
    ownerName: row.owner_name,
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(ownerEmail ? { ownerEmail } : {}),
    cluster: row.cluster as RiverParkCluster,
    category:
      row.listing_type === 'product'
        ? normalizeProductCategory(row.category, row.name, row.description, row.long_description)
        : row.category,
    description: row.description,
    longDescription: row.long_description,
    imageUrl: row.image_url,
    media: row.media ?? [],
    address: row.address,
    ...(sku ? { sku } : {}),
    stockQuantity: row.stock_quantity ?? 0,
    reorderLevel: row.reorder_level ?? 0,
    price: toNumber(row.price),
    ...(priceLabel ? { priceLabel } : {}),
    responseTime: row.response_time,
    verified: row.verified,
    riverParkVerified: Boolean(row.river_park_verified),
    services: row.services ?? [],
    tags: row.tags ?? [],
    contact: row.contact ?? { phone: '', email: '' },
    createdAt: row.created_at,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function orderRowToOrder(row: SupabaseOrderRow): Order {
  const note = optionalString(row.note);
  const expectedDeliveryAt = optionalString(row.expected_delivery_at);
  const userEmail = optionalString(row.user_email);
  const deliveryContactPhone = optionalString(row.delivery_contact_phone);
  const itemsByBusinessId = new Map<string, OrderItem>();
  const deliveryLocation = orderRowDeliveryLocation(row);

  (row.order_items ?? []).forEach((item) => {
    const ownerUserId = optionalString(item.owner_user_id);
    const sku = optionalString(item.sku);
    const businessId = item.business_id;
    const unitPrice = toNumber(item.unit_price);
    const quantity = item.quantity;
    const lineTotal = toNumber(item.line_total);
    const existingItem = itemsByBusinessId.get(businessId);

    if (existingItem) {
      const nextQuantity = Math.max(existingItem.quantity, quantity);
      const nextLineTotal = Math.max(existingItem.lineTotal, lineTotal, unitPrice * nextQuantity);

      itemsByBusinessId.set(businessId, {
        ...existingItem,
        quantity: nextQuantity,
        lineTotal: nextLineTotal,
      });
      return;
    }

    itemsByBusinessId.set(businessId, {
      businessId,
      businessName: item.business_name,
      ownerName: item.owner_name,
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(sku ? { sku } : {}),
      quantity,
      unitPrice,
      lineTotal,
    });
  });

  const items = Array.from(itemsByBusinessId.values());
  const timeline = (row.order_timeline_events ?? [])
    .map<OrderTimelineEvent>((event) => {
      const status = normalizeOrderStatus(event.status);

      return {
        id: event.id,
        status,
        label: event.label,
        note: event.note,
        createdAt: event.created_at,
      };
    })
    .sort(
      (leftEvent, rightEvent) =>
        new Date(leftEvent.createdAt).getTime() - new Date(rightEvent.createdAt).getTime(),
    );
  const status = normalizeOrderStatus(row.status);

  return {
    id: row.id,
    userId: row.user_id,
    ...(userEmail ? { userEmail } : {}),
    userName: row.user_name,
    estateId: row.estate_id,
    deliveryAddress: row.delivery_address,
    deliveryCluster: row.delivery_cluster,
    deliveryContactPhone: deliveryContactPhone || '',
    ...(deliveryLocation ? { deliveryLocation } : {}),
    ...(note ? { note } : {}),
    items,
    subtotal: toNumber(row.subtotal),
    sellerPackingSupport: toNumber(row.seller_packing_support),
    serviceFee: toNumber(row.service_fee),
    deliveryFee: toNumber(row.delivery_fee),
    totalAmount: toNumber(row.total_amount),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(expectedDeliveryAt ? { expectedDeliveryAt } : {}),
    timeline,
  };
}

function ownerProfileRowToProfile(row: SupabaseOwnerProfileRow): OwnerBusinessProfile {
  const whatsapp = optionalString(row.whatsapp);
  const website = optionalString(row.website);
  const bio = optionalString(row.bio);
  const profileImage = optionalString(row.profile_image);
  const instagram = optionalString(row.instagram);
  const facebook = optionalString(row.facebook);
  const x = optionalString(row.x);
  const tiktok = optionalString(row.tiktok);
  const coverImage = optionalString(row.cover_image);
  const galleryImages = optionalString(row.gallery_images);
  const galleryVideos = optionalString(row.gallery_videos);
  const openingTime = optionalString(row.opening_time);
  const closingTime = optionalString(row.closing_time);
  const subscriptionPaidAt = optionalString(row.subscription_paid_at);
  const subscriptionNextBillingAt = optionalString(row.subscription_next_billing_at);
  const payoutBankCode = optionalString(row.payout_bank_code);
  const payoutBankName = optionalString(row.payout_bank_name);
  const payoutAccountNumber = optionalString(row.payout_account_number);
  const payoutAccountName = optionalString(row.payout_account_name);
  const payoutVerifiedAt = optionalString(row.payout_verified_at);

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    accountName: row.account_name,
    accountEmail: row.account_email,
    ownerName: row.owner_name,
    bio: bio ?? '',
    profileImage: profileImage ?? '',
    phone: row.phone,
    whatsapp: whatsapp ?? '',
    email: row.email,
    website: website ?? '',
    instagram: instagram ?? '',
    facebook: facebook ?? '',
    x: x ?? '',
    tiktok: tiktok ?? '',
    address: row.address,
    ...(openingTime ? { openingTime } : {}),
    ...(closingTime ? { closingTime } : {}),
    openDays: Array.isArray(row.open_days) ? row.open_days.filter(Boolean) : [],
    coverImage: coverImage ?? '',
    galleryImages: galleryImages ?? '',
    galleryVideos: galleryVideos ?? '',
    ...(row.subscription_cycle ? { subscriptionCycle: row.subscription_cycle } : {}),
    ...(row.subscription_status ? { subscriptionStatus: row.subscription_status } : {}),
    ...(row.verified_amount !== undefined && row.verified_amount !== null
      ? { verifiedAmount: toNumber(row.verified_amount) }
      : {}),
    ...(subscriptionPaidAt ? { subscriptionPaidAt } : {}),
    ...(subscriptionNextBillingAt ? { subscriptionNextBillingAt } : {}),
    ...(row.subscription_item_count ? { subscriptionItemCount: row.subscription_item_count } : {}),
    riverParkVerified: Boolean(row.river_park_verified),
    ...(payoutBankCode ? { payoutBankCode } : {}),
    ...(payoutBankName ? { payoutBankName } : {}),
    ...(payoutAccountNumber ? { payoutAccountNumber } : {}),
    ...(payoutAccountName ? { payoutAccountName } : {}),
    ...(payoutVerifiedAt ? { payoutVerifiedAt } : {}),
    updatedAt: row.updated_at,
  };
}

function subscriptionPaymentRowToPayment(row: SupabaseSubscriptionPaymentRow): SubscriptionPayment {
  const paidAt = optionalString(row.paid_at);
  const checkoutUrl = optionalString(row.checkout_url);

  return {
    id: row.id,
    reference: row.reference,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    cycle: row.cycle,
    amount: toNumber(row.amount),
    currency: row.currency,
    status: row.status,
    ...(checkoutUrl ? { checkoutUrl } : {}),
    ...(paidAt ? { paidAt } : {}),
    ...(row.raw_payload ? { rawPayload: JSON.stringify(row.raw_payload) } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function withdrawalRowToWithdrawal(row: SupabaseWithdrawalRow): WithdrawalRequest {
  const kycType = row.kyc_type === 'nin' ? 'nin' : 'bvn';
  const fallbackKycLast4 = row.account_number.replace(/\D/g, '').slice(-4);
  const kycLast4 = optionalString(row.kyc_last4) ?? (fallbackKycLast4 || '0000');
  const kycReference =
    optionalString(row.kyc_reference) ?? `${kycType.toUpperCase()} ending ${kycLast4}`;

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    ...(row.account_name ? { accountName: row.account_name } : {}),
    kycType,
    kycLast4,
    kycReference,
    amount: toNumber(row.amount),
    status: row.status,
    createdAt: row.created_at,
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    ...(row.provider_reference ? { providerReference: row.provider_reference } : {}),
    ...(row.failure_reason ? { failureReason: row.failure_reason } : {}),
  };
}

function virtualAccountRowToVirtualAccount(row: SupabaseVirtualAccountRow): VirtualAccount {
  const kycType = row.kyc_type ?? undefined;
  const kycLast4 = optionalString(row.kyc_last4);
  const kycReference = optionalString(row.kyc_reference);
  const idDocumentPath = optionalString(row.id_document_path);
  const idDocumentName = optionalString(row.id_document_name);

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    provider: row.provider,
    providerReference: row.provider_reference,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountName: row.account_name,
    ...(kycType ? { kycType } : {}),
    ...(kycLast4 ? { kycLast4 } : {}),
    ...(kycReference ? { kycReference } : {}),
    ...(idDocumentPath ? { idDocumentUri: idDocumentPath } : {}),
    ...(idDocumentName ? { idDocumentName } : {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dynamicDepositRowToDeposit(row: SupabaseDynamicDepositRow): DynamicDepositAccount {
  const expiresAt = optionalString(row.expires_at);
  const paidAt = optionalString(row.paid_at);
  const providerChargeId = optionalString(row.provider_charge_id);
  const failureReason = optionalString(row.failure_reason);

  return withDynamicDepositExpiry({
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userRole: row.user_role,
    provider: row.provider,
    providerReference: row.provider_reference,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountName: row.account_name,
    amount: toNumber(row.amount),
    currency: row.currency,
    status: row.status,
    ...(expiresAt ? { expiresAt } : {}),
    ...(paidAt ? { paidAt } : {}),
    ...(providerChargeId ? { providerChargeId } : {}),
    ...(failureReason ? { failureReason } : {}),
    ...(row.raw_payload ? { rawPayload: JSON.stringify(row.raw_payload) } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function cleanDigits(value: string) {
  return value.replace(/\D/g, '');
}

function findProviderString(value: unknown, fieldNames: string[]): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const normalizedNames = new Set(fieldNames.map((fieldName) => fieldName.toLowerCase()));
  const queue = [value as JsonRecord];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedNames.has(normalizedKey) &&
        (typeof nestedValue === 'string' || typeof nestedValue === 'number')
      ) {
        const result = String(nestedValue).trim();

        if (result) {
          return result;
        }
      }

      if (nestedValue && typeof nestedValue === 'object') {
        queue.push(nestedValue as JsonRecord);
      }
    }
  }

  return undefined;
}

export async function saveSubscriptionPaymentToSupabase(payment: SubscriptionPayment) {
  return supabaseRequest('/rest/v1/subscription_payments?on_conflict=id', {
    method: 'POST',
    body: {
      id: payment.id,
      reference: payment.reference,
      owner_user_id: payment.ownerUserId,
      owner_name: payment.ownerName,
      owner_email: payment.ownerEmail,
      cycle: payment.cycle,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      checkout_url: payment.checkoutUrl ?? null,
      paid_at: payment.paidAt ?? null,
      raw_payload: payment.rawPayload ? JSON.parse(payment.rawPayload) : null,
      created_at: payment.createdAt,
      updated_at: payment.updatedAt,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function createFlutterwaveCheckoutSession(values: {
  reference: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  title: string;
  description: string;
  purpose: 'cart' | 'subscription' | 'addFunds';
  meta?: Record<string, unknown>;
  paymentOptions?: string[];
}) {
  const response = await supabaseRequest<FlutterwaveCheckoutFunctionResponse>(
    '/functions/v1/create-flutterwave-checkout',
    {
      method: 'POST',
      body: {
        reference: values.reference,
        amount: values.amount,
        currency: 'NGN',
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        title: values.title,
        description: values.description,
        redirectUrl: flutterwaveCheckoutReturnUrl,
        purpose: values.purpose,
        paymentOptions: values.paymentOptions ?? ['card', 'account', 'banktransfer'],
        meta: values.meta ?? {},
      },
    },
  );

  const checkoutUrl =
    optionalString(response.checkoutUrl) ??
    findProviderString(response.providerBody, ['link', 'checkout_url', 'checkoutUrl']);
  const reference =
    optionalString(response.reference) ??
    findProviderString(response.providerBody, ['tx_ref', 'txRef', 'reference']) ??
    values.reference;

  if (!checkoutUrl) {
    throw new SupabaseApiError('Flutterwave did not return a checkout link.', 502);
  }

  return {
    reference,
    amount: toNumber(response.amount ?? values.amount),
    currency: optionalString(response.currency) ?? 'NGN',
    checkoutUrl,
    paymentOptions: response.paymentOptions ?? ['card', 'account', 'banktransfer'],
    ...(response.mode ? { mode: response.mode } : {}),
    ...(response.providerBody ? { providerBody: JSON.stringify(response.providerBody) } : {}),
  } satisfies FlutterwaveCheckoutSession;
}

export async function fetchFlutterwaveNigerianBanks(accessToken: string) {
  const response = await supabaseRequest<{ banks?: FlutterwaveBank[] }>(
    '/functions/v1/verify-seller-bank-account',
    {
      method: 'POST',
      accessToken,
      body: { action: 'banks' },
    },
  );

  return Array.isArray(response.banks) ? response.banks : [];
}

export async function verifySellerPayoutAccount(
  accessToken: string,
  values: {
    ownerUserId: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
  },
) {
  const response = await supabaseRequest<{
    account?: VerifiedSellerPayoutAccount;
  }>('/functions/v1/verify-seller-bank-account', {
    method: 'POST',
    accessToken,
    body: {
      action: 'resolve',
      ownerUserId: values.ownerUserId,
      bankCode: values.bankCode,
      bankName: values.bankName,
      accountNumber: values.accountNumber,
    },
  });

  if (!response.account?.accountName) {
    throw new SupabaseApiError(
      'Flutterwave did not return the verified account name.',
      502,
    );
  }

  return response.account;
}

export async function saveVerifiedSellerPayoutAccountToSupabase(
  accessToken: string,
  values: VerifiedSellerPayoutAccount & { ownerUserId: string },
) {
  const response = await supabaseRequest<{
    account?: VerifiedSellerPayoutAccount;
  }>('/functions/v1/verify-seller-bank-account', {
    method: 'POST',
    accessToken,
    body: {
      action: 'save',
      ownerUserId: values.ownerUserId,
      bankCode: values.bankCode,
      bankName: values.bankName,
      accountNumber: values.accountNumber,
    },
  });

  if (!response.account?.accountName) {
    throw new SupabaseApiError(
      'Flutterwave did not return the verified account name.',
      502,
    );
  }

  return response.account;
}

export async function verifyCacBusinessRegistration(
  accessToken: string,
  values: {
    ownerUserId: string;
    cacNumber: string;
  },
) {
  const response = await supabaseRequest<{
    business?: {
      cacNumber: string;
      businessName: string;
      verifiedAt: string;
    };
  }>('/functions/v1/verify-business-cac', {
    method: 'POST',
    accessToken,
    body: {
      ownerUserId: values.ownerUserId,
      cacNumber: values.cacNumber,
    },
  });

  if (!response.business?.businessName) {
    throw new SupabaseApiError(
      'CAC API did not return the verified business name.',
      502,
    );
  }

  return response.business;
}

export const verifyFlutterwaveBusinessCac = verifyCacBusinessRegistration;

export async function createFlutterwaveVirtualAccount(
  owner: AppUser,
  values: {
    kycType?: WithdrawalRequest['kycType'];
    kycNumber?: string;
    purpose?: 'deposit' | 'withdrawal';
    idDocumentPath?: string;
    idDocumentName?: string;
  } = {},
) {
  const cleanKycNumber = values.kycNumber ? cleanDigits(values.kycNumber) : '';
  const hasKyc = Boolean(values.kycType && cleanKycNumber.length === 11);
  const response = await supabaseRequest<FlutterwaveVirtualAccountFunctionResponse>(
    '/functions/v1/create-flutterwave-virtual-account',
    {
      method: 'POST',
      body: {
        ownerUserId: owner.id,
        ownerName: owner.businessName ?? owner.fullName,
        ownerEmail: owner.email,
        phoneNumber: owner.phoneNumber,
        purpose: values.purpose ?? (hasKyc ? 'withdrawal' : 'deposit'),
        ...(values.kycType ? { kycType: values.kycType } : {}),
        ...(cleanKycNumber ? { kycNumber: cleanKycNumber } : {}),
        ...(values.idDocumentPath ? { idDocumentPath: values.idDocumentPath } : {}),
        ...(values.idDocumentName ? { idDocumentName: values.idDocumentName } : {}),
        narration: `${owner.businessName ?? owner.fullName} View2Connect wallet`,
      },
    },
  );
  const providerBody = response.providerBody;
  const accountNumber =
    optionalString(response.accountNumber) ??
    findProviderString(providerBody, ['account_number', 'accountNumber', 'account_no', 'nuban']);
  const accountName =
    optionalString(response.accountName) ??
    findProviderString(providerBody, ['account_name', 'accountName', 'fullname', 'full_name']);
  const bankName =
    optionalString(response.bankName) ??
    findProviderString(providerBody, ['bank_name', 'bankName', 'bank']);

  if (!accountNumber) {
    throw new SupabaseApiError('Flutterwave did not return a virtual account number.', 502);
  }

  const now = new Date().toISOString();
  const kycLast4 = optionalString(response.kycLast4) ?? (hasKyc ? cleanKycNumber.slice(-4) : undefined);
  const kycReference =
    optionalString(response.kycReference) ??
    (hasKyc ? `${values.kycType!.toUpperCase()} ending ${kycLast4}` : undefined);

  return {
    id: `virtual-account-${owner.id}`,
    ownerUserId: owner.id,
    ownerName: owner.businessName ?? owner.fullName,
    ownerEmail: owner.email,
    provider: 'flutterwave',
    providerReference: optionalString(response.txRef) ?? `urbanconnect-va-${owner.id}`,
    bankName: bankName ?? 'Flutterwave',
    accountNumber,
    accountName: accountName ?? owner.businessName ?? owner.fullName,
    ...(values.kycType && hasKyc ? { kycType: values.kycType } : {}),
    ...(kycLast4 ? { kycLast4 } : {}),
    ...(kycReference ? { kycReference } : {}),
    ...(values.idDocumentPath ? { idDocumentUri: values.idDocumentPath } : {}),
    ...(values.idDocumentName ? { idDocumentName: values.idDocumentName } : {}),
    status: hasKyc ? 'verified' : 'depositReady',
    createdAt: now,
    updatedAt: now,
  } satisfies VirtualAccount;
}

export async function createFlutterwaveDynamicDepositAccount(
  user: AppUser,
  amount: number,
) {
  const roundedAmount = Math.max(0, Math.floor(amount));

  if (roundedAmount <= 0) {
    throw new SupabaseApiError('Enter a valid deposit amount.', 400);
  }

  if (MINIMUM_ADD_FUNDS_DEPOSIT > 0 && roundedAmount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
    throw new SupabaseApiError(
      `Add funds must be higher than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)}.`,
      400,
    );
  }

  const response = await supabaseRequest<FlutterwaveVirtualAccountFunctionResponse>(
    '/functions/v1/create-flutterwave-virtual-account',
    {
      method: 'POST',
      body: {
        ownerUserId: user.id,
        ownerName: user.businessName ?? user.fullName,
        ownerEmail: user.email,
        phoneNumber: user.phoneNumber,
        purpose: 'deposit',
        amount: roundedAmount,
        narration: `${user.businessName ?? user.fullName} View2Connect deposit`,
      },
    },
  );
  const providerBody = response.providerBody;
  const accountNumber =
    optionalString(response.accountNumber) ??
    findProviderString(providerBody, ['account_number', 'accountNumber', 'account_no', 'nuban']);
  const accountName =
    optionalString(response.accountName) ??
    findProviderString(providerBody, ['account_name', 'accountName', 'fullname', 'full_name']);
  const bankName =
    optionalString(response.bankName) ??
    findProviderString(providerBody, ['bank_name', 'bankName', 'bank']);
  const reference =
    optionalString(response.txRef) ??
    findProviderString(providerBody, ['tx_ref', 'txRef', 'flw_ref', 'flwRef', 'order_ref']);

  if (!accountNumber) {
    throw new SupabaseApiError('Flutterwave did not return a deposit account number.', 502);
  }

  const now = new Date().toISOString();
  const expiresAt =
    optionalString(response.expiresAt) ??
    findProviderString(providerBody, [
      'account_expiration_datetime',
      'account_expiration',
      'expiry_date',
      'expires_at',
      'expiresAt',
    ]) ??
    getDynamicDepositExpiresAt(now);

  return {
    id: `deposit-${reference ?? Date.now()}`,
    reference: reference ?? `urbanconnect-deposit-${user.id}-${Date.now()}`,
    userId: user.id,
    userName: user.fullName,
    userEmail: user.email,
    userRole: user.role,
    provider: 'flutterwave',
    providerReference: reference ?? `urbanconnect-deposit-${user.id}`,
    bankName: bankName ?? 'Flutterwave',
    accountNumber,
    accountName: accountName ?? user.businessName ?? user.fullName,
    amount: toNumber(response.amount ?? roundedAmount),
    currency: optionalString(response.currency) ?? 'NGN',
    status: 'pending',
    expiresAt,
    ...(providerBody ? { rawPayload: JSON.stringify(providerBody) } : {}),
    createdAt: now,
    updatedAt: now,
  } satisfies DynamicDepositAccount;
}

export async function saveVirtualAccountToSupabase(account: VirtualAccount) {
  return supabaseRequest('/rest/v1/virtual_accounts?on_conflict=id', {
    method: 'POST',
    body: {
      id: account.id,
      owner_user_id: account.ownerUserId,
      owner_name: account.ownerName,
      owner_email: account.ownerEmail,
      provider: account.provider,
      provider_reference: account.providerReference,
      bank_name: account.bankName,
      account_number: account.accountNumber,
      account_name: account.accountName,
      kyc_type: account.kycType ?? null,
      kyc_last4: account.kycLast4 ?? null,
      kyc_reference: account.kycReference ?? null,
      id_document_path: account.idDocumentUri ?? null,
      id_document_name: account.idDocumentName ?? null,
      status: account.status,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function saveWithdrawalToSupabase(withdrawal: WithdrawalRequest) {
  return supabaseRequest('/rest/v1/withdrawal_requests', {
    method: 'POST',
    body: {
      id: withdrawal.id,
      owner_user_id: withdrawal.ownerUserId,
      owner_name: withdrawal.ownerName,
      owner_email: withdrawal.ownerEmail,
      bank_name: withdrawal.bankName,
      account_number: withdrawal.accountNumber,
      account_name: withdrawal.accountName ?? null,
      kyc_type: withdrawal.kycType,
      kyc_last4: withdrawal.kycLast4,
      kyc_reference: withdrawal.kycReference,
      amount: withdrawal.amount,
      status: withdrawal.status,
      created_at: withdrawal.createdAt,
    },
    headers: {
      Prefer: 'return=minimal',
    },
  });
}

export async function requestSellerWithdrawalFromSupabase(amount: number) {
  const row = await supabaseRequest<SupabaseWithdrawalRow>(
    '/rest/v1/rpc/request_seller_withdrawal',
    {
      method: 'POST',
      body: { requested_amount: amount },
    },
  );

  return withdrawalRowToWithdrawal(row);
}

export async function updateWithdrawalStatusInSupabase(
  withdrawalId: string,
  status: Exclude<WithdrawalRequest['status'], 'pending'>,
  providerReference?: string,
  failureReason?: string,
) {
  const row = await supabaseRequest<SupabaseWithdrawalRow>(
    '/rest/v1/rpc/admin_update_withdrawal_status',
    {
      method: 'POST',
      body: {
        target_withdrawal_id: withdrawalId,
        target_status: status,
        target_provider_reference: providerReference?.trim() || null,
        target_failure_reason: failureReason?.trim() || null,
      },
    },
  );

  return withdrawalRowToWithdrawal(row);
}

export async function saveSupportMessageToSupabase(message: SupportMessage) {
  return supabaseRequest('/rest/v1/support_messages', {
    method: 'POST',
    body: {
      id: message.id,
      conversation_id: message.conversationId,
      user_id: message.userId,
      user_name: message.userName,
      user_role: message.userRole,
      sender_name: message.senderName,
      sender_role: message.senderRole,
      text: message.text,
      context_type: message.contextType ?? null,
      context_id: message.contextId ?? null,
      context_label: message.contextLabel ?? null,
      attachments: message.attachments ?? [],
      created_at: message.createdAt,
    },
    headers: {
      Prefer: 'return=minimal',
    },
  });
}

export async function saveStaffSupportReplyToSupabase(message: SupportMessage) {
  return supabaseRequest<boolean>('/rest/v1/rpc/staff_reply_to_support', {
    method: 'POST',
    body: {
      target_conversation_id: message.conversationId,
      target_message_id: message.id,
      reply_text: message.text,
    },
  });
}

export async function saveChatMessageToSupabase(message: ChatMessage) {
  return supabaseRequest('/rest/v1/listing_messages?on_conflict=id', {
    method: 'POST',
    body: {
      id: message.id,
      business_id: message.businessId,
      sender_user_id: message.senderUserId ?? null,
      recipient_user_id: message.recipientUserId ?? null,
      sender_name: message.senderName,
      sender_type: message.senderType,
      text: message.text,
      attachments: message.attachments ?? [],
      created_at: message.createdAt,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function fetchCustomerCartFromSupabase(userId: string): Promise<CartItem[]> {
  const rows = await supabaseRequest<SupabaseCustomerCartItemRow[]>(
    `/rest/v1/customer_cart_items?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
  );

  return rows.map((row) => ({
    userId: row.user_id,
    businessId: row.business_id,
    quantity: row.quantity,
    updatedAt: row.updated_at,
  }));
}

export async function saveCartItemToSupabase(userId: string, item: CartItem) {
  return supabaseRequest('/rest/v1/customer_cart_items?on_conflict=user_id,business_id', {
    method: 'POST',
    body: {
      user_id: userId,
      business_id: item.businessId,
      quantity: item.quantity,
      updated_at: item.updatedAt ?? new Date().toISOString(),
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function deleteCartItemFromSupabase(userId: string, businessId: string) {
  return supabaseRequest(
    `/rest/v1/customer_cart_items?user_id=eq.${encodeURIComponent(userId)}&business_id=eq.${encodeURIComponent(businessId)}`,
    {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
      },
    },
  );
}

export async function clearCustomerCartInSupabase(userId: string) {
  return supabaseRequest(
    `/rest/v1/customer_cart_items?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
      },
    },
  );
}

export async function fetchCustomerDeliveryLocationFromSupabase(
  userId: string,
): Promise<DeliveryLocation | undefined> {
  const rows = await supabaseRequest<SupabaseDeliveryLocationRow[]>(
    `/rest/v1/customer_delivery_locations?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );

  return rows[0] ? deliveryLocationRowToLocation(rows[0]) : undefined;
}

export async function saveCustomerDeliveryLocationToSupabase(location: DeliveryLocation) {
  return supabaseRequest('/rest/v1/customer_delivery_locations?on_conflict=user_id', {
    method: 'POST',
    body: {
      user_id: location.userId,
      formatted_address: location.formattedAddress,
      country: location.country || null,
      state_region: location.stateOrRegion || null,
      city: location.city || null,
      area_district: location.areaOrDistrict || null,
      street_name: location.streetName || null,
      building_info: location.buildingInfo || null,
      landmark: location.landmark || null,
      latitude: location.latitude,
      longitude: location.longitude,
      additional_instructions: location.additionalInstructions || null,
      place_id: location.placeId ?? null,
      source: location.source,
      updated_at: location.updatedAt,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function saveNotificationToSupabase(notification: AppNotification) {
  return supabaseRequest('/rest/v1/notifications?on_conflict=id', {
    method: 'POST',
    body: {
      id: notification.id,
      user_id: notification.userId,
      user_name: notification.userName,
      audience: notification.audience,
      title: notification.title,
      body: notification.body,
      context_type: notification.contextType ?? null,
      context_id: notification.contextId ?? null,
      created_at: notification.createdAt,
      read_at: notification.readAt ?? null,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function markMyNotificationsReadInSupabase() {
  return supabaseRequest<number>('/rest/v1/rpc/mark_my_notifications_read', {
    method: 'POST',
    body: {},
  });
}

export async function saveEmailLogToSupabase(log: AutomatedEmailLog) {
  return supabaseRequest('/rest/v1/email_logs?on_conflict=id', {
    method: 'POST',
    body: {
      id: log.id,
      order_id: log.orderId ?? null,
      business_id: log.businessId ?? null,
      recipient_type: log.recipientType,
      recipient_name: log.recipientName,
      recipient_email: log.recipientEmail,
      subject: log.subject,
      body: log.body,
      status: log.status,
      created_at: log.createdAt,
      sent_at: log.sentAt ?? null,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function sendEmailLogThroughSupabaseFunction(log: AutomatedEmailLog) {
  return supabaseRequest<{ id?: string; status: 'sent' }>('/functions/v1/send-notification-email', {
    method: 'POST',
    body: {
      id: log.id,
      orderId: log.orderId ?? null,
      businessId: log.businessId ?? null,
      recipientType: log.recipientType,
      recipientName: log.recipientName,
      recipientEmail: log.recipientEmail,
      subject: log.subject,
      body: log.body,
      createdAt: log.createdAt,
    },
  });
}

export async function sendTermiiPhoneOtp(phoneNumber: string, purpose = 'verify your account') {
  return supabaseRequest<{ status: 'sent'; phoneNumber: string; pinId: string }>(
    '/functions/v1/send-termii-otp',
    {
      method: 'POST',
      body: {
        phoneNumber,
        purpose,
      },
    },
  );
}

export async function verifyTermiiPhoneOtp(pinId: string, pin: string) {
  return supabaseRequest<{ status: 'verified'; verified: true; pinId: string }>(
    '/functions/v1/verify-termii-otp',
    {
      method: 'POST',
      body: {
        pinId,
        pin,
      },
    },
  );
}

export async function saveOrderToSupabase(order: Order) {
  const deliveryLocation = order.deliveryLocation;
  const body = {
    id: order.id,
    user_id: order.userId,
    user_email: order.userEmail ?? null,
    user_name: order.userName,
    estate_id: order.estateId,
    delivery_address: order.deliveryAddress,
    delivery_cluster: order.deliveryCluster,
    delivery_contact_phone: order.deliveryContactPhone || null,
    delivery_country: deliveryLocation?.country || null,
    delivery_state_region: deliveryLocation?.stateOrRegion || null,
    delivery_city: deliveryLocation?.city || null,
    delivery_area_district: deliveryLocation?.areaOrDistrict || null,
    delivery_street_name: deliveryLocation?.streetName || null,
    delivery_building_info: deliveryLocation?.buildingInfo || null,
    delivery_landmark: deliveryLocation?.landmark || null,
    delivery_latitude: deliveryLocation?.latitude ?? null,
    delivery_longitude: deliveryLocation?.longitude ?? null,
    delivery_place_id: deliveryLocation?.placeId ?? null,
    delivery_location_source: deliveryLocation?.source ?? null,
    delivery_instructions: deliveryLocation?.additionalInstructions || null,
    note: order.note ?? null,
    subtotal: order.subtotal,
    seller_packing_support: order.sellerPackingSupport,
    service_fee: order.serviceFee,
    delivery_fee: order.deliveryFee,
    total_amount: order.totalAmount,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    status: order.status,
    expected_delivery_at: order.expectedDeliveryAt ?? null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
  const upsertOrder = (payload: Record<string, unknown>) =>
    supabaseRequest('/rest/v1/orders?on_conflict=id', {
      method: 'POST',
      body: payload,
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
    });

  try {
    await upsertOrder(body);
  } catch (error) {
    if (
      error instanceof SupabaseApiError &&
      /seller_packing_support|delivery_contact_phone|delivery_country|delivery_state_region|delivery_city|delivery_area_district|delivery_street_name|delivery_building_info|delivery_landmark|delivery_latitude|delivery_longitude|delivery_place_id|delivery_location_source|delivery_instructions|schema cache|column/i.test(error.message)
    ) {
      const {
        seller_packing_support: _sellerPackingSupport,
        delivery_contact_phone: _deliveryContactPhone,
        delivery_country: _deliveryCountry,
        delivery_state_region: _deliveryStateRegion,
        delivery_city: _deliveryCity,
        delivery_area_district: _deliveryAreaDistrict,
        delivery_street_name: _deliveryStreetName,
        delivery_building_info: _deliveryBuildingInfo,
        delivery_landmark: _deliveryLandmark,
        delivery_latitude: _deliveryLatitude,
        delivery_longitude: _deliveryLongitude,
        delivery_place_id: _deliveryPlaceId,
        delivery_location_source: _deliveryLocationSource,
        delivery_instructions: _deliveryInstructions,
        ...fallbackBody
      } = body;

      await upsertOrder(fallbackBody);
    } else if (
      error instanceof SupabaseApiError &&
      /payment_method|orders_payment_method_check|check constraint/i.test(error.message)
    ) {
      await upsertOrder({ ...body, payment_method: 'bankTransfer' });
    } else {
      throw error;
    }
  }

  await supabaseRequest(`/rest/v1/order_items?order_id=eq.${encodeURIComponent(order.id)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  }).catch(() => undefined);

  await supabaseRequest('/rest/v1/order_items', {
    method: 'POST',
    body: order.items.map((item) => ({
      order_id: order.id,
      business_id: item.businessId,
      business_name: item.businessName,
      owner_name: item.ownerName,
      owner_user_id: item.ownerUserId ?? null,
      sku: item.sku ?? null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    })),
    headers: {
      Prefer: 'return=minimal',
    },
  }).catch(() => undefined);

  await supabaseRequest('/rest/v1/order_timeline_events?on_conflict=id', {
    method: 'POST',
    body: order.timeline.map((event) => ({
      id: event.id,
      order_id: order.id,
      status: event.status,
      label: event.label,
      note: event.note,
      created_at: event.createdAt,
    })),
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  }).catch(() => undefined);
}

export async function updateOrderStatusInSupabase(
  orderId: string,
  status: Order['status'],
) {
  await supabaseRequest('/rest/v1/rpc/admin_update_order_status', {
    method: 'POST',
    body: {
      target_order_id: orderId,
      target_status: status,
    },
  });
}

export async function markSellerOrderReadyInSupabase(orderId: string) {
  return supabaseRequest<boolean>('/rest/v1/rpc/seller_mark_order_ready', {
    method: 'POST',
    body: { target_order_id: orderId },
  });
}

export async function createServerMarketplaceOrder(values: {
  items: Array<{ businessId: string; quantity: number }>;
  deliveryAddress: string;
  deliveryCluster: string;
  deliveryContactPhone: string;
  deliveryLocation?: DeliveryLocation;
  note?: string;
  paymentMethod: 'flutterwave' | 'walletAccount';
}) {
  const location = values.deliveryLocation;
  const created = await supabaseRequest<SupabaseOrderRow>('/rest/v1/rpc/create_marketplace_order', {
    method: 'POST',
    body: {
      p_items: values.items.map((item) => ({
        businessId: item.businessId,
        quantity: item.quantity,
      })),
      p_delivery: {
        formattedAddress: location?.formattedAddress || values.deliveryAddress.trim(),
        contactPhone: values.deliveryContactPhone.trim(),
        country: location?.country ?? '',
        stateRegion: location?.stateOrRegion ?? '',
        city: location?.city ?? '',
        areaDistrict: location?.areaOrDistrict || values.deliveryCluster.trim(),
        streetName: location?.streetName ?? '',
        buildingInfo: location?.buildingInfo ?? '',
        landmark: location?.landmark ?? '',
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        placeId: location?.placeId ?? '',
        source: location?.source ?? 'manual',
        additionalInstructions: location?.additionalInstructions ?? '',
        note: values.note?.trim() ?? '',
      },
      p_payment_method: values.paymentMethod,
    },
  });
  const rows = await supabaseRequest<SupabaseOrderRow[]>(
    `/rest/v1/orders?select=*,order_items(*),order_timeline_events(*)&id=eq.${encodeURIComponent(created.id)}&limit=1`,
  );

  if (!rows[0]) {
    throw new SupabaseApiError('The server created the order but could not reload it.', 502);
  }

  return orderRowToOrder(rows[0]);
}

export async function deleteOrderTestingStateFromSupabase() {
  const deleteOptions = {
    method: 'DELETE' as const,
    headers: {
      Prefer: 'return=minimal',
    },
  };

  await Promise.all([
    supabaseRequest('/rest/v1/support_messages?context_type=eq.order', deleteOptions).catch(
      () => undefined,
    ),
    supabaseRequest('/rest/v1/notifications?context_type=eq.order', deleteOptions).catch(
      () => undefined,
    ),
    supabaseRequest('/rest/v1/email_logs?order_id=not.is.null', deleteOptions).catch(
      () => undefined,
    ),
    supabaseRequest('/rest/v1/withdrawal_requests?id=not.is.null', deleteOptions).catch(
      () => undefined,
    ),
  ]);

  return supabaseRequest('/rest/v1/orders?id=not.is.null', deleteOptions);
}

export async function deleteOrderFromSupabase(orderId: string) {
  const encodedOrderId = encodeURIComponent(orderId);
  const deleteOptions = {
    method: 'DELETE' as const,
    headers: {
      Prefer: 'return=minimal',
    },
  };

  await Promise.all([
    supabaseRequest(
      `/rest/v1/support_messages?context_type=eq.order&context_id=eq.${encodedOrderId}`,
      deleteOptions,
    ).catch(() => undefined),
    supabaseRequest(
      `/rest/v1/notifications?context_type=eq.order&context_id=eq.${encodedOrderId}`,
      deleteOptions,
    ).catch(() => undefined),
    supabaseRequest(`/rest/v1/email_logs?order_id=eq.${encodedOrderId}`, deleteOptions).catch(
      () => undefined,
    ),
  ]);

  return supabaseRequest(`/rest/v1/orders?id=eq.${encodedOrderId}`, deleteOptions);
}

export async function saveOwnerBusinessProfileToSupabase(profile: OwnerBusinessProfile) {
  const body = {
    id: profile.id,
    owner_user_id: profile.ownerUserId,
    account_name: profile.accountName,
    account_email: profile.accountEmail,
    owner_name: profile.ownerName,
    bio: profile.bio || null,
    profile_image: profile.profileImage || null,
    phone: profile.phone,
    whatsapp: profile.whatsapp || null,
    email: profile.email,
    website: profile.website || null,
    instagram: profile.instagram || null,
    facebook: profile.facebook || null,
    x: profile.x || null,
    tiktok: profile.tiktok || null,
    address: profile.address,
    opening_time: profile.openingTime || null,
    closing_time: profile.closingTime || null,
    open_days: profile.openDays ?? [],
    cover_image: profile.coverImage || null,
    gallery_images: profile.galleryImages || null,
    gallery_videos: profile.galleryVideos || null,
    subscription_cycle: profile.subscriptionCycle ?? null,
    subscription_status: profile.subscriptionStatus ?? null,
    verified_amount: profile.verifiedAmount ?? null,
    subscription_paid_at: profile.subscriptionPaidAt ?? null,
    subscription_next_billing_at: profile.subscriptionNextBillingAt ?? null,
    subscription_item_count: profile.subscriptionItemCount ?? null,
    river_park_verified: profile.riverParkVerified ?? false,
    payout_bank_code: profile.payoutBankCode ?? null,
    payout_bank_name: profile.payoutBankName ?? null,
    payout_account_number: profile.payoutAccountNumber ?? null,
    payout_account_name: profile.payoutAccountName ?? null,
    payout_verified_at: profile.payoutVerifiedAt ?? null,
    updated_at: profile.updatedAt,
  };
  const upsertOwnerProfile = (payload: Record<string, unknown>) =>
    supabaseRequest('/rest/v1/owner_business_profiles?on_conflict=id', {
      method: 'POST',
      body: payload,
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
    });

  try {
    return await upsertOwnerProfile(body);
  } catch (error) {
    if (
      error instanceof SupabaseApiError &&
      /bio|profile_image|open_days|facebook|tiktok|\bx\b|schema cache|column/i.test(error.message)
    ) {
      const {
        bio: _bio,
        profile_image: _profileImage,
        open_days: _openDays,
        facebook: _facebook,
        x: _x,
        tiktok: _tiktok,
        ...fallbackBody
      } = body;

      return upsertOwnerProfile(fallbackBody);
    }

    throw error;
  }
}

export async function deleteSupportConversationFromSupabase(conversationId: string) {
  try {
    return await supabaseRequest('/rest/v1/rpc/delete_support_conversation', {
      method: 'POST',
      body: {
        target_conversation_id: conversationId,
      },
    });
  } catch (error) {
    if (!isRecoverableSupabaseSetupError(error)) {
      throw error;
    }

    return supabaseRequest(
      `/rest/v1/support_messages?conversation_id=eq.${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        headers: {
          Prefer: 'return=minimal',
        },
      },
    );
  }
}

function businessToSupabasePayload(business: Business) {
  return {
    id: business.id,
    estate_id: business.estateId,
    listing_type: business.listingType,
    listing_source: business.listingSource ?? null,
    listing_audience: business.listingAudience ?? null,
    status: business.status ?? 'active',
    subscription_cycle: business.subscriptionCycle ?? null,
    subscription_status: business.subscriptionStatus ?? null,
    verified_amount: business.verifiedAmount ?? null,
    subscription_paid_at: business.subscriptionPaidAt ?? null,
    subscription_next_billing_at: business.subscriptionNextBillingAt ?? null,
    subscription_item_count: business.subscriptionItemCount ?? null,
    name: business.name,
    owner_name: business.ownerName,
    owner_user_id: business.ownerUserId ?? null,
    owner_email: business.ownerEmail ?? null,
    cluster: business.cluster,
    category: business.category,
    description: business.description,
    long_description: business.longDescription,
    image_url: business.imageUrl,
    media: business.media,
    address: business.address,
    sku: business.sku ?? null,
    stock_quantity: business.stockQuantity ?? 0,
    reorder_level: business.reorderLevel ?? 0,
    price: business.price,
    price_label: business.priceLabel ?? null,
    response_time: business.responseTime,
    verified: business.verified,
    river_park_verified: business.riverParkVerified ?? false,
    services: business.services,
    tags: business.tags,
    contact: business.contact,
    created_at: business.createdAt,
    updated_at: business.updatedAt ?? null,
  };
}

export async function saveCatalogManagementAccessToSupabase(allowed: boolean) {
  return supabaseRequest<SupabaseNotificationRow>(
    '/rest/v1/rpc/set_my_catalog_management_access',
    {
      method: 'POST',
      body: { allowed },
    },
  );
}

export async function saveAdminCatalogProductToSupabase(
  business: Business,
  adminPin: string,
) {
  const row = await supabaseRequest<SupabaseBusinessRow>(
    '/rest/v1/rpc/admin_upsert_catalog_product',
    {
      method: 'POST',
      body: {
        target_product: businessToSupabasePayload(business),
        admin_pin: adminPin,
      },
    },
  );

  return businessRowToBusiness(row);
}

export async function saveBusinessToSupabase(business: Business) {
  const body = businessToSupabasePayload(business);

  try {
    return await supabaseRequest('/rest/v1/businesses?on_conflict=id', {
      method: 'POST',
      body,
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
    });
  } catch (error) {
    if (
      error instanceof SupabaseApiError &&
      /river_park_verified|listing_source|listing_audience|schema cache|column/i.test(error.message)
    ) {
      const {
        listing_source: _listingSource,
        listing_audience: _listingAudience,
        river_park_verified: _riverParkVerified,
        ...fallbackBody
      } = body;

      return supabaseRequest('/rest/v1/businesses?on_conflict=id', {
        method: 'POST',
        body: fallbackBody,
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
      });
    }

    throw error;
  }
}

export async function deleteBusinessFromSupabase(businessId: string) {
  try {
    return await supabaseRequest(`/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}`, {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
      },
    });
  } catch (directDeleteError) {
    try {
      return await supabaseRequest('/rest/v1/rpc/delete_business_listing', {
        method: 'POST',
        body: {
          target_business_id: businessId,
        },
      });
    } catch (rpcDeleteError) {
      if (isRecoverableSupabaseSetupError(rpcDeleteError)) {
        throw directDeleteError;
      }

      throw rpcDeleteError;
    }
  }
}

export async function saveSecuritySettingsToSupabase(settings: SecuritySettings) {
  return supabaseRequest('/rest/v1/security_settings?on_conflict=id', {
    method: 'POST',
    body: {
      id: 'default',
      allow_resident_signups: settings.allowResidentSignups,
      allow_business_owner_signups: settings.allowBusinessOwnerSignups,
      maintenance_mode: settings.maintenanceMode,
      block_checkout: settings.blockCheckout,
      require_manual_listing_approval: settings.requireManualListingApproval,
      session_timeout_minutes: settings.sessionTimeoutMinutes,
      max_login_attempts: settings.maxLoginAttempts,
      login_announcement_enabled: settings.loginAnnouncementEnabled,
      login_announcement_title: settings.loginAnnouncementTitle,
      login_announcement_body: settings.loginAnnouncementBody,
      subscription_exempt_account_email: settings.subscriptionExemptAccountEmail,
      minimum_withdrawal_amount: settings.minimumWithdrawalAmount,
      maximum_withdrawal_amount: settings.maximumWithdrawalAmount,
      vat_tier_one_amount: settings.vatTierOneAmount,
      vat_tier_two_base_amount: settings.vatTierTwoBaseAmount,
      vat_additional_band_amount: settings.vatAdditionalBandAmount,
      packing_tier_one_amount: settings.packingTierOneAmount,
      packing_tier_two_amount: settings.packingTierTwoAmount,
      packing_tier_three_amount: settings.packingTierThreeAmount,
      packing_tier_four_amount: settings.packingTierFourAmount,
      packing_tier_five_amount: settings.packingTierFiveAmount,
      packing_tier_six_amount: settings.packingTierSixAmount,
      updated_at: new Date().toISOString(),
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

export async function fetchAdminActionPinStatus() {
  const rows = await supabaseRequest<Array<{ configured?: boolean; updated_at?: string | null }>>(
    '/rest/v1/rpc/get_admin_action_pin_status',
    { method: 'POST', body: {} },
  );

  return {
    configured: Boolean(rows[0]?.configured),
    updatedAt: rows[0]?.updated_at ?? '',
  };
}

export async function saveAdminActionPin(pin: string) {
  return supabaseRequest<string>('/rest/v1/rpc/set_admin_action_pin', {
    method: 'POST',
    body: { admin_pin: pin },
  });
}

export async function verifyAdminActionPin(pin: string) {
  return supabaseRequest<boolean>('/rest/v1/rpc/verify_admin_action_pin', {
    method: 'POST',
    body: { admin_pin: pin },
  });
}

export async function savePaymentPlanToSupabase(plan: PaymentPlan) {
  return supabaseRequest('/rest/v1/payment_plans?on_conflict=cycle', {
    method: 'POST',
    body: {
      cycle: plan.cycle,
      title: plan.title,
      amount: plan.amount,
      description: plan.description,
      updated_at: plan.updatedAt,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
}

function securityRowToSettings(row: SupabaseSecurityRow): SecuritySettings {
  return {
    allowResidentSignups: row.allow_resident_signups,
    allowBusinessOwnerSignups: row.allow_business_owner_signups,
    maintenanceMode: row.maintenance_mode,
    blockCheckout: row.block_checkout,
    requireManualListingApproval: row.require_manual_listing_approval,
    sessionTimeoutMinutes: row.session_timeout_minutes,
    maxLoginAttempts: row.max_login_attempts,
    loginAnnouncementEnabled: row.login_announcement_enabled ?? true,
    loginAnnouncementTitle: row.login_announcement_title ?? 'Welcome to View2Connect',
    loginAnnouncementBody:
      row.login_announcement_body ??
      'Marketplace updates, verification notices, and customer care messages will appear in your notifications.',
    subscriptionExemptAccountEmail: row.subscription_exempt_account_email ?? 'owner.admin@urbanconnect.com',
    minimumWithdrawalAmount: toNumber(row.minimum_withdrawal_amount ?? 1000),
    maximumWithdrawalAmount: toNumber(row.maximum_withdrawal_amount ?? 1000000),
    vatTierOneAmount: toNumber(row.vat_tier_one_amount ?? 500),
    vatTierTwoBaseAmount: toNumber(row.vat_tier_two_base_amount ?? 1500),
    vatAdditionalBandAmount: toNumber(row.vat_additional_band_amount ?? 1000),
    packingTierOneAmount: toNumber(row.packing_tier_one_amount ?? 50),
    packingTierTwoAmount: toNumber(row.packing_tier_two_amount ?? 100),
    packingTierThreeAmount: toNumber(row.packing_tier_three_amount ?? 200),
    packingTierFourAmount: toNumber(row.packing_tier_four_amount ?? 300),
    packingTierFiveAmount: toNumber(row.packing_tier_five_amount ?? 500),
    packingTierSixAmount: toNumber(row.packing_tier_six_amount ?? 800),
  };
}

function emailRowToLog(row: SupabaseEmailRow): AutomatedEmailLog {
  const orderId = optionalString(row.order_id);
  const businessId = optionalString(row.business_id);
  const sentAt = optionalString(row.sent_at);

  return {
    id: row.id,
    ...(orderId ? { orderId } : {}),
    ...(businessId ? { businessId } : {}),
    recipientType: row.recipient_type,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    ...(sentAt ? { sentAt } : {}),
  };
}

function auditRowToLog(row: SupabaseAuditRow): AuditLog {
  return {
    id: row.id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    details: row.details,
    createdAt: row.created_at,
  };
}

function notificationRowToNotification(row: SupabaseNotificationRow): AppNotification {
  const contextType = row.context_type ?? undefined;
  const contextId = optionalString(row.context_id);
  const readAt = optionalString(row.read_at);

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    audience: row.audience,
    title: row.title,
    body: row.body,
    ...(contextType ? { contextType } : {}),
    ...(contextId ? { contextId } : {}),
    createdAt: row.created_at,
    ...(readAt ? { readAt } : {}),
  };
}

function supportRowToMessage(row: SupabaseSupportMessageRow): SupportMessage {
  const contextType = row.context_type ?? undefined;
  const contextId = optionalString(row.context_id);
  const contextLabel = optionalString(row.context_label);
  const attachments = Array.isArray(row.attachments)
    ? row.attachments.filter(isChatMessageAttachment)
    : [];

  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    text: row.text,
    ...(contextType ? { contextType } : {}),
    ...(contextId ? { contextId } : {}),
    ...(contextLabel ? { contextLabel } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    createdAt: row.created_at,
  };
}

function chatRowToMessage(row: SupabaseChatMessageRow): ChatMessage {
  const senderUserId = optionalString(row.sender_user_id);
  const recipientUserId = optionalString(row.recipient_user_id);
  const attachments = Array.isArray(row.attachments)
    ? row.attachments.filter(isChatMessageAttachment)
    : [];

  return {
    id: row.id,
    businessId: row.business_id,
    ...(senderUserId ? { senderUserId } : {}),
    ...(recipientUserId ? { recipientUserId } : {}),
    senderName: row.sender_name,
    senderType: row.sender_type,
    text: row.text,
    ...(attachments.length > 0 ? { attachments } : {}),
    createdAt: row.created_at,
  };
}

function isChatMessageAttachment(value: unknown): value is ChatMessageAttachment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const attachment = value as Partial<ChatMessageAttachment>;
  return (
    typeof attachment.id === 'string' &&
    typeof attachment.url === 'string' &&
    typeof attachment.name === 'string' &&
    (attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'file')
  );
}

function groupChatMessages(messages: ChatMessage[]) {
  return messages.reduce<Record<string, ChatMessage[]>>((accumulator, message) => {
    accumulator[message.businessId] = [
      ...(accumulator[message.businessId] ?? []),
      message,
    ];
    return accumulator;
  }, {});
}

function deliveryLocationRowToLocation(row: SupabaseDeliveryLocationRow): DeliveryLocation {
  const placeId = optionalString(row.place_id);

  return {
    userId: row.user_id,
    formattedAddress: row.formatted_address,
    country: optionalString(row.country) ?? '',
    stateOrRegion: optionalString(row.state_region) ?? '',
    city: optionalString(row.city) ?? '',
    areaOrDistrict: optionalString(row.area_district) ?? '',
    streetName: optionalString(row.street_name) ?? '',
    buildingInfo: optionalString(row.building_info) ?? '',
    landmark: optionalString(row.landmark) ?? '',
    latitude:
      row.latitude !== undefined && row.latitude !== null ? Number(row.latitude) : null,
    longitude:
      row.longitude !== undefined && row.longitude !== null ? Number(row.longitude) : null,
    additionalInstructions: optionalString(row.additional_instructions) ?? '',
    ...(placeId ? { placeId } : {}),
    source: row.source ?? 'manual',
    updatedAt: row.updated_at,
  };
}

function orderRowDeliveryLocation(row: SupabaseOrderRow): DeliveryLocation | undefined {
  const hasLocation =
    row.delivery_country ||
    row.delivery_state_region ||
    row.delivery_city ||
    row.delivery_area_district ||
    row.delivery_street_name ||
    row.delivery_building_info ||
    row.delivery_landmark ||
    row.delivery_latitude !== undefined ||
    row.delivery_longitude !== undefined ||
    row.delivery_instructions;

  if (!hasLocation) {
    return undefined;
  }

  return {
    userId: row.user_id,
    formattedAddress: row.delivery_address,
    country: optionalString(row.delivery_country) ?? '',
    stateOrRegion: optionalString(row.delivery_state_region) ?? '',
    city: optionalString(row.delivery_city) ?? '',
    areaOrDistrict: optionalString(row.delivery_area_district) ?? '',
    streetName: optionalString(row.delivery_street_name) ?? '',
    buildingInfo: optionalString(row.delivery_building_info) ?? '',
    landmark: optionalString(row.delivery_landmark) ?? '',
    latitude:
      row.delivery_latitude !== undefined && row.delivery_latitude !== null
        ? Number(row.delivery_latitude)
        : null,
    longitude:
      row.delivery_longitude !== undefined && row.delivery_longitude !== null
        ? Number(row.delivery_longitude)
        : null,
    additionalInstructions: optionalString(row.delivery_instructions) ?? '',
    ...(row.delivery_place_id ? { placeId: row.delivery_place_id } : {}),
    source: row.delivery_location_source ?? 'manual',
    updatedAt: row.updated_at,
  };
}

function deliveryJobRowLocation(row: SupabaseDeliveryJobRow): DeliveryLocation | undefined {
  const hasLocation =
    row.delivery_country ||
    row.delivery_state_region ||
    row.delivery_city ||
    row.delivery_area_district ||
    row.delivery_street_name ||
    row.delivery_building_info ||
    row.delivery_landmark ||
    row.delivery_latitude !== undefined ||
    row.delivery_longitude !== undefined ||
    row.delivery_instructions;

  if (!hasLocation) {
    return undefined;
  }

  return {
    userId: '',
    formattedAddress: row.delivery_address,
    country: optionalString(row.delivery_country) ?? '',
    stateOrRegion: optionalString(row.delivery_state_region) ?? '',
    city: optionalString(row.delivery_city) ?? '',
    areaOrDistrict: optionalString(row.delivery_area_district) ?? '',
    streetName: optionalString(row.delivery_street_name) ?? '',
    buildingInfo: optionalString(row.delivery_building_info) ?? '',
    landmark: optionalString(row.delivery_landmark) ?? '',
    latitude:
      row.delivery_latitude !== undefined && row.delivery_latitude !== null
        ? Number(row.delivery_latitude)
        : null,
    longitude:
      row.delivery_longitude !== undefined && row.delivery_longitude !== null
        ? Number(row.delivery_longitude)
        : null,
    additionalInstructions: optionalString(row.delivery_instructions) ?? '',
    ...(row.delivery_place_id ? { placeId: row.delivery_place_id } : {}),
    source: row.delivery_location_source ?? 'manual',
    updatedAt: row.updated_at,
  };
}

function deliveryJobRowToJob(row: SupabaseDeliveryJobRow): DispatchDeliveryJob {
  const deliveryLocation = deliveryJobRowLocation(row);

  return {
    id: row.id,
    orderId: row.order_id,
    sellerKey: row.seller_key,
    ...(row.seller_user_id ? { sellerUserId: row.seller_user_id } : {}),
    sellerName: row.seller_name,
    sellerType: row.seller_type,
    pickupAddress: row.pickup_address,
    deliveryAddress: row.delivery_address,
    ...(row.delivery_contact_phone ? { deliveryContactPhone: row.delivery_contact_phone } : {}),
    ...(deliveryLocation ? { deliveryLocation } : {}),
    itemSubtotal: Number(row.item_subtotal),
    deliveryFee: Number(row.delivery_fee),
    status: row.status,
    ...(row.rider_user_id ? { riderUserId: row.rider_user_id } : {}),
    sellerReleaseStatus: row.seller_release_status,
    ...(row.accepted_at ? { acceptedAt: row.accepted_at } : {}),
    ...(row.picked_up_at ? { pickedUpAt: row.picked_up_at } : {}),
    ...(row.rider_confirmed_at ? { riderConfirmedAt: row.rider_confirmed_at } : {}),
    ...(row.buyer_confirmed_at ? { buyerConfirmedAt: row.buyer_confirmed_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function orderDeliveryUpdateRowToUpdate(row: SupabaseOrderDeliveryUpdateRow): OrderDeliveryUpdate {
  return {
    id: row.id,
    orderId: row.order_id,
    sellerName: row.seller_name,
    deliveryAddress: row.delivery_address,
    ...(row.delivery_contact_phone ? { deliveryContactPhone: row.delivery_contact_phone } : {}),
    status: row.status,
    ...(row.rider_user_id ? { riderUserId: row.rider_user_id } : {}),
    ...(row.rider_full_name ? { riderFullName: row.rider_full_name } : {}),
    ...(row.rider_phone_number ? { riderPhoneNumber: row.rider_phone_number } : {}),
    ...(row.accepted_at ? { acceptedAt: row.accepted_at } : {}),
    ...(row.picked_up_at ? { pickedUpAt: row.picked_up_at } : {}),
    ...(row.rider_confirmed_at ? { riderConfirmedAt: row.rider_confirmed_at } : {}),
    ...(row.buyer_confirmed_at ? { buyerConfirmedAt: row.buyer_confirmed_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    updatedAt: row.updated_at,
  };
}
function riderProfileRowToProfile(row: SupabaseRiderProfileRow): DispatchRiderProfile {
  return {
    authUserId: row.auth_user_id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    whatsapp: row.whatsapp ?? null,
    address: row.address ?? null,
    profileImage: row.profile_image ?? null,
    bio: row.bio ?? null,
    vehicleType: row.vehicle_type ?? null,
    plateNumber: row.plate_number ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function groupSupportMessages(messages: SupportMessage[]) {
  return messages.reduce<Record<string, SupportMessage[]>>((accumulator, message) => {
    accumulator[message.conversationId] = [
      ...(accumulator[message.conversationId] ?? []),
      message,
    ];
    return accumulator;
  }, {});
}

export async function fetchMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  const [
    businessRows,
    orderRows,
    paymentRows,
    securityRows,
    publicOwnerProfileRows,
    privateOwnerProfileRows,
    emailRows,
    auditRows,
    notificationRows,
    chatRows,
    supportRows,
    subscriptionPaymentRows,
    withdrawalRows,
    virtualAccountRows,
    dynamicDepositRows,
  ] = await Promise.all([
    supabaseRequest<SupabaseBusinessRow[]>('/rest/v1/businesses?select=*&order=created_at.desc'),
    supabaseRequest<SupabaseOrderRow[]>(
      '/rest/v1/orders?select=*,order_items(*),order_timeline_events(*)&order=created_at.desc',
    ).catch(() => [] as SupabaseOrderRow[]),
    supabaseRequest<SupabasePaymentPlanRow[]>('/rest/v1/payment_plans?select=*&order=cycle.asc'),
    supabaseRequest<SupabaseSecurityRow[]>('/rest/v1/security_settings?select=*&id=eq.default&limit=1'),
    supabaseRequest<SupabaseOwnerProfileRow[]>(
      '/rest/v1/public_owner_business_profiles?select=*&order=updated_at.desc',
    ).catch(
      () => [] as SupabaseOwnerProfileRow[],
    ),
    activeSupabaseAccessToken
      ? supabaseRequest<SupabaseOwnerProfileRow[]>(
          '/rest/v1/owner_business_profiles?select=*&order=updated_at.desc',
        ).catch(() => [] as SupabaseOwnerProfileRow[])
      : Promise.resolve([] as SupabaseOwnerProfileRow[]),
    supabaseRequest<SupabaseEmailRow[]>('/rest/v1/email_logs?select=*&order=created_at.desc').catch(
      () => [] as SupabaseEmailRow[],
    ),
    supabaseRequest<SupabaseAuditRow[]>('/rest/v1/audit_logs?select=*&order=created_at.desc').catch(
      () => [] as SupabaseAuditRow[],
    ),
    supabaseRequest<SupabaseNotificationRow[]>(
      '/rest/v1/notifications?select=*&order=created_at.desc',
    ).catch(() => [] as SupabaseNotificationRow[]),
    supabaseRequest<SupabaseChatMessageRow[]>(
      '/rest/v1/listing_messages?select=*&order=created_at.asc',
    ).catch(() => [] as SupabaseChatMessageRow[]),
    supabaseRequest<SupabaseSupportMessageRow[]>(
      '/rest/v1/support_messages?select=*&order=created_at.asc',
    ).catch(() => [] as SupabaseSupportMessageRow[]),
    supabaseRequest<SupabaseSubscriptionPaymentRow[]>(
      '/rest/v1/subscription_payments?select=*&order=created_at.desc',
    ).catch(() => [] as SupabaseSubscriptionPaymentRow[]),
    supabaseRequest<SupabaseWithdrawalRow[]>(
      '/rest/v1/withdrawal_requests?select=*&order=created_at.desc',
    ).catch(() => [] as SupabaseWithdrawalRow[]),
    supabaseRequest<SupabaseVirtualAccountRow[]>(
      '/rest/v1/virtual_accounts?select=*&order=updated_at.desc',
    ).catch(() => [] as SupabaseVirtualAccountRow[]),
    supabaseRequest<SupabaseDynamicDepositRow[]>(
      '/rest/v1/dynamic_deposit_accounts?select=*&order=created_at.desc',
    ).catch(() => [] as SupabaseDynamicDepositRow[]),
  ]);

  const ownerProfileRows = Array.from(
    [...publicOwnerProfileRows, ...privateOwnerProfileRows].reduce(
      (profiles, profile) => profiles.set(profile.id, profile),
      new Map<string, SupabaseOwnerProfileRow>(),
    ).values(),
  );

  return {
    businesses: businessRows.map(businessRowToBusiness),
    orders: orderRows.map(orderRowToOrder),
    paymentPlans: paymentRows.map((row) => ({
      cycle: row.cycle,
      title: row.title,
      amount: toNumber(row.amount),
      description: row.description,
      updatedAt: row.updated_at,
    })),
    ...(securityRows[0] ? { securitySettings: securityRowToSettings(securityRows[0]) } : {}),
    ownerBusinessProfiles: ownerProfileRows.map(ownerProfileRowToProfile),
    emailLogs: emailRows.map(emailRowToLog),
    auditLogs: auditRows.map(auditRowToLog),
    notifications: notificationRows.map(notificationRowToNotification),
    chatThreads: groupChatMessages(chatRows.map(chatRowToMessage)),
    supportThreads: groupSupportMessages(supportRows.map(supportRowToMessage)),
    subscriptionPayments: subscriptionPaymentRows.map(subscriptionPaymentRowToPayment),
    withdrawalRequests: withdrawalRows.map(withdrawalRowToWithdrawal),
    virtualAccounts: virtualAccountRows.map(virtualAccountRowToVirtualAccount),
    dynamicDepositAccounts: dynamicDepositRows.map(dynamicDepositRowToDeposit),
  };
}

export async function fetchDispatchDeliveryJobs(accessToken: string) {
  const jobs = await supabaseRequest<SupabaseDeliveryJobRow[]>(
    '/rest/v1/delivery_jobs?select=*&order=created_at.desc&limit=30',
    { accessToken },
  );

  return jobs.map(deliveryJobRowToJob);
}

export async function fetchDispatchRiderProfile(accessToken: string) {
  const profiles = await supabaseRequest<SupabaseRiderProfileRow[]>(
    '/rest/v1/rider_profiles?select=*&limit=1',
    { accessToken },
  );

  return profiles[0] ? riderProfileRowToProfile(profiles[0]) : null;
}

export async function updateDispatchRiderProfile(
  accessToken: string,
  values: {
    fullName: string;
    email: string;
    phoneNumber: string;
    whatsapp: string;
    address: string;
    profileImage: string;
    bio: string;
  },
) {
  const profile = await supabaseRequest<SupabaseRiderProfileRow>(
    '/rest/v1/rpc/update_my_dispatch_profile',
    {
      method: 'POST',
      accessToken,
      body: {
        rider_full_name: values.fullName.trim(),
        rider_email: values.email.trim().toLowerCase(),
        rider_phone_number: values.phoneNumber.trim(),
        rider_whatsapp: values.whatsapp.trim(),
        rider_address: values.address.trim(),
        rider_profile_image: values.profileImage.trim(),
        rider_bio: values.bio.trim(),
      },
    },
  );

  return riderProfileRowToProfile(profile);
}

export async function acceptDispatchDeliveryJob(accessToken: string, targetJobId: string) {
  const job = await supabaseRequest<SupabaseDeliveryJobRow>('/rest/v1/rpc/rider_accept_delivery_job', {
    method: 'POST',
    accessToken,
    body: {
      target_job_id: targetJobId,
    },
  });

  return deliveryJobRowToJob(job);
}

export async function markDispatchDeliveryPickedUp(
  accessToken: string,
  targetJobId: string,
) {
  const job = await supabaseRequest<SupabaseDeliveryJobRow>('/rest/v1/rpc/rider_mark_delivery_picked_up', {
    method: 'POST',
    accessToken,
    body: {
      target_job_id: targetJobId,
    },
  });

  return deliveryJobRowToJob(job);
}

export async function markDispatchDeliveryArrived(accessToken: string, targetJobId: string) {
  const job = await supabaseRequest<SupabaseDeliveryJobRow>('/rest/v1/rpc/rider_mark_delivery_arrived', {
    method: 'POST',
    accessToken,
    body: {
      target_job_id: targetJobId,
    },
  });

  return deliveryJobRowToJob(job);
}

export async function fetchOrderDeliveryUpdates(accessToken: string, orderId: string) {
  const rows = await supabaseRequest<SupabaseOrderDeliveryUpdateRow[]>(
    '/rest/v1/rpc/get_order_delivery_jobs',
    {
      method: 'POST',
      accessToken,
      body: {
        target_order_id: orderId,
      },
    },
  );

  return rows.map(orderDeliveryUpdateRowToUpdate);
}

export async function buyerConfirmDeliveryJob(accessToken: string, targetJobId: string) {
  const job = await supabaseRequest<SupabaseDeliveryJobRow>('/rest/v1/rpc/buyer_confirm_delivery', {
    method: 'POST',
    accessToken,
    body: {
      target_job_id: targetJobId,
    },
  });

  return deliveryJobRowToJob(job);
}
export function isRecoverableSupabaseSetupError(error: unknown) {
  if (!(error instanceof SupabaseApiError)) {
    return false;
  }

  return error.status === 404 || error.status === 0 || /schema cache|function/i.test(error.message);
}
