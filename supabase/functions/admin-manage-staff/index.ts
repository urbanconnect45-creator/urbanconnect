import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type StaffAction = 'list' | 'create' | 'setActive' | 'updatePassword';

type StaffPayload = {
  action?: StaffAction;
  adminId?: string;
  fullName?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
};

type AdminRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: 'owner' | 'admin' | 'customerCare';
  is_active: boolean;
  created_at: string;
};

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
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !accessToken) {
    return jsonResponse({ error: 'Staff management is not configured.' }, 500);
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
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
  const callerResponse = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?select=*&auth_user_id=eq.${encodeURIComponent(authUser.id)}&is_active=eq.true&limit=1`,
    { headers: serviceHeaders },
  );
  const callers = callerResponse.ok ? ((await callerResponse.json()) as AdminRow[]) : [];
  const caller = callers[0];

  if (!caller || caller.role !== 'owner') {
    return jsonResponse({ error: 'Only the owner admin can manage staff accounts.' }, 403);
  }

  let payload: StaffPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid staff request.' }, 400);
  }

  if (payload.action !== 'list') {
    const pinAuthorizationResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/has_recent_admin_action_authorization`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
    const pinIsAuthorized = pinAuthorizationResponse.ok
      ? Boolean(await pinAuthorizationResponse.json().catch(() => false))
      : false;
    if (!pinIsAuthorized) {
      return jsonResponse({ error: 'Confirm the Admin PIN before changing staff accounts.' }, 403);
    }
  }

  if (payload.action === 'list') {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?select=id,auth_user_id,full_name,email,role,is_active,created_at&order=created_at.desc`,
      { headers: serviceHeaders },
    );
    if (!response.ok) {
      return jsonResponse({ error: 'Unable to load staff accounts.' }, 502);
    }
    return jsonResponse({ admins: await response.json() });
  }

  if (payload.action === 'create') {
    const fullName = payload.fullName?.trim() ?? '';
    const email = payload.email?.trim().toLowerCase() ?? '';
    const password = payload.password ?? '';

    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return jsonResponse(
        { error: 'Enter a name, valid email, and password of at least 8 characters.' },
        400,
      );
    }

    const createAuthResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, admin_role: 'customerCare' },
      }),
    });
    const createdAuthUser = (await readJson(createAuthResponse)) as { id?: string; msg?: string };
    if (!createAuthResponse.ok || !createdAuthUser.id) {
      return jsonResponse(
        { error: createdAuthUser.msg || 'Unable to create the customer-care login.' },
        createAuthResponse.status || 502,
      );
    }

    const adminId = `admin-customer-care-${createdAuthUser.id}`;
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/admin_users`, {
      method: 'POST',
      headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        id: adminId,
        auth_user_id: createdAuthUser.id,
        full_name: fullName,
        email,
        password_hash: 'supabase-auth-managed',
        role: 'customerCare',
        is_active: true,
      }),
    });
    const inserted = insertResponse.ok ? ((await insertResponse.json()) as AdminRow[]) : [];

    if (!insertResponse.ok || !inserted[0]) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${createdAuthUser.id}`, {
        method: 'DELETE',
        headers: serviceHeaders,
      }).catch(() => undefined);
      return jsonResponse({ error: 'Unable to save the customer-care profile.' }, 502);
    }

    return jsonResponse({ admin: inserted[0] }, 201);
  }

  const adminId = payload.adminId?.trim() ?? '';
  const targetResponse = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?select=*&id=eq.${encodeURIComponent(adminId)}&limit=1`,
    { headers: serviceHeaders },
  );
  const targets = targetResponse.ok ? ((await targetResponse.json()) as AdminRow[]) : [];
  const target = targets[0];

  if (!target) {
    return jsonResponse({ error: 'Staff account was not found.' }, 404);
  }

  if (payload.action === 'setActive') {
    if (target.role !== 'customerCare') {
      return jsonResponse({ error: 'The owner account cannot be deactivated here.' }, 400);
    }
    const response = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?id=eq.${encodeURIComponent(adminId)}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ is_active: Boolean(payload.isActive), updated_at: new Date().toISOString() }),
      },
    );
    const rows = response.ok ? ((await response.json()) as AdminRow[]) : [];
    return rows[0]
      ? jsonResponse({ admin: rows[0] })
      : jsonResponse({ error: 'Unable to update the staff account.' }, 502);
  }

  if (payload.action === 'updatePassword') {
    const password = payload.password ?? '';
    if (password.length < 8) {
      return jsonResponse({ error: 'Password must be at least 8 characters.' }, 400);
    }
    if (!target.auth_user_id) {
      return jsonResponse({ error: 'This staff profile is not linked to Supabase Auth.' }, 409);
    }
    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(target.auth_user_id)}`,
      {
        method: 'PUT',
        headers: serviceHeaders,
        body: JSON.stringify({ password }),
      },
    );
    if (!response.ok) {
      const result = (await readJson(response)) as { msg?: string };
      return jsonResponse({ error: result.msg || 'Unable to update the staff password.' }, 502);
    }
    return jsonResponse({ admin: target });
  }

  return jsonResponse({ error: 'Unsupported staff action.' }, 400);
});
