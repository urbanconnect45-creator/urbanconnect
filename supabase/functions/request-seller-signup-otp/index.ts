import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type RequestPayload = {
  email?: string;
  ownerName?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

function isValidEmail(value?: string) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

async function hashCode(email: string, code: string, secret: string) {
  const bytes = new TextEncoder().encode(`${email}:${code}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function createOtp() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);

  return String(random[0] % 100000000).padStart(8, '0');
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Seller verification is not configured.' }, 500);
  }

  let payload: RequestPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const email = payload.email?.trim().toLowerCase() ?? '';
  const ownerName = payload.ownerName?.trim() || 'Seller';

  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Enter a valid email address.' }, 400);
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,email,role&email=eq.${encodeURIComponent(
      email,
    )}&role=eq.businessOwner&limit=1`,
    { headers: serviceHeaders },
  );
  const profileRows = profileResponse.ok
    ? ((await profileResponse.json().catch(() => [])) as Array<{ id?: string }>)
    : [];

  if (profileRows.length > 0) {
    return jsonResponse(
      { error: 'A store owner account with this email already exists. Use store owner login instead.' },
      409,
    );
  }

  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/seller_signup_verifications?select=requested_at&email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: serviceHeaders },
  );
  const existingRows = existingResponse.ok
    ? ((await existingResponse.json()) as Array<{ requested_at?: string }>)
    : [];
  const lastRequestedAt = existingRows[0]?.requested_at
    ? new Date(existingRows[0].requested_at).getTime()
    : 0;

  if (lastRequestedAt && Date.now() - lastRequestedAt < 60000) {
    return jsonResponse(
      { error: 'Wait one minute before requesting another verification code.' },
      429,
    );
  }

  const code = createOtp();
  const codeHash = await hashCode(email, code, serviceRoleKey);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const requestedAt = new Date().toISOString();
  const saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/seller_signup_verifications?on_conflict=email`,
    {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        requested_at: requestedAt,
      }),
    },
  );

  if (!saveResponse.ok) {
    return jsonResponse({ error: 'Unable to prepare email verification.' }, 502);
  }

  const emailResponse = await fetch(
    `${supabaseUrl}/functions/v1/send-notification-email`,
    {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: `seller-otp-${email}-${requestedAt.slice(0, 16)}`,
        recipientName: ownerName,
        recipientEmail: email,
        subject: 'Your View2Connect seller verification code',
        body: `Your verification code is ${code}.\n\nIt expires in 10 minutes. Enter it on the seller registration page. Your account will not be created until the correct code is confirmed.`,
      }),
    },
  );

  if (!emailResponse.ok) {
    await fetch(
      `${supabaseUrl}/rest/v1/seller_signup_verifications?email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: serviceHeaders },
    ).catch(() => undefined);

    return jsonResponse({ error: 'The verification email could not be sent.' }, 502);
  }

  return jsonResponse({ status: 'sent', expiresAt });
});
