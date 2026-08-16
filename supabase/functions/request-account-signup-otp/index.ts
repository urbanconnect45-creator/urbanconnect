// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type RequestPayload = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: 'resident' | 'businessOwner' | 'dispatch';
  estateId?: string;
  businessName?: string;
  businessCluster?: string;
};

type ProfileRow = {
  id: string;
  email: string;
  phone_number?: string;
  role?: 'resident' | 'businessOwner' | 'dispatch';
};

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

function isValidEmail(value?: string) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function roleLabel(role?: ProfileRow['role']) {
  if (role === 'businessOwner') {
    return 'store owner';
  }

  if (role === 'dispatch') {
    return 'dispatch';
  }

  return 'customer';
}

function duplicateAccountMessage(existingRole: ProfileRow['role'], requestedRole: RequestPayload['role']) {
  return `A ${roleLabel(requestedRole)} account with this email already exists. Use ${roleLabel(
    requestedRole,
  )} login instead.`;
}

async function hashCode(email: string, code: string, secret: string) {
  const bytes = new TextEncoder().encode(`${email}:${code}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function rateKey(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function consumeRateLimit(
  supabaseUrl: string,
  serviceRoleKey: string,
  key: string,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_edge_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_rate_key: key, p_max_requests: 5, p_window_seconds: 3600 }),
  });
  return response.ok && (await response.json().catch(() => false)) === true;
}

function createOtp() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);

  return String(random[0] % 100000000).padStart(8, '0');
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function normalizeEmailFailureMessage(message: string) {
  if (/domain is not verified/i.test(message)) {
    return 'Verification code could not be sent because the View2Connect email sending domain is not verified. Please contact support.';
  }

  if (/testing email address|domains like|invalid `to` field/i.test(message)) {
    return 'Use a real email inbox for signup. Test or placeholder email domains cannot receive verification codes.';
  }

  if (/RESEND_API_KEY|api key/i.test(message)) {
    return 'Verification code could not be sent because email delivery is not configured correctly. Please contact support.';
  }

  if (/RESEND_FROM_EMAIL|verified sender/i.test(message)) {
    return 'Verification code could not be sent because the sender email is not verified. Please contact support.';
  }

  return message || 'The verification email could not be sent.';
}

async function readEmailFailure(response: Response) {
  const text = await response.text().catch(() => '');
  const payload = text ? parseJson(text) : undefined;
  const providerBodyValue = payload?.providerBody;
  const providerBody =
    typeof providerBodyValue === 'string'
      ? parseJson(providerBodyValue)
      : providerBodyValue && typeof providerBodyValue === 'object'
        ? (providerBodyValue as Record<string, unknown>)
        : undefined;
  const providerMessage =
    typeof providerBody?.message === 'string'
      ? providerBody.message
      : typeof providerBodyValue === 'string'
        ? providerBodyValue
        : '';
  const helperMessage =
    typeof payload?.error === 'string' ? payload.error : 'The verification email could not be sent.';
  const message = normalizeEmailFailureMessage(providerMessage || helperMessage);

  return {
    error: message,
    emailError: helperMessage,
    providerStatus:
      typeof payload?.providerStatus === 'number' ? payload.providerStatus : response.status,
    providerMessage: providerMessage || helperMessage,
  };
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
  const otpHashSecret = Deno.env.get('ACCOUNT_SIGNUP_OTP_SECRET')?.trim();

  if (!supabaseUrl || !serviceRoleKey || !otpHashSecret) {
    return jsonResponse({ error: 'Account verification is not configured.' }, 500);
  }

  let payload: RequestPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const email = payload.email?.trim().toLowerCase() ?? '';
  const role = payload.role ?? 'resident';
  const firstName = payload.firstName?.trim() || 'View2Connect';
  const lastName = payload.lastName?.trim() || 'User';
  const phoneNumber = payload.phoneNumber?.trim() || '';
  const estateId = payload.estateId?.trim() || 'river-park';
  const businessName = payload.businessName?.trim() || '';
  const businessCluster = payload.businessCluster?.trim() || '';

  if (role === 'businessOwner') {
    return jsonResponse(
      { error: 'Use the seller registration page for store owner account creation.' },
      400,
    );
  }

  if (
    !isValidEmail(email) ||
    !firstName ||
    !lastName ||
    !phoneNumber ||
    (role !== 'resident' && role !== 'dispatch')
  ) {
    return jsonResponse({ error: 'Enter the required signup details.' }, 400);
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const allowed = await consumeRateLimit(
    supabaseUrl,
    serviceRoleKey,
    await rateKey(`signup:${role}:${email}`),
  );
  if (!allowed) {
    return jsonResponse(
      { error: 'Too many verification requests. Try again later.' },
      429,
    );
  }

  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,email,phone_number,role&email=eq.${encodeURIComponent(
      email,
    )}&role=eq.${encodeURIComponent(role)}&limit=1`,
    { headers: serviceHeaders },
  );
  const profileRows = profileResponse.ok
    ? ((await profileResponse.json().catch(() => [])) as ProfileRow[])
    : [];

  if (Array.isArray(profileRows) && profileRows.length > 0) {
    const existingProfile = profileRows[0];

    return jsonResponse(
      { error: duplicateAccountMessage(existingProfile.role, role) },
      409,
    );
  }

  const phoneResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,email,phone_number,role&phone_number=eq.${encodeURIComponent(
      phoneNumber,
    )}&role=eq.${encodeURIComponent(role)}&limit=1`,
    { headers: serviceHeaders },
  );
  const phoneRows = phoneResponse.ok
    ? ((await phoneResponse.json().catch(() => [])) as ProfileRow[])
    : [];

  if (Array.isArray(phoneRows) && phoneRows.length > 0) {
    return jsonResponse(
      { error: `A ${roleLabel(role)} account with this phone number already exists.` },
      409,
    );
  }

  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/account_signup_verifications?select=requested_at&email=eq.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}&limit=1`,
    { headers: serviceHeaders },
  );
  const existingRows = existingResponse.ok
    ? ((await existingResponse.json()) as Array<{ requested_at?: string }>)
    : [];
  const lastRequestedAt = existingRows[0]?.requested_at
    ? new Date(existingRows[0].requested_at).getTime()
    : 0;

  if (lastRequestedAt && Date.now() - lastRequestedAt < 120000) {
    return jsonResponse(
      { error: 'Wait two minutes before requesting another verification code.' },
      429,
    );
  }

  const code = createOtp();
  const codeHash = await hashCode(email, code, otpHashSecret);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const requestedAt = new Date().toISOString();
  const saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/account_signup_verifications?on_conflict=email,role`,
    {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email,
        role,
        code_hash: codeHash,
        payload: {
          firstName,
          lastName,
          phoneNumber,
          estateId,
          businessName,
          businessCluster,
        },
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
        id: `account-otp-${email}-${requestedAt.slice(0, 16)}`,
        recipientName: `${firstName} ${lastName}`.trim(),
        recipientEmail: email,
        subject: 'Your View2Connect verification code',
        body: `Your verification code is ${code}.\n\nIt expires in 10 minutes. Enter it on the signup screen. Your account will not be created until the correct code is confirmed.`,
      }),
    },
  );

  if (!emailResponse.ok) {
    const emailFailure = await readEmailFailure(emailResponse);

    await fetch(
      `${supabaseUrl}/rest/v1/account_signup_verifications?email=eq.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}`,
      { method: 'DELETE', headers: serviceHeaders },
    ).catch(() => undefined);

    return jsonResponse(emailFailure, 502);
  }

  return jsonResponse({ status: 'sent', expiresAt });
});
