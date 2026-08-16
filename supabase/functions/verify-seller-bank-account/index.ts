declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

export {};

type RequestPayload = {
  action?: 'banks' | 'resolve' | 'save';
  ownerUserId?: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
};

type FlutterwaveBank = {
  code?: string | number;
  name?: string;
  type?: string;
};

const flutterwaveApiUrl = 'https://api.flutterwave.com/v3';
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VIEW2CONNECT_WEB_ORIGIN')?.trim() || 'https://www.view2connect.ng',
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeSecret(value?: string) {
  return value
    ?.trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^FLUTTERWAVE_SECRET_KEY\s*=\s*/i, '')
    .replace(/^Authorization\s*:\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

async function parseJson(response: Response) {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : fallback;
}

async function authenticatedUserId(request: Request) {
  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!authorization || !supabaseUrl || !anonKey) {
    return undefined;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as { id?: string };
  return payload.id;
}

async function isActiveStoreOwner(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id&id=eq.${encodeURIComponent(userId)}&role=eq.businessOwner&status=eq.active&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  const rows = response.ok ? ((await response.json()) as unknown[]) : [];
  return rows.length === 1;
}

async function fetchNigerianBanks(secretKey: string) {
  const response = await fetch(`${flutterwaveApiUrl}/banks/NG?include_provider_type=1`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const providerPayload = await parseJson(response);
  const data = Array.isArray(providerPayload.data)
    ? (providerPayload.data as FlutterwaveBank[])
    : [];
  const banks = data
    .filter((bank) => bank.code && bank.name && bank.type !== 'MOBILEMONEY')
    .map((bank) => ({ code: String(bank.code), name: String(bank.name) }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!response.ok || banks.length === 0) {
    throw new Error(payloadMessage(providerPayload, 'Unable to load Nigerian banks.'));
  }

  return banks;
}

async function saveVerifiedAccount(
  ownerUserId: string,
  account: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    verifiedAt: string;
  },
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service credentials are unavailable.');
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const encodedOwnerId = encodeURIComponent(ownerUserId);
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/owner_business_profiles?owner_user_id=eq.${encodedOwnerId}&select=id&limit=1`,
    { headers },
  );
  const profileRows = profileResponse.ok
    ? ((await profileResponse.json()) as Array<{ id: string }>)
    : [];
  const accountColumns = {
    payout_bank_code: account.bankCode,
    payout_bank_name: account.bankName,
    payout_account_number: account.accountNumber,
    payout_account_name: account.accountName,
    payout_verified_at: account.verifiedAt,
    updated_at: account.verifiedAt,
  };

  if (profileRows[0]?.id) {
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/owner_business_profiles?id=eq.${encodeURIComponent(profileRows[0].id)}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(accountColumns),
      },
    );

    if (!updateResponse.ok) {
      throw new Error(
        payloadMessage(
          await parseJson(updateResponse),
          'Unable to save the verified payout account.',
        ),
      );
    }
    return;
  }

  const userResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?id=eq.${encodedOwnerId}&select=*&limit=1`,
    { headers },
  );
  const users = userResponse.ok
    ? ((await userResponse.json()) as Array<Record<string, unknown>>)
    : [];
  const user = users[0];

  if (!user) {
    throw new Error('The seller profile was not found.');
  }

  const fullName = String(user.full_name ?? 'Store owner');
  const email = String(user.email ?? '');
  const createResponse = await fetch(
    `${supabaseUrl}/rest/v1/owner_business_profiles`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: ownerUserId,
        owner_user_id: ownerUserId,
        account_name: String(user.business_name ?? fullName),
        account_email: email,
        owner_name: fullName,
        phone: String(user.phone_number ?? ''),
        email,
        address: String(user.business_cluster ?? ''),
        ...accountColumns,
      }),
    },
  );

  if (!createResponse.ok) {
    throw new Error(
      payloadMessage(
        await parseJson(createResponse),
        'Unable to create the seller payout profile.',
      ),
    );
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const userId = await authenticatedUserId(request);

  if (!userId) {
    return jsonResponse({ error: 'Sign in again before verifying a bank account.' }, 401);
  }

  if (!(await isActiveStoreOwner(userId))) {
    return jsonResponse({ error: 'This account is not registered as an active store owner.' }, 403);
  }

  let payload: RequestPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const secretKey = normalizeSecret(Deno.env.get('FLUTTERWAVE_SECRET_KEY'));

  if (!secretKey?.startsWith('FLWSECK')) {
    return jsonResponse(
      { error: 'Flutterwave server credentials are not configured correctly.' },
      500,
    );
  }

  if (payload.action === 'banks') {
    try {
      return jsonResponse({ banks: await fetchNigerianBanks(secretKey) });
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Unable to load Nigerian banks.' },
        502,
      );
    }
  }

  const ownerUserId = payload.ownerUserId?.trim();
  const bankCode = payload.bankCode?.replace(/\D/g, '') ?? '';
  const accountNumber = payload.accountNumber?.replace(/\D/g, '') ?? '';

  if (!ownerUserId || ownerUserId !== userId) {
    return jsonResponse({ error: 'You can only verify your own payout account.' }, 403);
  }

  if (!bankCode || accountNumber.length !== 10) {
    return jsonResponse(
      { error: 'Choose a bank and enter a valid 10-digit account number.' },
      400,
    );
  }

  let canonicalBankName = '';

  try {
    const banks = await fetchNigerianBanks(secretKey);
    canonicalBankName = banks.find((bank) => bank.code === bankCode)?.name ?? '';
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unable to validate the selected bank.' },
      502,
    );
  }

  if (!canonicalBankName) {
    return jsonResponse({ error: 'Choose a valid bank from the Flutterwave bank list.' }, 400);
  }

  const providerResponse = await fetch(`${flutterwaveApiUrl}/accounts/resolve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_bank: bankCode,
      account_number: accountNumber,
    }),
  });
  const providerPayload = await parseJson(providerResponse);
  const providerData =
    providerPayload.data && typeof providerPayload.data === 'object'
      ? (providerPayload.data as Record<string, unknown>)
      : {};
  const accountName =
    typeof providerData.account_name === 'string'
      ? providerData.account_name.trim()
      : '';

  if (!providerResponse.ok || providerPayload.status !== 'success' || !accountName) {
    return jsonResponse(
      {
        error: payloadMessage(
          providerPayload,
          'Flutterwave could not verify this bank account.',
        ),
      },
      providerResponse.status >= 400 ? providerResponse.status : 422,
    );
  }

  const verifiedAccount = {
    bankCode,
    bankName: canonicalBankName,
    accountNumber,
    accountName,
    verifiedAt: new Date().toISOString(),
  };

  if (payload.action === 'resolve') {
    return jsonResponse({ account: verifiedAccount });
  }

  try {
    await saveVerifiedAccount(ownerUserId, verifiedAccount);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to save the verified payout account.',
      },
      500,
    );
  }

  return jsonResponse({ account: verifiedAccount });
});
