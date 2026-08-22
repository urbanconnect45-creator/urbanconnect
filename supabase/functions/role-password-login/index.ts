import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type UserRole = 'resident' | 'businessOwner' | 'dispatch';

type LoginPayload = {
  identifier?: string;
  password?: string;
  role?: UserRole;
};

const allowedRoles = new Set<UserRole>(['resident', 'businessOwner', 'dispatch']);
const corsHeaders = {
  'Access-Control-Allow-Origin':
    Deno.env.get('VIEW2CONNECT_WEB_ORIGIN')?.trim() || 'https://www.view2connect.ng',
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashRateKey(value: string) {
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
    body: JSON.stringify({
      p_rate_key: key,
      p_max_requests: 10,
      p_window_seconds: 900,
    }),
  });

  return response.ok && (await response.json().catch(() => false)) === true;
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Account login is not configured.' }, 500);
  }

  let payload: LoginPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid login request.' }, 400);
  }

  const identifier = payload.identifier?.trim().toLowerCase() ?? '';
  const password = payload.password ?? '';
  const role = payload.role;

  if (!identifier || !password || !role || !allowedRoles.has(role)) {
    return jsonResponse({ error: 'Incorrect email, phone number, or password.' }, 401);
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await consumeRateLimit(
    supabaseUrl,
    serviceRoleKey,
    await hashRateKey(`role-login:${forwardedFor}:${role}:${identifier}`),
  );

  if (!allowed) {
    return jsonResponse({ error: 'Too many login attempts. Please wait and try again.' }, 429);
  }

  const filter = identifier.includes('@')
    ? `email=eq.${encodeURIComponent(identifier)}`
    : `phone_number=eq.${encodeURIComponent(identifier)}`;
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,auth_email&${filter}&role=eq.${encodeURIComponent(role)}&status=eq.active&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  const profiles = profileResponse.ok
    ? ((await profileResponse.json()) as Array<{ id: string; auth_email?: string | null }>)
    : [];
  const profile = profiles[0];
  const authEmail = profile?.auth_email?.trim().toLowerCase();

  if (!profile || !authEmail) {
    return jsonResponse({ error: 'Incorrect email, phone number, or password.' }, 401);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: authEmail, password }),
  });
  const authPayload = await authResponse.json().catch(() => ({}));

  if (!authResponse.ok) {
    return jsonResponse({ error: 'Incorrect email, phone number, or password.' }, 401);
  }

  const authUserId =
    authPayload && typeof authPayload === 'object' && 'user' in authPayload
      ? (authPayload as { user?: { id?: string } }).user?.id
      : undefined;

  if (!authUserId || authUserId !== profile.id) {
    return jsonResponse({ error: 'This login is not connected to the selected account type.' }, 403);
  }

  return jsonResponse(authPayload as Record<string, unknown>);
});
