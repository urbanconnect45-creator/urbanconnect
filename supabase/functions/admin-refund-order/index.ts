declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

export {};

type JsonRecord = Record<string, unknown>;

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
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim() || undefined;
  }
  return undefined;
}

function finiteNumber(value: unknown) {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}

function findString(value: unknown, names: string[]): string | undefined {
  if (!isJsonRecord(value)) {
    return undefined;
  }
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const queue: JsonRecord[] = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const [key, nested] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase())) {
        const result = optionalString(nested);
        if (result) return result;
      }
      if (isJsonRecord(nested)) queue.push(nested);
    }
  }
  return undefined;
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
  const authorization = request.headers.get('Authorization')?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: 'Server authentication is not configured.' }, 500);
  }
  if (!flutterwaveSecretKey?.startsWith('FLWSECK')) {
    return jsonResponse({ error: 'Flutterwave server credentials are not configured.' }, 500);
  }

  let payload: JsonRecord;
  try {
    const parsed = await request.json();
    if (!isJsonRecord(parsed)) throw new Error('Invalid payload');
    payload = parsed;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const orderId = optionalString(payload.orderId);
  const reason = optionalString(payload.reason) ?? 'Order cancelled by View2Connect.';
  if (!orderId) {
    return jsonResponse({ error: 'Order ID is required.' }, 400);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  const authUser = authResponse.ok ? ((await authResponse.json()) as { id?: string }) : {};
  if (!authUser.id) {
    return jsonResponse({ error: 'Sign in again before initiating a refund.' }, 401);
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
  const admins = adminsResponse.ok
    ? ((await adminsResponse.json()) as Array<{
        id: string;
        full_name: string;
        role: string;
        is_active: boolean;
      }> )
    : [];
  const admin = admins[0];
  if (!admin || !admin.is_active || admin.role !== 'owner') {
    return jsonResponse({ error: 'Only the active owner admin can initiate refunds.' }, 403);
  }

  const pinAuthorizationResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/has_recent_admin_action_authorization`,
    {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  const pinIsAuthorized = pinAuthorizationResponse.ok
    ? Boolean(await pinAuthorizationResponse.json().catch(() => false))
    : false;
  if (!pinIsAuthorized) {
    return jsonResponse({ error: 'Confirm the Admin PIN before initiating a refund.' }, 403);
  }

  const ordersResponse = await fetch(
    `${supabaseUrl}/rest/v1/orders?select=*&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    { headers: serviceHeaders },
  );
  const orders = ordersResponse.ok ? ((await ordersResponse.json()) as JsonRecord[]) : [];
  const order = orders[0];
  if (!order) {
    return jsonResponse({ error: 'Order not found.' }, 404);
  }
  if (order.payment_status === 'refunded') {
    return jsonResponse({ status: 'alreadyRefunded', orderId });
  }
  if (order.payment_status !== 'refundPending') {
    return jsonResponse({ error: 'Cancel the paid order before initiating its refund.' }, 409);
  }
  if (optionalString(order.refund_provider_reference)) {
    return jsonResponse({
      status: optionalString(order.refund_status) ?? 'processing',
      orderId,
      refundReference: order.refund_provider_reference,
    });
  }

  const providerHeaders = {
    Authorization: `Bearer ${flutterwaveSecretKey}`,
    'Content-Type': 'application/json',
  };
  let transactionId = optionalString(order.provider_transaction_id);

  if (!transactionId) {
    const verificationResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(orderId)}`,
      { headers: providerHeaders },
    );
    const verificationBody = await verificationResponse.json().catch(() => ({}));
    const verifiedData = isJsonRecord(verificationBody) && isJsonRecord(verificationBody.data)
      ? verificationBody.data
      : {};
    const verifiedAmount = finiteNumber(verifiedData.amount);
    const expectedAmount = finiteNumber(order.total_amount);
    const verifiedCurrency = optionalString(verifiedData.currency)?.toUpperCase();
    const verifiedStatus = optionalString(verifiedData.status)?.toLowerCase();

    if (
      !verificationResponse.ok ||
      !['success', 'successful', 'succeeded'].includes(verifiedStatus ?? '') ||
      verifiedCurrency !== 'NGN' ||
      verifiedAmount !== expectedAmount
    ) {
      return jsonResponse({ error: 'Flutterwave could not verify the original order payment.' }, 409);
    }
    transactionId = optionalString(verifiedData.id);
    if (!transactionId) {
      return jsonResponse({ error: 'Flutterwave did not return the transaction ID.' }, 502);
    }
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/flutterwave-webhook`;
  const refundResponse = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/refund`,
    {
      method: 'POST',
      headers: providerHeaders,
      body: JSON.stringify({
        amount: finiteNumber(order.total_amount),
        comments: reason,
        callbackurl: callbackUrl,
      }),
    },
  );
  const refundBody = await refundResponse.json().catch(() => ({}));
  const refundReference = findString(refundBody, ['id', 'refund_id', 'reference']);
  const providerMessage = findString(refundBody, ['message', 'error', 'error_description']);

  if (!refundResponse.ok || !refundReference) {
    return jsonResponse(
      { error: providerMessage ? `Flutterwave refund failed: ${providerMessage}` : 'Flutterwave refund failed.' },
      502,
    );
  }

  const now = new Date().toISOString();
  const patchResponse = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: { ...serviceHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({
        provider_transaction_id: transactionId,
        refund_provider_reference: refundReference,
        refund_status: 'processing',
        refund_reason: reason,
        refund_requested_at: now,
        updated_at: now,
      }),
    },
  );
  if (!patchResponse.ok) {
    return jsonResponse(
      { error: 'Refund started at Flutterwave, but its local status could not be saved. Contact support immediately.' },
      502,
    );
  }

  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/notifications?on_conflict=id`, {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: `notification-refund-started-${orderId}`,
        user_id: order.user_id,
        user_name: order.user_name,
        audience: 'resident',
        title: 'Refund processing',
        body: `Flutterwave is processing the refund for order ${orderId}.`,
        context_type: 'order',
        context_id: orderId,
        created_at: now,
      }),
    }),
    fetch(`${supabaseUrl}/rest/v1/audit_logs?on_conflict=id`, {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: `audit-refund-started-${orderId}`,
        actor_id: authUser.id,
        actor_name: admin.full_name,
        actor_role: 'owner',
        action: 'Order refund initiated',
        details: `Flutterwave refund ${refundReference} was initiated for order ${orderId}.`,
        created_at: now,
      }),
    }),
  ]);

  return jsonResponse({ status: 'processing', orderId, refundReference });
});
