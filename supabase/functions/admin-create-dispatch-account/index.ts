import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type CreateDispatchPayload = {
  adminEmail?: string;
  adminPassword?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  estateId?: string;
  businessCluster?: string;
};

type AuthUser = {
  id: string;
  email?: string;
};

type AdminRow = {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'customerCare';
  is_active: boolean;
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || 'Dispatch';
  const lastName = parts.join(' ') || 'Rider';

  return { firstName, lastName };
}

function scopedAuthEmail(email: string, role: 'dispatch') {
  const [localPart, domainPart = 'view2connect.local'] = email.split('@');
  const safeLocal = localPart.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 48) || 'account';
  const safeDomain = domainPart.replace(/[^a-z0-9.-]+/gi, '-').slice(0, 120) || 'view2connect.local';

  return `${safeLocal}+v2c-${role}@${safeDomain}`.toLowerCase();
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const message = record.message ?? record.msg ?? record.error_description ?? record.error;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Dispatch account creation is not configured.' }, 500);
  }

  let payload: CreateDispatchPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const adminEmail = payload.adminEmail?.trim().toLowerCase() ?? '';
  const adminPassword = payload.adminPassword ?? '';
  const fullName = payload.fullName?.trim() ?? '';
  const email = payload.email?.trim().toLowerCase() ?? '';
  const phoneNumber = payload.phoneNumber?.trim() ?? '';
  const password = payload.password ?? '';
  const estateId = payload.estateId?.trim() || 'river-park';
  const businessCluster = payload.businessCluster?.trim() || null;

  if (
    !isValidEmail(adminEmail) ||
    adminPassword.length < 6 ||
    !fullName ||
    !isValidEmail(email) ||
    phoneNumber.replace(/\D/g, '').length < 10 ||
    password.length < 6
  ) {
    return jsonResponse(
      { error: 'Enter owner admin password and complete the dispatch account fields.' },
      400,
    );
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  const adminResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_admin_login`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      admin_email: adminEmail,
      admin_password: adminPassword,
    }),
  });
  const adminRows = adminResponse.ok ? ((await adminResponse.json()) as AdminRow[]) : [];
  const admin = adminRows[0];

  if (!admin || admin.role !== 'owner' || !admin.is_active) {
    return jsonResponse({ error: 'Only the active owner admin can create dispatch accounts.' }, 403);
  }

  const existingProfileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,email,role&email=eq.${encodeURIComponent(
      email,
    )}&role=eq.dispatch&limit=1`,
    { headers: serviceHeaders },
  );
  const existingProfiles = existingProfileResponse.ok
    ? ((await existingProfileResponse.json()) as Array<{ id: string }>)
    : [];

  if (existingProfiles.length > 0) {
    return jsonResponse({ error: 'A dispatch account with that email already exists.' }, 409);
  }

  const existingPhoneResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,phone_number,role&phone_number=eq.${encodeURIComponent(
      phoneNumber,
    )}&role=eq.dispatch&limit=1`,
    { headers: serviceHeaders },
  );
  const existingPhoneProfiles = existingPhoneResponse.ok
    ? ((await existingPhoneResponse.json()) as Array<{ id: string }>)
    : [];

  if (existingPhoneProfiles.length > 0) {
    return jsonResponse({ error: 'A dispatch account with that phone number already exists.' }, 409);
  }

  const usersResponse = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: serviceHeaders },
  );
  const usersPayload = (await readJson(usersResponse)) as { users?: AuthUser[] };
  const visibleAuthUserExists = usersPayload.users?.some(
    (user) => user.email?.trim().toLowerCase() === email,
  );
  const authEmail = visibleAuthUserExists ? scopedAuthEmail(email, 'dispatch') : email;
  const roleAuthUserExists = usersPayload.users?.some(
    (user) => user.email?.trim().toLowerCase() === authEmail,
  );

  if (roleAuthUserExists) {
    return jsonResponse({ error: 'A dispatch auth account with that email already exists.' }, 409);
  }

  const { firstName, lastName } = splitName(fullName);
  const createdAt = new Date().toISOString();
  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        account_email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone_number: phoneNumber,
        role: 'dispatch',
        estate_id: estateId,
        business_cluster: businessCluster,
      },
    }),
  });
  const createPayload = (await readJson(createResponse)) as AuthUser & { message?: string };

  if (!createResponse.ok || !createPayload.id) {
    return jsonResponse(
      { error: payloadMessage(createPayload, 'Unable to create the dispatch Auth account.') },
      createResponse.status >= 400 ? createResponse.status : 502,
    );
  }

  const profile = {
    id: createPayload.id,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email,
    auth_email: authEmail,
    phone_number: phoneNumber,
    password_hash: 'supabase-auth-managed',
    role: 'dispatch',
    estate_id: estateId,
    business_name: null,
    business_cluster: businessCluster,
    river_park_verified: true,
    status: 'active',
    created_at: createdAt,
    updated_at: createdAt,
  };
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/app_users?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...serviceHeaders,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(profile),
  });
  const profilePayload = await readJson(profileResponse);

  if (!profileResponse.ok) {
    return jsonResponse(
      { error: payloadMessage(profilePayload, 'Unable to save the dispatch profile.') },
      502,
    );
  }

  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/rider_profiles?on_conflict=auth_user_id`, {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        auth_user_id: createPayload.id,
        full_name: fullName,
        email,
        phone_number: phoneNumber,
        status: 'active',
        updated_at: createdAt,
      }),
    }),
    fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: `audit-dispatch-created-${createPayload.id}`,
        actor_name: admin.full_name,
        actor_role: 'owner',
        action: 'Dispatch account created',
        details: `${fullName} was added as a dispatch rider.`,
        created_at: createdAt,
      }),
    }),
  ]).catch(() => undefined);

  const rows = Array.isArray(profilePayload) ? profilePayload : [profile];

  return jsonResponse({ status: 'created', profile: rows[0] ?? profile });
});
