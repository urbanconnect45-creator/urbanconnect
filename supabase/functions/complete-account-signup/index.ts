import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type CompletePayload = {
  email?: string;
  code?: string;
  password?: string;
  role?: 'resident' | 'businessOwner' | 'dispatch';
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  estateId?: string;
  businessName?: string;
  businessCluster?: string;
};

type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
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

function duplicateAccountMessage(existingRole: ProfileRow['role'], requestedRole: CompletePayload['role']) {
  return `A ${roleLabel(requestedRole)} account with this email already exists. Use ${roleLabel(
    requestedRole,
  )} login instead.`;
}

function scopedAuthEmail(email: string, role: CompletePayload['role']) {
  const [localPart, domainPart = 'view2connect.local'] = email.split('@');
  const safeLocal = localPart.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 48) || 'account';
  const safeDomain = domainPart.replace(/[^a-z0-9.-]+/gi, '-').slice(0, 120) || 'view2connect.local';

  return `${safeLocal}+v2c-${role}@${safeDomain}`.toLowerCase();
}

function toSupabasePhone(value: string) {
  const trimmedValue = value.trim();

  if (/^\+[1-9]\d{7,14}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  const digits = trimmedValue.replace(/\D/g, '');

  if (/^0\d{10}$/.test(digits)) {
    return `+234${digits.slice(1)}`;
  }

  if (/^234\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  if (/^\d{10}$/.test(digits)) {
    return `+234${digits}`;
  }

  return null;
}

async function hashCode(email: string, code: string, secret: string) {
  const bytes = new TextEncoder().encode(`${email}:${code}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
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

  let payload: CompletePayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const email = payload.email?.trim().toLowerCase() ?? '';
  const code = payload.code?.replace(/\D/g, '') ?? '';
  const password = payload.password ?? '';
  const role = payload.role ?? 'resident';
  const firstName = payload.firstName?.trim() ?? '';
  const lastName = payload.lastName?.trim() ?? '';
  const phoneNumber = payload.phoneNumber?.trim() ?? '';
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
    !/^\d{8}$/.test(code) ||
    password.length < 8 ||
    !firstName ||
    !lastName ||
    !phoneNumber ||
    (role !== 'resident' && role !== 'dispatch')
  ) {
    return jsonResponse({ error: 'Complete all signup fields and enter the 8-digit code.' }, 400);
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const verificationResponse = await fetch(
    `${supabaseUrl}/rest/v1/account_signup_verifications?select=*&email=eq.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}&limit=1`,
    { headers: serviceHeaders },
  );
  const verificationRows = verificationResponse.ok
    ? ((await verificationResponse.json()) as Array<{
        role: string;
        code_hash: string;
        expires_at: string;
        attempts: number;
        payload?: Record<string, unknown>;
      }>)
    : [];
  const verification = verificationRows[0];

  if (!verification) {
    return jsonResponse({ error: 'Request a new verification code.' }, 400);
  }

  if (verification.role !== role) {
    return jsonResponse({ error: 'This verification code was requested for a different role.' }, 400);
  }

  if (new Date(verification.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: 'This verification code has expired. Request a new one.' }, 400);
  }

  if ((verification.attempts ?? 0) >= 5) {
    return jsonResponse({ error: 'Too many incorrect attempts. Request a new code.' }, 429);
  }

  const expectedHash = await hashCode(email, code, otpHashSecret);
  if (expectedHash !== verification.code_hash) {
    await fetch(
      `${supabaseUrl}/rest/v1/account_signup_verifications?email=eq.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}`,
      {
        method: 'PATCH',
        headers: {
          ...serviceHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ attempts: (verification.attempts ?? 0) + 1 }),
      },
    ).catch(() => undefined);

    return jsonResponse({ error: 'The verification code is incorrect.' }, 400);
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

  const usersResponse = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: serviceHeaders },
  );
  const usersPayload = (await readJson(usersResponse)) as { users?: AuthUser[] };
  const visibleAuthUserExists = usersPayload.users?.some(
    (user) => user.email?.trim().toLowerCase() === email,
  );
  const authEmail = visibleAuthUserExists ? scopedAuthEmail(email, role) : email;
  const roleAuthUserExists = usersPayload.users?.some(
    (user) => user.email?.trim().toLowerCase() === authEmail,
  );
  const supabasePhone = toSupabasePhone(phoneNumber);
  const authPhoneExists = supabasePhone
    ? usersPayload.users?.some((user) => user.phone === supabasePhone)
    : false;

  if (roleAuthUserExists) {
    return jsonResponse(
      {
        error:
          'This role already has an auth login for that email. Use login or contact admin to repair the account.',
      },
      409,
    );
  }

  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      email: authEmail,
      ...(supabasePhone && !authPhoneExists
        ? { phone: supabasePhone, phone_confirm: true }
        : {}),
      password,
      email_confirm: true,
      user_metadata: {
        account_email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        phone_number: phoneNumber,
        role,
        estate_id: estateId,
        business_name: businessName,
        business_cluster: businessCluster,
      },
    }),
  });
  const createPayload = (await readJson(createResponse)) as AuthUser & { message?: string };
  if (!createResponse.ok || !createPayload.id) {
    return jsonResponse(
      { error: createPayload.message || 'Unable to create the verified account.' },
      502,
    );
  }

  const authUser = createPayload;
  const profilePayload = {
    id: authUser.id,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    email,
    auth_email: authEmail,
    phone_number: phoneNumber,
    password_hash: 'supabase-auth-managed',
    role,
    estate_id: estateId,
    business_name: businessName || null,
    business_cluster: businessCluster || null,
    river_park_verified: role === 'resident' || role === 'dispatch',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const profileInsertResponse = await fetch(`${supabaseUrl}/rest/v1/app_users?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...serviceHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(profilePayload),
  });

  if (!profileInsertResponse.ok) {
    const profileError = await readJson(profileInsertResponse);
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUser.id)}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    }).catch(() => undefined);
    return jsonResponse(
      { error: String((profileError as { message?: string }).message || 'Unable to save the account profile.') },
      502,
    );
  }

  if (role === 'dispatch') {
    const riderResponse = await fetch(`${supabaseUrl}/rest/v1/rider_profiles?on_conflict=auth_user_id`, {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        auth_user_id: authUser.id,
        full_name: `${firstName} ${lastName}`.trim(),
        email,
        phone_number: phoneNumber,
        status: 'active',
        updated_at: new Date().toISOString(),
      }),
    });

    if (!riderResponse.ok) {
      await fetch(`${supabaseUrl}/rest/v1/app_users?id=eq.${encodeURIComponent(authUser.id)}`, {
        method: 'DELETE',
        headers: serviceHeaders,
      }).catch(() => undefined);
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUser.id)}`, {
        method: 'DELETE',
        headers: serviceHeaders,
      }).catch(() => undefined);
      return jsonResponse({ error: 'Unable to finish the dispatch rider profile.' }, 502);
    }
  }

  await fetch(
    `${supabaseUrl}/rest/v1/account_signup_verifications?email=eq.${encodeURIComponent(email)}&role=eq.${encodeURIComponent(role)}`,
    { method: 'DELETE', headers: serviceHeaders },
  ).catch(() => undefined);

  return jsonResponse({
    status: 'created',
    authUserId: authUser.id,
    profile: profilePayload,
  });
});
