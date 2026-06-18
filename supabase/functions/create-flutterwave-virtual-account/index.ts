declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

export {};

type VirtualAccountPayload = {
  diagnostic?: boolean;
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  phoneNumber?: string;
  kycType?: 'bvn' | 'nin';
  kycNumber?: string;
  purpose?: 'deposit' | 'withdrawal';
  amount?: number;
  currency?: string;
  narration?: string;
};

const minimumAddFundsDeposit = 2000;
const dynamicDepositExpiryMs = 30 * 60 * 1000;
const flutterwaveVirtualAccountEndpoint = 'https://api.flutterwave.com/v3/virtual-account-numbers';

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
        'FLUTTERWAVE_SECRET_KEY is not configured. Add your Flutterwave Secret Key in Supabase secrets.',
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
        'This bank-transfer account function uses Flutterwave v3, so FLUTTERWAVE_SECRET_KEY must be the server Secret Key that starts with FLWSECK. Do not use Client ID, Client Secret, Public Key, or Encryption Key.',
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

function cleanDigits(value?: string) {
  return value?.replace(/\D/g, '') ?? '';
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? 'UrbanConnect';
  const lastName = parts.slice(1).join(' ') || 'Seller';

  return { firstName, lastName };
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

  let payload: VirtualAccountPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const credentialCheck = getFlutterwaveCredentialCheck();

  if (payload.diagnostic) {
    return jsonResponse({
      status: 'diagnostic',
      providerEndpoint: flutterwaveVirtualAccountEndpoint,
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

  const ownerUserId = payload.ownerUserId?.trim();
  const ownerName = payload.ownerName?.trim();
  const ownerEmail = payload.ownerEmail?.trim().toLowerCase();
  const phoneNumber = cleanDigits(payload.phoneNumber);
  const kycType = payload.kycType === 'nin' ? 'nin' : 'bvn';
  const kycNumber = cleanDigits(payload.kycNumber);
  const purpose = payload.purpose === 'withdrawal' ? 'withdrawal' : 'deposit';
  const hasKyc = kycNumber.length === 11;
  const amount = Math.max(0, Math.floor(Number(payload.amount ?? 0)));
  const currency = payload.currency?.trim().toUpperCase() || 'NGN';

  if (!ownerUserId || !ownerName || !isValidEmail(ownerEmail)) {
    return jsonResponse({ error: 'Owner id, name, and valid email are required.' }, 400);
  }

  if (phoneNumber.length < 10) {
    return jsonResponse({ error: 'A valid phone number is required.' }, 400);
  }

  if (purpose === 'withdrawal' && !hasKyc) {
    return jsonResponse({ error: 'An 11-digit BVN or NIN is required.' }, 400);
  }

  if (purpose === 'deposit' && amount <= 0) {
    return jsonResponse({ error: 'A valid deposit amount is required.' }, 400);
  }

  if (purpose === 'deposit' && amount <= minimumAddFundsDeposit) {
    return jsonResponse({ error: 'Add funds must be higher than NGN 2,000.' }, 400);
  }

  const { firstName, lastName } = splitName(ownerName);
  const txRef = `urbanconnect-va-${ownerUserId}-${Date.now()}`;
  const providerPayload = {
    email: ownerEmail,
    is_permanent: purpose === 'withdrawal',
    tx_ref: txRef,
    phonenumber: phoneNumber,
    firstname: firstName,
    lastname: lastName,
    ...(purpose === 'deposit' ? { amount, currency } : {}),
    narration: payload.narration?.trim() || 'UrbanConnect wallet account',
    ...(hasKyc ? (kycType === 'bvn' ? { bvn: kycNumber } : { nin: kycNumber }) : {}),
  };

  let providerResponse: Response;

  try {
    providerResponse = await fetch(flutterwaveVirtualAccountEndpoint, {
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
    const providerMessage = findProviderString(providerJson, ['message', 'error', 'error_description']);
    const isAuthorizationError =
      providerResponse.status === 401 ||
      providerMessage?.toLowerCase().includes('authorization key');

    return jsonResponse(
      {
        error: isAuthorizationError
          ? 'Flutterwave rejected the virtual account request: Invalid authorization key. Supabase is sending FLUTTERWAVE_SECRET_KEY to Flutterwave v3; regenerate live API keys if the dashboard only showed a masked key, then store the full unmasked Secret Key.'
          : providerMessage
            ? `Flutterwave rejected the virtual account request: ${providerMessage}.`
            : 'Flutterwave rejected the virtual account request.',
        providerStatus: providerResponse.status,
        providerBody: providerJson,
        credential: credentialCheck.report,
      },
      502,
    );
  }

  const accountNumber = findProviderString(providerJson, [
    'account_number',
    'accountNumber',
    'account_no',
    'nuban',
  ]);
  const accountName = findProviderString(providerJson, [
    'account_name',
    'accountName',
    'fullname',
    'full_name',
  ]);
  const bankName = findProviderString(providerJson, ['bank_name', 'bankName', 'bank']);
  const expiresAt =
    findProviderString(providerJson, [
      'account_expiration_datetime',
      'account_expiration',
      'expires_at',
      'expiry_date',
      'expiresAt',
    ]) ?? new Date(Date.now() + dynamicDepositExpiryMs).toISOString();

  if (!accountNumber) {
    return jsonResponse(
      {
        error: 'Flutterwave accepted the request but did not return an account number.',
        providerBody: providerJson,
      },
      502,
    );
  }

  return jsonResponse({
    status: 'created',
    txRef,
    accountNumber,
    accountName: accountName ?? ownerName,
    bankName: bankName ?? 'Flutterwave',
    amount,
    currency,
    expiresAt,
    ...(hasKyc
      ? {
          kycLast4: kycNumber.slice(-4),
          kycReference: `${kycType.toUpperCase()} ending ${kycNumber.slice(-4)}`,
        }
      : {}),
    providerBody: providerJson,
  });
});
