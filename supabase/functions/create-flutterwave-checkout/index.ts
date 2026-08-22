declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

export {};

type CheckoutPayload = {
  diagnostic?: boolean;
  reference?: string;
  amount?: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  title?: string;
  description?: string;
  redirectUrl?: string;
  purpose?: 'cart' | 'subscription' | 'addFunds';
  paymentOptions?: string[];
  meta?: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

const defaultPaymentOptions = ['card', 'account', 'banktransfer'];
const flutterwavePaymentsEndpoint = 'https://api.flutterwave.com/v3/payments';
const defaultSiteUrl = 'https://www.view2connect.ng';
const flutterwaveCheckoutReturnPath = '/payments/flutterwave/return';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VIEW2CONNECT_WEB_ORIGIN')?.trim() || 'https://www.view2connect.ng',
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeFlutterwaveSecretKey(value?: string) {
  let result = value?.trim() ?? '';

  while (result) {
    const next = result
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^FLUTTERWAVE_SECRET_KEY\s*=\s*/i, '')
      .replace(/^Authorization\s*:\s*/i, '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (next === result) {
      break;
    }

    result = next;
  }

  return result || undefined;
}

function getDefaultFlutterwaveRedirectUrl() {
  const siteUrl =
    Deno.env.get('URBANCONNECT_SITE_URL')?.trim() ||
    Deno.env.get('PUBLIC_SITE_URL')?.trim() ||
    defaultSiteUrl;

  return `${siteUrl.replace(/\/+$/, '')}${flutterwaveCheckoutReturnPath}`;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function finiteNumber(value: unknown) {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}

type FlutterwaveCredentialKind =
  | 'live_secret_key'
  | 'test_secret_key'
  | 'public_key'
  | 'encryption_key'
  | 'masked_key'
  | 'unknown';

type SafeFlutterwaveCredentialReport = {
  source: 'FLUTTERWAVE_SECRET_KEY';
  configured: boolean;
  kind: FlutterwaveCredentialKind;
  keyLength: number;
  mode: 'live' | 'test' | 'unknown';
  hadBearerPrefix: boolean;
  hasMaskedCharacters: boolean;
};

type FlutterwaveCredentialCheck = {
  report: SafeFlutterwaveCredentialReport;
  secretKey?: string;
  error?: string;
};

function describeFlutterwaveCredential(value?: string): FlutterwaveCredentialKind {
  if (!value) {
    return 'unknown';
  }

  if (value.includes('*')) {
    return 'masked_key';
  }

  if (value.startsWith('FLWSECK_TEST')) {
    return 'test_secret_key';
  }

  if (value.startsWith('FLWSECK')) {
    return 'live_secret_key';
  }

  if (value.startsWith('FLWPUBK')) {
    return 'public_key';
  }

  if (value.startsWith('FLWENCK')) {
    return 'encryption_key';
  }

  return 'unknown';
}

function getFlutterwaveCredentialCheck(): FlutterwaveCredentialCheck {
  const rawSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY') ?? '';
  const flutterwaveSecretKey = normalizeFlutterwaveSecretKey(rawSecretKey);
  const kind = describeFlutterwaveCredential(flutterwaveSecretKey);
  const report: SafeFlutterwaveCredentialReport = {
    source: 'FLUTTERWAVE_SECRET_KEY',
    configured: Boolean(flutterwaveSecretKey),
    kind,
    keyLength: flutterwaveSecretKey?.length ?? 0,
    mode:
      kind === 'test_secret_key'
        ? 'test'
        : kind === 'live_secret_key'
          ? 'live'
          : 'unknown',
    hadBearerPrefix:
      /^Bearer\s+/i.test(rawSecretKey.trim()) ||
      /^Authorization\s*:\s*Bearer\s+/i.test(rawSecretKey.trim()),
    hasMaskedCharacters: Boolean(flutterwaveSecretKey?.includes('*')),
  };

  if (!flutterwaveSecretKey) {
    return {
      report,
      error:
        'FLUTTERWAVE_SECRET_KEY is not configured. Add your Flutterwave live Secret Key in Supabase secrets.',
    };
  }

  if (kind === 'masked_key') {
    return {
      report,
      error:
        'FLUTTERWAVE_SECRET_KEY looks like a masked dashboard value. Generate new live keys in Flutterwave and copy the full unmasked Secret Key into Supabase.',
    };
  }

  if (kind === 'public_key') {
    return {
      report,
      error:
        'FLUTTERWAVE_SECRET_KEY contains a Public Key. Use the server Secret Key from Flutterwave API settings instead.',
    };
  }

  if (kind === 'encryption_key') {
    return {
      report,
      error:
        'FLUTTERWAVE_SECRET_KEY contains an Encryption Key. Use the server Secret Key from Flutterwave API settings instead.',
    };
  }

  if (kind !== 'live_secret_key' && kind !== 'test_secret_key') {
    return {
      report,
      error:
        'This checkout uses Flutterwave v3 hosted checkout, so FLUTTERWAVE_SECRET_KEY must be the server Secret Key that starts with FLWSECK. Do not use Client ID, Client Secret, Public Key, or Encryption Key.',
    };
  }

  return { report, secretKey: flutterwaveSecretKey };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isValidEmail(value?: string) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function cleanPhone(value?: string) {
  return value?.replace(/[^\d+]/g, '') ?? '';
}

function optionalString(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    const result = String(value).trim();

    return result || undefined;
  }

  return undefined;
}

function findProviderString(value: unknown, fieldNames: string[]): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const normalizedNames = new Set(fieldNames.map((fieldName) => fieldName.toLowerCase()));
  const queue = [value as Record<string, unknown>];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      if (
        normalizedNames.has(key.toLowerCase()) &&
        (typeof nestedValue === 'string' || typeof nestedValue === 'number')
      ) {
        const result = String(nestedValue).trim();

        if (result) {
          return result;
        }
      }

      if (nestedValue && typeof nestedValue === 'object') {
        queue.push(nestedValue as Record<string, unknown>);
      }
    }
  }

  return undefined;
}

async function authenticatedUserId(request: Request) {
  const authorization = request.headers.get('Authorization')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();

  if (!authorization || !supabaseUrl || !anonKey) {
    return undefined;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  const user = response.ok ? ((await response.json()) as { id?: string }) : {};
  return user.id;
}

async function loadPendingOrder(orderId: string, userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return undefined;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/orders?select=id,user_id,user_name,user_email,delivery_contact_phone,total_amount,payment_status&id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  const rows = response.ok
    ? ((await response.json()) as Array<{
        id: string;
        user_id: string;
        user_name: string;
        user_email?: string;
        delivery_contact_phone?: string;
        total_amount: number | string;
        payment_status: string;
      }>)
    : [];
  return rows[0];
}

async function loadPendingSubscription(reference: string, userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return undefined;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/subscription_payments?select=reference,owner_user_id,owner_name,owner_email,amount,currency,status,cycle,raw_payload&reference=eq.${encodeURIComponent(reference)}&owner_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  const rows = response.ok
    ? ((await response.json()) as Array<{
        reference: string;
        owner_user_id: string;
        owner_name: string;
        owner_email: string;
        amount: number | string;
        currency: string;
        status: string;
        cycle: 'weekly' | 'monthly';
        raw_payload?: unknown;
      }>)
    : [];

  return rows[0];
}

async function savePendingAddFundsDeposit(values: {
  userId: string;
  reference: string;
  amount: number;
  currency: string;
  checkoutUrl: string;
  paymentOptions: string[];
  providerBody: unknown;
  mode: 'live' | 'test' | 'unknown';
}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return { error: 'Secure deposit storage is not configured.' };
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,full_name,business_name,email,role,status&id=eq.${encodeURIComponent(values.userId)}&limit=1`,
    { headers },
  );
  const profiles = profileResponse.ok
    ? ((await profileResponse.json()) as Array<{
        id: string;
        full_name: string;
        business_name?: string | null;
        email: string;
        role: string;
        status?: string | null;
      }>)
    : [];
  const profile = profiles[0];

  if (!profile || profile.status === 'suspended') {
    return { error: 'An active View2Connect profile was not found for this payment.' };
  }

  const now = new Date().toISOString();
  const accountName = profile.business_name?.trim() || profile.full_name.trim();
  const saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/dynamic_deposit_accounts?on_conflict=id`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: `deposit-${values.reference}`,
        reference: values.reference,
        user_id: profile.id,
        user_name: profile.full_name,
        user_email: profile.email,
        user_role: profile.role,
        provider: 'flutterwave',
        provider_reference: values.reference,
        bank_name: 'Flutterwave Checkout',
        account_number: values.reference,
        account_name: accountName,
        amount: values.amount,
        currency: values.currency,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        raw_payload: {
          method: 'flutterwaveCheckout',
          checkoutUrl: values.checkoutUrl,
          paymentOptions: values.paymentOptions,
          mode: values.mode,
          providerBody: values.providerBody,
        },
        created_at: now,
        updated_at: now,
      }),
    },
  );

  if (!saveResponse.ok) {
    return { error: await saveResponse.text() };
  }

  return { profile };
}

async function calculateCustomerBenefitPrice(
  reference: string,
  subscription: {
    owner_user_id: string;
    cycle: 'weekly' | 'monthly';
    raw_payload?: unknown;
  },
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return undefined;
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const [userResponse, planResponse] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/app_users?select=role&id=eq.${encodeURIComponent(subscription.owner_user_id)}&limit=1`,
      { headers },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/payment_plans?select=cycle,title,amount&cycle=eq.${encodeURIComponent(subscription.cycle)}&limit=1`,
      { headers },
    ),
  ]);
  const users = userResponse.ok
    ? ((await userResponse.json()) as Array<{ role?: string }>)
    : [];
  const plans = planResponse.ok
    ? ((await planResponse.json()) as Array<{ title?: string; amount?: number | string }>)
    : [];
  const plan = plans[0];
  const metadata = isJsonRecord(subscription.raw_payload) ? subscription.raw_payload : {};

  if (users[0]?.role !== 'resident' || metadata.subscriptionType !== 'customerBenefits' || !plan) {
    return undefined;
  }

  const durationMinutes = Math.floor(finiteNumber(metadata.durationMinutes));
  const durationMonths = Math.floor(finiteNumber(metadata.durationMonths) || 1);
  const planAmount = finiteNumber(plan.amount);

  if (planAmount <= 0) {
    return undefined;
  }

  let amountBeforeDiscount = 0;
  let discountRate = 0;

  if (durationMinutes === 30) {
    const planMinutes = subscription.cycle === 'weekly' ? 7 * 24 * 60 : 30 * 24 * 60;
    amountBeforeDiscount = Math.max(100, Math.round((planAmount * 30) / planMinutes));
  } else {
    const allowedDiscounts: Record<number, number> = { 1: 0, 3: 0.05, 6: 0.1, 12: 0.15 };
    if (!(durationMonths in allowedDiscounts)) {
      return undefined;
    }
    amountBeforeDiscount = planAmount * durationMonths;
    discountRate = allowedDiscounts[durationMonths] ?? 0;
  }

  const discountAmount = Math.round(amountBeforeDiscount * discountRate);
  const amount = Math.max(1, Math.round(amountBeforeDiscount - discountAmount));
  const {
    amountBeforeDiscount: _clientAmountBeforeDiscount,
    discountAmount: _clientDiscountAmount,
    durationLabel: _clientDurationLabel,
    durationMinutes: _clientDurationMinutes,
    durationMonths: _clientDurationMonths,
    nextBillingAt: _clientNextBillingAt,
    planTitle: _clientPlanTitle,
    reference: _clientReference,
    ...safeMetadata
  } = metadata;
  const normalizedMetadata = {
    ...safeMetadata,
    subscriptionType: 'customerBenefits',
    planTitle: plan.title || `${subscription.cycle} plan`,
    durationLabel:
      durationMinutes === 30
        ? '30 minutes'
        : `${durationMonths} month${durationMonths === 1 ? '' : 's'}`,
    durationMonths,
    ...(durationMinutes === 30 ? { durationMinutes: 30 } : {}),
    amountBeforeDiscount,
    discountAmount,
    itemCount: 1,
  };

  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/subscription_payments?reference=eq.${encodeURIComponent(reference)}`,
    { method: 'PATCH', headers, body: JSON.stringify({ amount, currency: 'NGN', raw_payload: normalizedMetadata }) },
  );

  return updateResponse.ok ? { amount, metadata: normalizedMetadata } : undefined;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let payload: CheckoutPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const authenticatedUser = await authenticatedUserId(request);

  if (!authenticatedUser) {
    return jsonResponse({ error: 'Sign in again before starting checkout.' }, 401);
  }

  const credentialCheck = getFlutterwaveCredentialCheck();

  if (payload.diagnostic) {
    return jsonResponse({
      status: 'diagnostic',
      providerEndpoint: flutterwavePaymentsEndpoint,
      credential: credentialCheck.report,
    });
  }

  if (!credentialCheck.secretKey) {
    return jsonResponse(
      {
        error: credentialCheck.error ?? 'Flutterwave credentials are not ready.',
        credential: credentialCheck.report,
      },
      500,
    );
  }

  const flutterwaveSecretKey = credentialCheck.secretKey;

  let amount = Math.max(0, Math.floor(Number(payload.amount ?? 0)));
  let currency = payload.currency?.trim().toUpperCase() || 'NGN';
  let customerName = payload.customerName?.trim();
  let customerEmail = payload.customerEmail?.trim().toLowerCase();
  let customerPhone = cleanPhone(payload.customerPhone);
  let reference =
    payload.reference?.trim() ||
    `UC-FLW-${payload.purpose ?? 'payment'}-${Date.now()}`;
  const redirectUrl =
    Deno.env.get('FLUTTERWAVE_REDIRECT_URL')?.trim() ||
    getDefaultFlutterwaveRedirectUrl();
  const allowedPaymentOptions = new Set(defaultPaymentOptions);
  const requestedPaymentOptions = payload.paymentOptions
    ?.map((option) => option.trim())
    .filter((option) => allowedPaymentOptions.has(option));
  const paymentOptions = requestedPaymentOptions?.length
    ? requestedPaymentOptions
    : defaultPaymentOptions;

  if (payload.purpose === 'cart') {
    const orderId = optionalString(payload.meta?.orderId) ?? reference;
    const order = await loadPendingOrder(orderId, authenticatedUser);

    if (!order || order.payment_status !== 'pending') {
      return jsonResponse({ error: 'A payable order was not found for this account.' }, 403);
    }

    reference = order.id;
    amount = Math.floor(Number(order.total_amount));
    currency = 'NGN';
    customerName = order.user_name;
    customerEmail = order.user_email?.trim().toLowerCase();
    customerPhone = cleanPhone(order.delivery_contact_phone);
  } else if (payload.purpose === 'subscription') {
    const subscription = await loadPendingSubscription(reference, authenticatedUser);

    if (!subscription || subscription.status !== 'pending') {
      return jsonResponse({ error: 'A payable subscription was not found for this account.' }, 403);
    }

    const pricing = await calculateCustomerBenefitPrice(subscription.reference, {
      owner_user_id: subscription.owner_user_id,
      cycle: subscription.cycle,
      raw_payload: subscription.raw_payload,
    });
    if (!pricing) {
      return jsonResponse({ error: 'This subscription option is not available.' }, 403);
    }

    reference = subscription.reference;
    amount = pricing.amount;
    currency = 'NGN';
    customerName = subscription.owner_name;
    customerEmail = subscription.owner_email.trim().toLowerCase();
  } else {
    const claimedUserId = optionalString(payload.meta?.userId ?? payload.meta?.ownerUserId);

    if (claimedUserId && claimedUserId !== authenticatedUser) {
      return jsonResponse({ error: 'You can only start payments for your own account.' }, 403);
    }
  }

  if (amount <= 0) {
    return jsonResponse({ error: 'A valid amount is required.' }, 400);
  }

  if (!customerName || !isValidEmail(customerEmail)) {
    return jsonResponse({ error: 'Customer name and a valid email are required.' }, 400);
  }

  const providerPayload = {
    tx_ref: reference,
    amount,
    currency,
    redirect_url: redirectUrl,
    payment_options: paymentOptions.join(','),
    customer: {
      email: customerEmail,
      name: customerName,
      ...(customerPhone ? { phonenumber: customerPhone } : {}),
    },
    customizations: {
      title: payload.title?.trim() || 'View2Connect payment',
      description:
        payload.description?.trim() || 'Complete your View2Connect payment with Flutterwave.',
    },
    meta: {
      source: 'view2connect',
      purpose: payload.purpose ?? 'cart',
      userId: authenticatedUser,
      ...(payload.purpose === 'cart' ? { orderId: reference } : {}),
    },
  };

  let providerResponse: Response;

  try {
    providerResponse = await fetch(flutterwavePaymentsEndpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(providerPayload),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'Flutterwave did not respond.',
        providerBody: error instanceof Error ? error.message : 'Unknown provider timeout.',
      },
      504,
    );
  }

  const providerBody = await providerResponse.text();
  let providerJson: unknown = providerBody;

  try {
    providerJson = JSON.parse(providerBody);
  } catch {
    providerJson = providerBody;
  }

  if (!providerResponse.ok) {
    const providerMessage = findProviderString(providerJson, [
      'message',
      'error',
      'error_description',
    ]);
    const isAuthorizationError =
      providerResponse.status === 401 ||
      providerMessage?.toLowerCase().includes('authorization key');

    return jsonResponse(
      {
        error: isAuthorizationError
          ? 'Flutterwave rejected the checkout request: Invalid authorization key. Supabase is sending FLUTTERWAVE_SECRET_KEY to Flutterwave v3 hosted checkout; regenerate live API keys if the dashboard only showed a masked key, then store the full unmasked Secret Key.'
          : providerMessage
            ? `Flutterwave rejected the checkout request: ${providerMessage}.`
            : 'Flutterwave rejected the checkout request.',
        providerStatus: providerResponse.status,
        providerBody: providerJson,
        credential: credentialCheck.report,
      },
      502,
    );
  }

  const checkoutUrl = findProviderString(providerJson, ['link', 'checkout_url', 'checkoutUrl']);

  if (!checkoutUrl) {
    return jsonResponse(
      {
        error: 'Flutterwave accepted the request but did not return a checkout link.',
        providerBody: providerJson,
      },
      502,
    );
  }

  if (payload.purpose === 'addFunds') {
    const savedDeposit = await savePendingAddFundsDeposit({
      userId: authenticatedUser,
      reference,
      amount,
      currency,
      checkoutUrl,
      paymentOptions,
      providerBody: providerJson,
      mode: credentialCheck.report.mode,
    });

    if (savedDeposit.error) {
      return jsonResponse(
        {
          error:
            'Flutterwave created the checkout, but View2Connect could not save the pending deposit. Please retry before making payment.',
          storageError: savedDeposit.error,
        },
        502,
      );
    }
  }

  return jsonResponse({
    status: 'created',
    reference,
    amount,
    currency,
    checkoutUrl,
    paymentOptions,
    mode: credentialCheck.report.mode,
    providerBody: providerJson,
  });
});
