import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VIEW2CONNECT_WEB_ORIGIN')?.trim() || 'https://www.view2connect.ng',
  Vary: 'Origin',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, flutterwave-signature, verif-hash',
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

function optionalString(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    const result = String(value).trim();

    return result || undefined;
  }

  return undefined;
}

function toNumber(value: unknown) {
  const result = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(result) ? result : 0;
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index]! ^ rightBytes[index]!;
  }

  return diff === 0;
}

async function hmacBase64(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function hasValidFlutterwaveSignature(
  request: Request,
  rawBody: string,
  webhookSecret: string,
) {
  const legacyHash = request.headers.get('verif-hash')?.trim();

  if (legacyHash && timingSafeEqual(legacyHash, webhookSecret)) {
    return true;
  }

  const signature = request.headers.get('flutterwave-signature')?.trim();

  if (!signature) {
    return false;
  }

  const expectedSignature = await hmacBase64(rawBody, webhookSecret);

  return (
    timingSafeEqual(signature, expectedSignature) ||
    timingSafeEqual(signature, webhookSecret)
  );
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function successfulStatus(value: unknown) {
  return ['success', 'successful', 'succeeded'].includes(
    optionalString(value)?.toLowerCase() ?? '',
  );
}

function findReference(payload: JsonRecord, data: JsonRecord) {
  return (
    optionalString(data.reference) ??
    optionalString(data.tx_ref) ??
    optionalString(data.txRef) ??
    optionalString(data.flw_ref) ??
    optionalString(data.flwRef) ??
    optionalString(payload.reference) ??
    optionalString(payload.tx_ref) ??
    optionalString(payload.txRef) ??
    optionalString(payload.flw_ref) ??
    optionalString(payload.flwRef)
  );
}

function buildRawPayload(previousPayload: unknown, webhookPayload: unknown) {
  return {
    ...(isJsonRecord(previousPayload) ? previousPayload : {}),
    webhook: webhookPayload,
  };
}

type SupabaseHeaders = {
  apikey: string;
  Authorization: string;
  'Content-Type': string;
};

type HandlerResult = {
  body: Record<string, unknown>;
  status?: number;
};

async function readRows<T = JsonRecord>(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  path: string,
) {
  const response = await fetch(`${supabaseUrl}${path}`, { headers });

  if (!response.ok) {
    throw new Error(`Supabase read failed with ${response.status}.`);
  }

  const rows = await response.json();

  return Array.isArray(rows) ? (rows as T[]) : [];
}

async function patchRows(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  path: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Supabase update failed with ${response.status}.`);
  }
}

async function insertRows(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  path: string,
  body: Record<string, unknown> | Record<string, unknown>[],
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Supabase insert failed with ${response.status}.`);
  }
}

async function callRpc<T>(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  functionName: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Supabase ${functionName} transaction failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function hasMatchingAmount(
  receivedAmount: number,
  expectedAmount: number,
  receivedCurrency: string,
  expectedCurrency = 'NGN',
) {
  return (
    receivedAmount === expectedAmount &&
    receivedCurrency.toUpperCase() === expectedCurrency.toUpperCase()
  );
}

async function reduceOrderStock(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  orderId: string,
) {
  const orderItems = await readRows<JsonRecord>(
    supabaseUrl,
    headers,
    `/rest/v1/order_items?select=business_id,quantity&order_id=eq.${encodeURIComponent(orderId)}`,
  );
  const quantityByBusiness = new Map<string, number>();

  for (const item of orderItems) {
    const businessId = optionalString(item.business_id);

    if (!businessId) {
      continue;
    }

    quantityByBusiness.set(
      businessId,
      (quantityByBusiness.get(businessId) ?? 0) + Math.max(0, Math.floor(toNumber(item.quantity))),
    );
  }

  for (const [businessId, quantity] of quantityByBusiness.entries()) {
    if (quantity <= 0) {
      continue;
    }

    const businesses = await readRows<JsonRecord>(
      supabaseUrl,
      headers,
      `/rest/v1/businesses?select=id,listing_type,stock_quantity&id=eq.${encodeURIComponent(businessId)}&limit=1`,
    );
    const business = businesses[0];

    if (!business || optionalString(business.listing_type) !== 'product') {
      continue;
    }

    const currentStock = Math.max(0, Math.floor(toNumber(business.stock_quantity)));
    const nextStock = Math.max(0, currentStock - quantity);

    await patchRows(
      supabaseUrl,
      headers,
      `/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        stock_quantity: nextStock,
        updated_at: new Date().toISOString(),
      },
    );
  }
}

async function handleOrderCharge(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  reference: string,
  payload: JsonRecord,
  data: JsonRecord,
  amount: number,
  currency: string,
): Promise<HandlerResult | undefined> {
  const orders = await readRows<JsonRecord>(
    supabaseUrl,
    headers,
    `/rest/v1/orders?select=*&id=eq.${encodeURIComponent(reference)}&limit=1`,
  );
  const order = orders[0];

  if (!order) {
    return undefined;
  }

  if (optionalString(order.payment_status) === 'paid') {
    return { body: { status: 'duplicate', reference, target: 'order' } };
  }

  const expectedAmount = toNumber(order.total_amount);
  const isSuccessful = successfulStatus(data.status) || successfulStatus(payload.status);

  if (!isSuccessful) {
    return {
      body: {
        status: 'ignored',
        reference,
        target: 'order',
        reason: 'Flutterwave did not report a successful payment.',
      },
    };
  }

  if (!hasMatchingAmount(amount, expectedAmount, currency)) {
    return {
      body: {
        status: 'ignored',
        reference,
        target: 'order',
        reason: `Flutterwave reported ${currency} ${amount}, expected NGN ${expectedAmount}.`,
      },
    };
  }

  await patchRows(
    supabaseUrl,
    headers,
    `/rest/v1/orders?id=eq.${encodeURIComponent(reference)}`,
    {
      provider_transaction_id: optionalString(data.id) ?? null,
      provider_reference:
        optionalString(data.flw_ref) ?? optionalString(data.reference) ?? reference,
      updated_at: new Date().toISOString(),
    },
  );

  const stockFinalized = await callRpc<boolean>(
    supabaseUrl,
    headers,
    'finalize_paid_order',
    {
      p_order_id: reference,
      p_provider_reference:
        optionalString(data.flw_ref) ?? optionalString(data.id) ?? reference,
    },
  );

  if (!stockFinalized) {
    return {
      body: {
        status: 'refundPending',
        reference,
        target: 'order',
        reason: 'Payment was verified, but stock became unavailable.',
      },
    };
  }

  return { body: { status: 'paid', reference, target: 'order' } };
}

function calculateSubscriptionEnd(cycle: string, rawPayload: unknown, paidAt: string) {
  const paidDate = new Date(paidAt);
  const metadata = isJsonRecord(rawPayload) ? rawPayload : {};
  const durationMinutes = toNumber(metadata.durationMinutes);
  const durationMonths = toNumber(metadata.durationMonths);

  if (durationMinutes > 0) {
    paidDate.setMinutes(paidDate.getMinutes() + durationMinutes);
  } else if (cycle === 'weekly') {
    paidDate.setDate(paidDate.getDate() + 7);
  } else {
    paidDate.setDate(paidDate.getDate() + 30 * Math.max(1, Math.floor(durationMonths || 1)));
  }

  return paidDate.toISOString();
}

async function handleSubscriptionCharge(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  reference: string,
  payload: JsonRecord,
  data: JsonRecord,
  amount: number,
  currency: string,
): Promise<HandlerResult | undefined> {
  const encodedReference = encodeURIComponent(reference);
  const payments = await readRows<JsonRecord>(
    supabaseUrl,
    headers,
    `/rest/v1/subscription_payments?select=*&or=(reference.eq.${encodedReference},id.eq.${encodedReference})&limit=1`,
  );
  const payment = payments[0];

  if (!payment) {
    return undefined;
  }

  if (optionalString(payment.status) === 'paid') {
    return { body: { status: 'duplicate', reference, target: 'subscription' } };
  }

  const expectedAmount = toNumber(payment.amount);
  const expectedCurrency = optionalString(payment.currency)?.toUpperCase() ?? 'NGN';
  const isSuccessful = successfulStatus(data.status) || successfulStatus(payload.status);

  if (!isSuccessful) {
    return {
      body: {
        status: 'ignored',
        reference,
        target: 'subscription',
        reason: 'Flutterwave did not report a successful payment.',
      },
    };
  }

  if (!hasMatchingAmount(amount, expectedAmount, currency, expectedCurrency)) {
    return {
      body: {
        status: 'ignored',
        reference,
        target: 'subscription',
        reason: `Flutterwave reported ${currency} ${amount}, expected ${expectedCurrency} ${expectedAmount}.`,
      },
    };
  }

  const now = new Date().toISOString();
  const cycle = optionalString(payment.cycle) ?? 'monthly';
  const rawPayload = payment.raw_payload;
  const itemCount = Math.max(
    1,
    Math.floor(toNumber(isJsonRecord(rawPayload) ? rawPayload.itemCount : undefined) || 1),
  );
  const nextBillingAt = calculateSubscriptionEnd(cycle, rawPayload, now);
  const ownerUserId = optionalString(payment.owner_user_id);
  const subscriptionType = isJsonRecord(rawPayload)
    ? optionalString(rawPayload.subscriptionType)
    : undefined;

  await patchRows(
    supabaseUrl,
    headers,
    `/rest/v1/subscription_payments?id=eq.${encodeURIComponent(optionalString(payment.id) ?? reference)}`,
    {
      status: 'paid',
      paid_at: now,
      updated_at: now,
      raw_payload: {
        ...buildRawPayload(rawPayload, payload),
        nextBillingAt,
      },
    },
  );

  if (ownerUserId) {
    const subscriptionPatch = {
      subscription_cycle: cycle,
      subscription_status: 'paid',
      verified_amount: expectedAmount,
      subscription_paid_at: now,
      subscription_next_billing_at: nextBillingAt,
      subscription_item_count: itemCount,
      updated_at: now,
    };

    if (subscriptionType === 'customerBenefits') {
      await patchRows(
        supabaseUrl,
        headers,
        `/rest/v1/businesses?owner_user_id=eq.${encodeURIComponent(ownerUserId)}&listing_source=eq.customerAccount&listing_audience=eq.customerAdvert`,
        subscriptionPatch,
      ).catch(() => undefined);
      await insertRows(supabaseUrl, headers, '/rest/v1/notifications?on_conflict=id', {
        id: `notification-benefits-${reference}`,
        user_id: ownerUserId,
        user_name: optionalString(payment.owner_name) ?? 'Customer',
        audience: 'resident',
        title: 'Benefits subscription active',
        body: `Your advert promotion is active until ${nextBillingAt}.`,
        context_type: 'general',
        context_id: reference,
        created_at: now,
      }).catch(() => undefined);
    } else {
      const profiles = await readRows<JsonRecord>(
        supabaseUrl,
        headers,
        `/rest/v1/owner_business_profiles?select=*&owner_user_id=eq.${encodeURIComponent(ownerUserId)}&limit=1`,
      ).catch(() => []);
      const profile = profiles[0];
      const riverParkVerified = Boolean(profile?.river_park_verified);

      await patchRows(
        supabaseUrl,
        headers,
        `/rest/v1/owner_business_profiles?owner_user_id=eq.${encodeURIComponent(ownerUserId)}`,
        subscriptionPatch,
      ).catch(() => undefined);
      await patchRows(
        supabaseUrl,
        headers,
        `/rest/v1/businesses?owner_user_id=eq.${encodeURIComponent(ownerUserId)}`,
        {
          ...subscriptionPatch,
          verified: riverParkVerified,
          river_park_verified: riverParkVerified,
        },
      ).catch(() => undefined);
    }
  }

  return { body: { status: 'paid', reference, target: 'subscription' } };
}

async function handleRefundCompleted(
  supabaseUrl: string,
  headers: SupabaseHeaders,
  payload: JsonRecord,
  data: JsonRecord,
): Promise<HandlerResult> {
  const refundReference =
    optionalString(data.id) ??
    optionalString(data.refund_id) ??
    optionalString(payload.id);
  const transactionId =
    optionalString(data.TransactionId) ??
    optionalString(data.transaction_id) ??
    optionalString(data.tx_id) ??
    optionalString(data.charge_id);
  const providerReference =
    optionalString(data.FlwRef) ??
    optionalString(data.flw_ref) ??
    optionalString(data.reference);
  const refundStatus = optionalString(data.status)?.toLowerCase() ?? '';
  const filters = [
    refundReference
      ? `refund_provider_reference.eq.${encodeURIComponent(refundReference)}`
      : undefined,
    transactionId
      ? `provider_transaction_id.eq.${encodeURIComponent(transactionId)}`
      : undefined,
    providerReference
      ? `provider_reference.eq.${encodeURIComponent(providerReference)}`
      : undefined,
  ].filter((filter): filter is string => Boolean(filter));

  if (filters.length === 0) {
    return { body: { status: 'ignored', reason: 'Refund event has no transaction reference.' } };
  }

  const orders = await readRows<JsonRecord>(
    supabaseUrl,
    headers,
    `/rest/v1/orders?select=*&or=(${filters.join(',')})&limit=1`,
  );
  const order = orders[0];

  if (!order) {
    return { body: { status: 'ignored', reason: 'No matching order refund was found.' } };
  }

  const orderId = optionalString(order.id);
  if (!orderId) {
    return { body: { status: 'ignored', reason: 'Matching order has no identifier.' } };
  }

  if (refundStatus.includes('fail')) {
    await patchRows(
      supabaseUrl,
      headers,
      `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
      { refund_status: 'failed', updated_at: new Date().toISOString() },
    );
    return { body: { status: 'failed', reference: orderId, target: 'refund' } };
  }

  await callRpc<boolean>(supabaseUrl, headers, 'finalize_order_refund', {
    target_order_id: orderId,
    target_refund_reference: refundReference ?? providerReference ?? transactionId,
  });

  return { body: { status: 'refunded', reference: orderId, target: 'refund' } };
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const webhookSecret = Deno.env.get('FLUTTERWAVE_WEBHOOK_SECRET_HASH')?.trim();

  if (!webhookSecret) {
    return jsonResponse({ error: 'FLUTTERWAVE_WEBHOOK_SECRET_HASH is not configured.' }, 500);
  }

  const rawBody = await request.text();

  if (!(await hasValidFlutterwaveSignature(request, rawBody, webhookSecret))) {
    return jsonResponse({ error: 'Invalid Flutterwave webhook signature.' }, 401);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  if (!isJsonRecord(payload)) {
    return jsonResponse({ error: 'Webhook payload must be an object.' }, 400);
  }

  const eventType = optionalString(payload.type) ?? optionalString(payload.event);

  const data = isJsonRecord(payload.data) ? payload.data : payload;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase service credentials are not configured.' }, 500);
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  if (eventType === 'refund.completed') {
    try {
      const refundResult = await handleRefundCompleted(supabaseUrl, headers, payload, data);
      return jsonResponse(refundResult.body, refundResult.status ?? 200);
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Unable to finalize the refund.' },
        502,
      );
    }
  }

  if (eventType && eventType !== 'charge.completed') {
    return jsonResponse({ status: 'ignored', reason: `Unhandled event ${eventType}.` });
  }

  const reference = findReference(payload, data);
  const amount = toNumber(data.amount);
  const currency = optionalString(data.currency)?.toUpperCase() ?? 'NGN';
  const chargeId = optionalString(data.id) ?? optionalString(payload.id);

  if (!reference) {
    return jsonResponse({ error: 'Flutterwave webhook did not include a reference.' }, 400);
  }

  const encodedReference = encodeURIComponent(reference);
  const deposits = await readRows<JsonRecord>(
    supabaseUrl,
    headers,
    `/rest/v1/dynamic_deposit_accounts?select=*&or=(reference.eq.${encodedReference},provider_reference.eq.${encodedReference})&limit=1`,
  ).catch(() => []);
  const deposit = deposits[0];

  if (deposit) {
    if (deposit.status === 'paid') {
      return jsonResponse({ status: 'duplicate', reference });
    }

    if (deposit.status !== 'pending') {
      return jsonResponse({
        status: 'ignored',
        reference,
        reason: `Deposit is already ${deposit.status}.`,
      });
    }

    const expectedAmount = toNumber(deposit.amount);
    const expectedCurrency = optionalString(deposit.currency)?.toUpperCase() ?? 'NGN';
    const expiresAt = optionalString(deposit.expires_at);
    const isExpired =
      Boolean(expiresAt) && new Date(expiresAt).getTime() <= Date.now();
    const isSuccessful = successfulStatus(data.status) || successfulStatus(payload.status);
    const now = new Date().toISOString();
    const failureReason = !isSuccessful
      ? 'Flutterwave reported the transfer as failed.'
      : isExpired
        ? 'Payment arrived after the 30-minute deposit window.'
        : amount !== expectedAmount
          ? `Flutterwave reported ${currency} ${amount}, expected ${expectedCurrency} ${expectedAmount}.`
          : currency !== expectedCurrency
            ? `Flutterwave reported ${currency}, expected ${expectedCurrency}.`
            : undefined;
    const nextStatus = failureReason ? 'expired' : 'paid';

    await patchRows(
      supabaseUrl,
      headers,
      `/rest/v1/dynamic_deposit_accounts?id=eq.${encodeURIComponent(optionalString(deposit.id) ?? reference)}`,
      {
        status: nextStatus,
        updated_at: now,
        raw_payload: buildRawPayload(deposit.raw_payload, payload),
        ...(nextStatus === 'paid'
          ? {
              paid_at: now,
              provider_charge_id: chargeId ?? null,
              failure_reason: null,
            }
          : {
              failure_reason: failureReason,
              provider_charge_id: chargeId ?? null,
            }),
      },
    );

    return jsonResponse({
      status: nextStatus,
      reference,
      ...(failureReason ? { failureReason } : {}),
    });
  }

  try {
    const orderResult = await handleOrderCharge(
      supabaseUrl,
      headers,
      reference,
      payload,
      data,
      amount,
      currency,
    );

    if (orderResult) {
      return jsonResponse(orderResult.body, orderResult.status ?? 200);
    }

    const subscriptionResult = await handleSubscriptionCharge(
      supabaseUrl,
      headers,
      reference,
      payload,
      data,
      amount,
      currency,
    );

    if (subscriptionResult) {
      return jsonResponse(subscriptionResult.body, subscriptionResult.status ?? 200);
    }
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to process Flutterwave webhook.',
      },
      502,
    );
  }

  return jsonResponse({ status: 'ignored', reference, reason: 'No matching View2Connect payment.' });
});
