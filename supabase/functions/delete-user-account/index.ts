declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

export {};

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

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
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
  const authorization = request.headers.get('authorization')?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: 'Account deletion is not configured.' }, 500);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  const authUser = (await readJson(authResponse)) as { id?: string };

  if (!authResponse.ok || !authUser.id) {
    return jsonResponse({ error: 'Sign in again before deleting your account.' }, 401);
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const adminResponse = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?select=id&auth_user_id=eq.${encodeURIComponent(authUser.id)}&limit=1`,
    { headers: serviceHeaders },
  );
  const admins = adminResponse.ok ? ((await readJson(adminResponse)) as unknown[]) : [];

  if (admins.length > 0) {
    return jsonResponse({ error: 'Admin accounts must be removed by the platform owner.' }, 403);
  }

  const rateResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_edge_rate_limit`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      p_rate_key: `account-delete:${authUser.id}`,
      p_max_requests: 3,
      p_window_seconds: 3600,
    }),
  });

  if (!rateResponse.ok || !Boolean(await readJson(rateResponse))) {
    return jsonResponse({ error: 'Too many deletion attempts. Wait and try again.' }, 429);
  }

  const anonymizeResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/anonymize_user_account_for_deletion`,
    {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({ target_user_id: authUser.id }),
    },
  );

  if (!anonymizeResponse.ok) {
    const error = (await readJson(anonymizeResponse)) as { message?: string };
    return jsonResponse(
      { error: error.message || 'Your account could not be prepared for deletion.' },
      500,
    );
  }

  const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
    method: 'DELETE',
    headers: serviceHeaders,
  });

  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    return jsonResponse(
      {
        error:
          'Your profile was disabled, but the login identity could not be removed. Contact support.',
      },
      502,
    );
  }

  return jsonResponse({ deleted: true });
});
