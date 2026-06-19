import type { AdminUser, AppUser, SignUpFormValues, StoredUser } from '../types/auth';
import type {
  AppNotification,
  AuditLog,
  AutomatedEmailLog,
  Business,
  BusinessMedia,
  DynamicDepositAccount,
  FlutterwaveCheckoutSession,
  OwnerBusinessProfile,
  PaymentPlan,
  SecuritySettings,
  SupportMessage,
  Order,
  OrderItem,
  OrderTimelineEvent,
  PaymentPlanCycle,
  RiverParkCluster,
  SubscriptionPayment,
  VirtualAccount,
  WithdrawalRequest,
} from '../types/business';
import {
  getDynamicDepositExpiresAt,
  MINIMUM_ADD_FUNDS_DEPOSIT,
  withDynamicDepositExpiry,
} from '../utils/deposits';
import { formatCurrency } from '../utils/format';
import { normalizeOrderStatus } from '../utils/order';

const fallbackSupabaseUrl = 'https://uyhudlqajzuzonntodqk.supabase.co';
const fallbackSupabaseKey = 'sb_publishable_Y0_i8Q_ZVknA09MPuFhL8g_76LD1dpP';

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

export type SupabaseSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
};

type SupabaseProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number: string;
  password_hash?: string | null;
  role: 'resident' | 'businessOwner';
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
  role: 'owner' | 'customerCare';
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
  note?: string | null;
  subtotal: number | string;
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
  phone: string;
  whatsapp?: string | null;
  email: string;
  website?: string | null;
  instagram?: string | null;
  address: string;
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
  'https://urbanconnectstore.com/payments/flutterwave/return';

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
  created_at: string;
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
  supportThreads: Record<string, SupportMessage[]>;
  subscriptionPayments: SubscriptionPayment[];
  withdrawalRequests: WithdrawalRequest[];
  virtualAccounts: VirtualAccount[];
  dynamicDepositAccounts: DynamicDepositAccount[];
};

export class SupabaseApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SupabaseApiError';
    this.status = status;
  }
}

function readEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export const supabaseConfig = {
  url: trimTrailingSlash(readEnv('EXPO_PUBLIC_SUPABASE_URL') ?? fallbackSupabaseUrl),
  publishableKey: readEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ?? fallbackSupabaseKey,
};

const listingMediaBucket = 'urbanconnect-listing-media';

export const isSupabaseConfigured = Boolean(
  supabaseConfig.url && supabaseConfig.publishableKey,
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
  if (!isSupabaseConfigured) {
    throw new SupabaseApiError('Supabase is not configured for this app.', 0);
  }

  const response = await fetch(`${supabaseConfig.url}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${options.accessToken ?? supabaseConfig.publishableKey}`,
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

function extensionFromMimeType(mimeType: string, kind: BusinessMedia['type']) {
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

  return kind === 'video' ? 'mp4' : 'jpg';
}

function mimeTypeFromUri(uri: string, kind: BusinessMedia['type']) {
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

  return 'image/jpeg';
}

function sanitizeStorageSegment(value: string) {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'media';
}

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function uploadMediaUriToSupabaseStorage(
  uri: string,
  path: string,
  kind: BusinessMedia['type'],
) {
  const mediaResponse = await fetch(uri);
  const mediaBlob = await mediaResponse.blob();
  const contentType = mediaBlob.type || mimeTypeFromUri(uri, kind);
  const extension = extensionFromMimeType(contentType, kind);
  const normalizedPath = path.includes('.') ? path : `${path}.${extension}`;
  const encodedPath = encodeStoragePath(normalizedPath);
  const uploadResponse = await fetch(
    `${supabaseConfig.url}/storage/v1/object/${listingMediaBucket}/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.publishableKey,
        Authorization: `Bearer ${supabaseConfig.publishableKey}`,
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
        'Listing media could not be uploaded. Create the urbanconnect-listing-media storage bucket and policies, then try again.',
      ),
      uploadResponse.status,
    );
  }

  return `${supabaseConfig.url}/storage/v1/object/public/${listingMediaBucket}/${encodedPath}`;
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

function profileToAppUser(row: SupabaseProfileRow): AppUser {
  const businessName = optionalString(row.business_name);
  const businessCluster = optionalString(row.business_cluster);

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    role: row.role,
    estateId: row.estate_id,
    riverParkVerified: Boolean(row.river_park_verified),
    status: row.status ?? 'active',
    createdAt: row.created_at,
    ...(businessName ? { businessName } : {}),
    ...(businessCluster ? { businessCluster: businessCluster as RiverParkCluster } : {}),
  };
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
    river_park_verified: values.role === 'resident',
  };
}

function buildProfilePayload(
  authUser: SupabaseAuthUser,
  values?: SignUpFormValues,
): SupabaseProfileRow {
  const metadata = authUser.user_metadata ?? {};
  const firstName =
    values?.firstName.trim() || String(metadata.first_name ?? metadata.firstName ?? 'Urban');
  const lastName =
    values?.lastName.trim() || String(metadata.last_name ?? metadata.lastName ?? 'Resident');
  const fullName = `${firstName} ${lastName}`.trim();
  const roleValue = values?.role ?? metadata.role;
  const role = roleValue === 'businessOwner' ? 'businessOwner' : 'resident';
  const businessName =
    values?.role === 'businessOwner'
      ? values.businessName.trim()
      : optionalString(String(metadata.business_name ?? ''));
  const businessCluster =
    values?.role === 'businessOwner'
      ? values.businessCluster
      : optionalString(String(metadata.business_cluster ?? ''));

  return {
    id: authUser.id,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: values?.email.trim().toLowerCase() || authUser.email || '',
    phone_number:
      values?.phoneNumber.trim() || authUser.phone || String(metadata.phone_number ?? ''),
    password_hash: 'supabase-auth-managed',
    role,
    estate_id: values?.estateId ?? String(metadata.estate_id ?? 'river-park'),
    ...(businessName ? { business_name: businessName } : {}),
    ...(businessCluster ? { business_cluster: businessCluster } : {}),
    river_park_verified: role === 'resident',
    status: 'active',
    created_at: new Date().toISOString(),
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

async function fetchProfileByEmail(email: string, accessToken?: string) {
  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    `/rest/v1/app_users?select=*&email=eq.${encodeURIComponent(email.trim().toLowerCase())}&limit=1`,
    { accessToken },
  );

  return rows[0] ? profileToAppUser(rows[0]) : undefined;
}

async function getNextSequentialUserId() {
  const rows = await supabaseRequest<Pick<SupabaseProfileRow, 'id'>[]>(
    '/rest/v1/app_users?select=id',
  ).catch(() => [] as Pick<SupabaseProfileRow, 'id'>[]);
  const highest = rows.reduce((maxValue, row) => {
    const parsedValue = /^\d+$/.test(row.id) ? Number.parseInt(row.id, 10) : -1;
    return Number.isFinite(parsedValue) ? Math.max(maxValue, parsedValue) : maxValue;
  }, -1);

  return String(highest + 1);
}

async function resolveSupabaseEmail(identifier: string) {
  const normalizedIdentifier = identifier.trim();

  if (normalizedIdentifier.includes('@')) {
    return normalizedIdentifier.toLowerCase();
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
  const payload = {
    ...buildProfilePayload(authUser, values),
    ...(values ? { id: await getNextSequentialUserId() } : {}),
  };
  const rows = await supabaseRequest<SupabaseProfileRow[]>(
    '/rest/v1/app_users?on_conflict=id',
    {
      method: 'POST',
      body: payload,
      accessToken,
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
    },
  );

  return rows[0] ? profileToAppUser(rows[0]) : profileToAppUser(payload);
}

async function getOrCreateProfile(
  authUser: SupabaseAuthUser,
  accessToken?: string,
  values?: SignUpFormValues,
) {
  const existingProfile = await fetchProfile(authUser.id, accessToken).catch(() => undefined);
  const existingEmailProfile = authUser.email
    ? await fetchProfileByEmail(authUser.email, accessToken).catch(() => undefined)
    : undefined;

  if (existingProfile && !values) {
    return existingProfile;
  }

  if (existingEmailProfile && !values) {
    return existingEmailProfile;
  }

  return upsertProfile(authUser, values, accessToken);
}

export async function signInWithSupabase(identifier: string, password: string) {
  const email = await resolveSupabaseEmail(identifier);

  const response = await supabaseRequest<SupabaseAuthResponse>(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      body: {
        email,
        password,
      },
    },
  );

  if (!response.user) {
    throw new SupabaseApiError('Supabase did not return a user for this login.', 500);
  }

  const session = toSession(response);
  const user = await getOrCreateProfile(response.user, session?.accessToken);

  return {
    user,
    storedUser: { ...user, password: '' },
    session,
  };
}

export async function sendSupabaseSignupVerificationCode(values: SignUpFormValues) {
  return supabaseRequest('/auth/v1/otp', {
    method: 'POST',
    body: {
      email: values.email.trim().toLowerCase(),
      data: buildSignupMetadata(values),
      create_user: true,
      gotrue_meta_security: {},
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

  const response = await supabaseRequest<SupabaseAuthResponse>('/auth/v1/verify', {
    method: 'POST',
    body: {
      email: values.email.trim().toLowerCase(),
      token,
      type: 'email',
      gotrue_meta_security: {},
    },
  });

  if (!response.user) {
    throw new SupabaseApiError('Supabase did not return a user after email verification.', 500);
  }

  const session = toSession(response);

  if (!session?.accessToken) {
    throw new SupabaseApiError('Supabase did not return a session after email verification.', 500);
  }

  const updatedAuthUser = await supabaseRequest<SupabaseAuthUserUpdateResponse>('/auth/v1/user', {
    method: 'PUT',
    accessToken: session.accessToken,
    body: {
      password: values.password,
      data: buildSignupMetadata(values),
    },
  });
  const authUser = unwrapAuthUser(updatedAuthUser) ?? response.user;
  const user = await getOrCreateProfile(authUser, session.accessToken, values);

  return {
    user,
    storedUser: { ...user, password: '' },
    session,
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
    if (!isRecoverableSupabaseSetupError(error)) {
      throw error;
    }

    return updateSupabaseUserProfile(userId, { river_park_verified: verified });
  }
}

export async function verifySupabaseAdmin(email: string, password: string) {
  const rows = await supabaseRequest<SupabaseAdminRow[]>('/rest/v1/rpc/verify_admin_login', {
    method: 'POST',
    body: {
      admin_email: email.trim().toLowerCase(),
      admin_password: password,
    },
  });

  return rows[0] ? adminRowToUser(rows[0]) : undefined;
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

export async function completeSupabaseOAuth(url: string) {
  const params = parseAuthCallbackParams(url);
  const accessToken = params.get('access_token');

  if (!accessToken) {
    return undefined;
  }

  const refreshToken = params.get('refresh_token') ?? undefined;
  const expiresIn = params.get('expires_in');
  const tokenType = params.get('token_type') ?? undefined;
  const authUser = await supabaseRequest<SupabaseAuthUser>('/auth/v1/user', {
    accessToken,
  });
  const user = await getOrCreateProfile(authUser, accessToken);
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

export function getSupabaseOAuthUrl(provider: 'google' | 'apple') {
  const redirectTo = encodeURIComponent('urbanconnect://auth/callback');
  const encodedProvider = encodeURIComponent(provider);

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
    category: row.category,
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
    riverParkVerified: row.river_park_verified ?? true,
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
  const itemsByBusinessId = new Map<string, OrderItem>();

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
    ...(note ? { note } : {}),
    items,
    subtotal: toNumber(row.subtotal),
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
  const instagram = optionalString(row.instagram);
  const coverImage = optionalString(row.cover_image);
  const galleryImages = optionalString(row.gallery_images);
  const galleryVideos = optionalString(row.gallery_videos);
  const subscriptionPaidAt = optionalString(row.subscription_paid_at);
  const subscriptionNextBillingAt = optionalString(row.subscription_next_billing_at);

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    accountName: row.account_name,
    accountEmail: row.account_email,
    ownerName: row.owner_name,
    phone: row.phone,
    whatsapp: whatsapp ?? '',
    email: row.email,
    website: website ?? '',
    instagram: instagram ?? '',
    address: row.address,
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
  };
}

function virtualAccountRowToVirtualAccount(row: SupabaseVirtualAccountRow): VirtualAccount {
  const kycType = row.kyc_type ?? undefined;
  const kycLast4 = optionalString(row.kyc_last4);
  const kycReference = optionalString(row.kyc_reference);

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

export async function createFlutterwaveVirtualAccount(
  owner: AppUser,
  values: {
    kycType?: WithdrawalRequest['kycType'];
    kycNumber?: string;
    purpose?: 'deposit' | 'withdrawal';
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
        narration: `${owner.businessName ?? owner.fullName} UrbanConnect wallet`,
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

  if (roundedAmount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
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
        narration: `${user.businessName ?? user.fullName} UrbanConnect deposit`,
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

export async function saveDynamicDepositAccountToSupabase(deposit: DynamicDepositAccount) {
  return supabaseRequest('/rest/v1/dynamic_deposit_accounts?on_conflict=id', {
    method: 'POST',
    body: {
      id: deposit.id,
      reference: deposit.reference,
      user_id: deposit.userId,
      user_name: deposit.userName,
      user_email: deposit.userEmail,
      user_role: deposit.userRole,
      provider: deposit.provider,
      provider_reference: deposit.providerReference,
      bank_name: deposit.bankName,
      account_number: deposit.accountNumber,
      account_name: deposit.accountName,
      amount: deposit.amount,
      currency: deposit.currency,
      status: deposit.status,
      expires_at: deposit.expiresAt ?? null,
      paid_at: deposit.paidAt ?? null,
      provider_charge_id: deposit.providerChargeId ?? null,
      failure_reason: deposit.failureReason ?? null,
      raw_payload: deposit.rawPayload ? JSON.parse(deposit.rawPayload) : null,
      created_at: deposit.createdAt,
      updated_at: deposit.updatedAt,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
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
      created_at: message.createdAt,
    },
    headers: {
      Prefer: 'return=minimal',
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
  const body = {
    id: order.id,
    user_id: order.userId,
    user_email: order.userEmail ?? null,
    user_name: order.userName,
    estate_id: order.estateId,
    delivery_address: order.deliveryAddress,
    delivery_cluster: order.deliveryCluster,
    note: order.note ?? null,
    subtotal: order.subtotal,
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
  const upsertOrder = (payload: typeof body) =>
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
  return supabaseRequest('/rest/v1/owner_business_profiles?on_conflict=id', {
    method: 'POST',
    body: {
      id: profile.id,
      owner_user_id: profile.ownerUserId,
      account_name: profile.accountName,
      account_email: profile.accountEmail,
      owner_name: profile.ownerName,
      phone: profile.phone,
      whatsapp: profile.whatsapp || null,
      email: profile.email,
      website: profile.website || null,
      instagram: profile.instagram || null,
      address: profile.address,
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
      updated_at: profile.updatedAt,
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  });
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

export async function saveBusinessToSupabase(business: Business) {
  const body = {
    id: business.id,
    estate_id: business.estateId,
    listing_type: business.listingType,
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
      /river_park_verified|schema cache|column/i.test(error.message)
    ) {
      const { river_park_verified: _riverParkVerified, ...fallbackBody } = body;

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
      updated_at: new Date().toISOString(),
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
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
    loginAnnouncementTitle: row.login_announcement_title ?? 'Welcome to UrbanConnect',
    loginAnnouncementBody:
      row.login_announcement_body ??
      'River Park marketplace updates, verification notices, and customer care messages will appear in your notifications.',
    subscriptionExemptAccountEmail: row.subscription_exempt_account_email ?? 'owner.admin@urbanconnect.com',
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
    createdAt: row.created_at,
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
    ownerProfileRows,
    emailRows,
    auditRows,
    notificationRows,
    supportRows,
    subscriptionPaymentRows,
    withdrawalRows,
    virtualAccountRows,
    dynamicDepositRows,
  ] = await Promise.all([
    supabaseRequest<SupabaseBusinessRow[]>('/rest/v1/businesses?select=*&order=created_at.desc'),
    supabaseRequest<SupabaseOrderRow[]>(
      '/rest/v1/orders?select=*,order_items(*),order_timeline_events(*)&order=created_at.desc',
    ),
    supabaseRequest<SupabasePaymentPlanRow[]>('/rest/v1/payment_plans?select=*&order=cycle.asc'),
    supabaseRequest<SupabaseSecurityRow[]>('/rest/v1/security_settings?select=*&id=eq.default&limit=1'),
    supabaseRequest<SupabaseOwnerProfileRow[]>(
      '/rest/v1/owner_business_profiles?select=*&order=updated_at.desc',
    ),
    supabaseRequest<SupabaseEmailRow[]>('/rest/v1/email_logs?select=*&order=created_at.desc'),
    supabaseRequest<SupabaseAuditRow[]>('/rest/v1/audit_logs?select=*&order=created_at.desc'),
    supabaseRequest<SupabaseNotificationRow[]>(
      '/rest/v1/notifications?select=*&order=created_at.desc',
    ),
    supabaseRequest<SupabaseSupportMessageRow[]>(
      '/rest/v1/support_messages?select=*&order=created_at.asc',
    ),
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
    supportThreads: groupSupportMessages(supportRows.map(supportRowToMessage)),
    subscriptionPayments: subscriptionPaymentRows.map(subscriptionPaymentRowToPayment),
    withdrawalRequests: withdrawalRows.map(withdrawalRowToWithdrawal),
    virtualAccounts: virtualAccountRows.map(virtualAccountRowToVirtualAccount),
    dynamicDepositAccounts: dynamicDepositRows.map(dynamicDepositRowToDeposit),
  };
}

export function isRecoverableSupabaseSetupError(error: unknown) {
  if (!(error instanceof SupabaseApiError)) {
    return false;
  }

  return error.status === 404 || error.status === 0 || /schema cache|function/i.test(error.message);
}
