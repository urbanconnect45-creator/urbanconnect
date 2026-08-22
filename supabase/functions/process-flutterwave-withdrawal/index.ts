declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

export {};

type JsonRecord = Record<string, unknown>;

type WithdrawalRow = {
  id: string;
  owner_user_id: string;
  owner_name: string;
  bank_code?: string | null;
  bank_name: string;
  account_number: string;
  account_name?: string | null;
  amount: number | string;
  status: string;
  provider_reference?: string | null;
  provider_transfer_id?: string | null;
  provider_status?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin':
    Deno.env.get('VIEW2CONNECT_WEB_ORIGIN')?.trim() || 'https://www.view2connect.ng',
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function optionalString(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return String(value).trim() || undefined;
}

function finiteNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function successfulStatus(value: unknown) {
  return ['success', 'successful', 'succeeded'].includes(
    optionalString(value)?.toLowerCase() ?? '',
  );
}

function failedStatus(value: unknown) {
  return ['failed', 'failure', 'cancelled', 'canceled', 'reversed'].includes(
    optionalString(value)?.toLowerCase() ?? '',
  );
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

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

function providerData(payload: unknown) {
  return isJsonRecord(payload) && isJsonRecord(payload.data) ? payload.data : {};
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const flutterwaveSecretKey = normalizeSecret(Deno.env.get('FLUTTERWAVE_SECRET_KEY'));
  const authorization = request.headers.get('authorization')?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: 'Payout service authentication is not configured.' }, 500);
  }
  if (!flutterwaveSecretKey?.startsWith('FLWSECK')) {
    return jsonResponse({ error: 'Flutterwave payout credentials are not configured.' }, 500);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  const authUser = (await readJson(authResponse)) as { id?: string };
  if (!authResponse.ok || !authUser.id) {
    return jsonResponse({ error: 'Admin authentication is required.' }, 401);
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const adminsResponse = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?select=id,full_name,role,is_active&auth_user_id=eq.${encodeURIComponent(authUser.id)}&limit=1`,
    { headers: serviceHeaders },
  );
  const admins = adminsResponse.ok ? ((await adminsResponse.json()) as JsonRecord[]) : [];
  const admin = admins[0];
  if (!admin || admin.role !== 'owner' || admin.is_active !== true) {
    return jsonResponse({ error: 'Only the active owner admin can send seller payouts.' }, 403);
  }

  const pinResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/has_recent_admin_action_authorization`,
    {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: authorization, 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  if (!pinResponse.ok || !Boolean(await pinResponse.json().catch(() => false))) {
    return jsonResponse({ error: 'Confirm the Admin PIN before sending a payout.' }, 403);
  }

  let body: JsonRecord;
  try {
    const parsed = await request.json();
    if (!isJsonRecord(parsed)) throw new Error('Invalid payload');
    body = parsed;
  } catch {
    return jsonResponse({ error: 'Invalid payout request.' }, 400);
  }

  const withdrawalId = optionalString(body.withdrawalId);
  if (!withdrawalId) {
    return jsonResponse({ error: 'Withdrawal ID is required.' }, 400);
  }

  const rateResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_edge_rate_limit`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      p_rate_key: `seller-payout:${authUser.id}`,
      p_max_requests: 5,
      p_window_seconds: 300,
    }),
  });
  if (!rateResponse.ok || !Boolean(await rateResponse.json().catch(() => false))) {
    return jsonResponse({ error: 'Payout rate limit reached. Wait a few minutes and retry.' }, 429);
  }

  const withdrawalsResponse = await fetch(
    `${supabaseUrl}/rest/v1/withdrawal_requests?select=*&id=eq.${encodeURIComponent(withdrawalId)}&limit=1`,
    { headers: serviceHeaders },
  );
  const withdrawals = withdrawalsResponse.ok
    ? ((await withdrawalsResponse.json()) as WithdrawalRow[])
    : [];
  const withdrawal = withdrawals[0];

  if (!withdrawal) return jsonResponse({ error: 'Withdrawal request was not found.' }, 404);
  if (withdrawal.status === 'paid') {
    return jsonResponse({ status: 'paid', withdrawal });
  }
  if (withdrawal.status === 'reversed') {
    return jsonResponse({ error: 'A reversed withdrawal cannot be paid.' }, 409);
  }
  if (
    withdrawal.status === 'processing' &&
    withdrawal.provider_reference
  ) {
    return jsonResponse({ status: 'processing', withdrawal });
  }

  const bankCode = optionalString(withdrawal.bank_code);
  const accountNumber = optionalString(withdrawal.account_number)?.replace(/\D/g, '');
  const amount = finiteNumber(withdrawal.amount);
  if (!bankCode || accountNumber?.length !== 10 || amount <= 0) {
    return jsonResponse(
      { error: 'This withdrawal does not have a complete verified payout account.' },
      409,
    );
  }

  const reference = `v2c-${Date.now()}-${withdrawal.id.replace(/[^a-z0-9]/gi, '').slice(-16)}`;
  const claimResponse = await fetch(
    `${supabaseUrl}/rest/v1/withdrawal_requests?id=eq.${encodeURIComponent(withdrawal.id)}&status=in.(pending,failed)`,
    {
      method: 'PATCH',
      headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'processing',
        provider_reference: reference,
        provider_status: 'initiating',
        failure_reason: null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const claimedRows = claimResponse.ok ? ((await claimResponse.json()) as WithdrawalRow[]) : [];
  if (!claimedRows[0]) {
    const currentResponse = await fetch(
      `${supabaseUrl}/rest/v1/withdrawal_requests?select=*&id=eq.${encodeURIComponent(withdrawal.id)}&limit=1`,
      { headers: serviceHeaders },
    );
    const currentRows = currentResponse.ok
      ? ((await currentResponse.json()) as WithdrawalRow[])
      : [];
    return currentRows[0]
      ? jsonResponse({ status: currentRows[0].status === 'paid' ? 'paid' : 'processing', withdrawal: currentRows[0] })
      : jsonResponse({ error: 'Unable to reserve this withdrawal for payout.' }, 409);
  }

  const payoutResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flutterwaveSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_bank: bankCode,
      account_number: accountNumber,
      amount,
      currency: 'NGN',
      debit_currency: 'NGN',
      beneficiary_name: optionalString(withdrawal.account_name) ?? withdrawal.owner_name,
      reference,
      callback_url: `${supabaseUrl}/functions/v1/flutterwave-webhook`,
      narration: `View2Connect seller payout ${withdrawal.id}`.slice(0, 180),
      meta: [{ withdrawal_id: withdrawal.id, owner_user_id: withdrawal.owner_user_id }],
    }),
  });
  const payoutBody = await readJson(payoutResponse);
  const data = providerData(payoutBody);
  const transferId = optionalString(data.id);
  const providerReference = optionalString(data.reference) ?? reference;
  const providerStatus = optionalString(data.status) ?? optionalString(payoutBody.status) ?? 'pending';
  const providerMessage = optionalString(payoutBody.message);

  if (!payoutResponse.ok || !transferId || failedStatus(providerStatus)) {
    await fetch(`${supabaseUrl}/rest/v1/rpc/fail_flutterwave_withdrawal`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify({
          target_withdrawal_id: withdrawal.id,
          target_transfer_id: transferId ?? '',
          target_provider_reference: providerReference,
          target_provider_status: providerStatus,
          target_failure_reason: providerMessage ?? 'Flutterwave reported that the payout failed.',
        }),
      }).catch(() => undefined);
    return jsonResponse(
      {
        error: providerMessage
          ? `Flutterwave payout failed: ${providerMessage}`
          : 'Flutterwave could not start this payout.',
      },
      502,
    );
  }

  const now = new Date().toISOString();
  const patchResponse = await fetch(
    `${supabaseUrl}/rest/v1/withdrawal_requests?id=eq.${encodeURIComponent(withdrawal.id)}`,
    {
      method: 'PATCH',
      headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'processing',
        provider_transfer_id: transferId,
        provider_reference: providerReference,
        provider_status: providerStatus.toLowerCase(),
        failure_reason: null,
        updated_at: now,
      }),
    },
  );
  const patchedRows = patchResponse.ok ? ((await patchResponse.json()) as WithdrawalRow[]) : [];
  if (!patchedRows[0]) {
    return jsonResponse(
      { error: 'Flutterwave accepted the payout, but its local status could not be saved. Contact support immediately.' },
      502,
    );
  }

  let verifiedData = data;
  if (successfulStatus(providerStatus)) {
    const verificationResponse = await fetch(
      `https://api.flutterwave.com/v3/transfers/${encodeURIComponent(transferId)}`,
      { headers: { Authorization: `Bearer ${flutterwaveSecretKey}` } },
    );
    verifiedData = providerData(await readJson(verificationResponse));
  }

  if (
    successfulStatus(verifiedData.status) &&
    finiteNumber(verifiedData.amount) === amount &&
    optionalString(verifiedData.currency)?.toUpperCase() === 'NGN'
  ) {
    const finalizeResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/finalize_flutterwave_withdrawal`,
      {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify({
          target_withdrawal_id: withdrawal.id,
          target_transfer_id: transferId,
          target_provider_reference: providerReference,
          target_provider_status: optionalString(verifiedData.status),
          target_amount: finiteNumber(verifiedData.amount),
          target_currency: optionalString(verifiedData.currency),
        }),
      },
    );
    const finalized = finalizeResponse.ok
      ? ((await finalizeResponse.json()) as WithdrawalRow)
      : undefined;
    if (finalized?.id) return jsonResponse({ status: 'paid', withdrawal: finalized });
  }

  return jsonResponse({ status: 'processing', withdrawal: patchedRows[0] });
});
