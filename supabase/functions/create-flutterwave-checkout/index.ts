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

const defaultPaymentOptions = ['card', 'account', 'banktransfer'];
const flutterwavePaymentsEndpoint = 'https://api.flutterwave.com/v3/payments';
const defaultSiteUrl = 'https://urbanconnectstore.com';
const flutterwaveCheckoutReturnPath = '/payments/flutterwave/return';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

  const amount = Math.max(0, Math.floor(Number(payload.amount ?? 0)));
  const currency = payload.currency?.trim().toUpperCase() || 'NGN';
  const customerName = payload.customerName?.trim();
  const customerEmail = payload.customerEmail?.trim().toLowerCase();
  const customerPhone = cleanPhone(payload.customerPhone);
  const reference =
    payload.reference?.trim() ||
    `UC-FLW-${payload.purpose ?? 'payment'}-${Date.now()}`;
  const redirectUrl =
    payload.redirectUrl?.trim() ||
    Deno.env.get('FLUTTERWAVE_REDIRECT_URL')?.trim() ||
    getDefaultFlutterwaveRedirectUrl();
  const paymentOptions =
    payload.paymentOptions?.map((option) => option.trim()).filter(Boolean) ??
    defaultPaymentOptions;

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
      title: payload.title?.trim() || 'UrbanConnect payment',
      description:
        payload.description?.trim() || 'Complete your UrbanConnect payment with Flutterwave.',
    },
    meta: {
      source: 'urbanconnect',
      purpose: payload.purpose ?? 'cart',
      ...(payload.meta ?? {}),
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
