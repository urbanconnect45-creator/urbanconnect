import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type Payload = {
  identifier?: string;
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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
  const redirectTo =
    Deno.env.get('PASSWORD_RESET_REDIRECT_URL')?.trim() ||
    'https://www.view2connect.ng/auth/reset-password';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Password recovery is not configured.' }, 500);
  }

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const identifier = payload.identifier?.trim().toLowerCase() ?? '';
  const role = payload.role ?? 'resident';
  if (!identifier || !['resident', 'businessOwner', 'dispatch'].includes(role)) {
    return jsonResponse({ status: 'accepted' });
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
  const allowed = await consumeRateLimit(
    supabaseUrl,
    serviceRoleKey,
    await rateKey(`password-reset:${role}:${identifier}`),
  );
  if (!allowed) {
    return jsonResponse({ status: 'accepted' });
  }
  const emailFilter = identifier.includes('@')
    ? `email=eq.${encodeURIComponent(identifier)}`
    : `phone_number=eq.${encodeURIComponent(identifier)}`;
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=auth_email&${emailFilter}&role=eq.${encodeURIComponent(role)}&status=eq.active&limit=1`,
    { headers: serviceHeaders },
  );
  const profiles = profileResponse.ok
    ? ((await profileResponse.json()) as Array<{ auth_email?: string }>)
    : [];
  const authEmail = profiles[0]?.auth_email?.trim().toLowerCase();

  if (authEmail) {
    await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: authEmail }),
    }).catch(() => undefined);
  }

  return jsonResponse({ status: 'accepted' });
});
