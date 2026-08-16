import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type EmailPayload = {
  id?: string;
  recipientName?: string;
  recipientEmail?: string;
  subject?: string;
  body?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VIEW2CONNECT_WEB_ORIGIN')?.trim() || 'https://www.view2connect.ng',
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function authorizeEmailRequest(request: Request, recipientEmail: string) {
  const authorization = request.headers.get('Authorization')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return false;
  }

  if (authorization === `Bearer ${serviceRoleKey}`) {
    return true;
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });

  if (!userResponse.ok) {
    return false;
  }

  const user = (await userResponse.json()) as { id?: string };

  if (!user.id) {
    return false;
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
  const adminResponse = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?select=id&auth_user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`,
    { headers: serviceHeaders },
  );
  const admins = adminResponse.ok ? ((await adminResponse.json()) as unknown[]) : [];

  if (admins.length > 0) {
    return true;
  }

  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=email&id=eq.${encodeURIComponent(user.id)}&status=eq.active&limit=1`,
    { headers: serviceHeaders },
  );
  const profiles = profileResponse.ok
    ? ((await profileResponse.json()) as Array<{ email?: string }>)
    : [];

  return profiles[0]?.email?.trim().toLowerCase() === recipientEmail.trim().toLowerCase();
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bodyToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
    .join('');
}

function isValidEmail(value?: string) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function extractEmailAddress(value?: string) {
  const trimmedValue = value?.trim() ?? '';
  const bracketMatch = trimmedValue.match(/<([^<>]+)>/);

  return (bracketMatch?.[1] ?? trimmedValue).trim();
}

async function rateKey(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function consumeEmailRateLimit(recipientEmail: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_edge_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_rate_key: await rateKey(`email:${recipientEmail.trim().toLowerCase()}`),
      p_max_requests: 20,
      p_window_seconds: 3600,
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

  const resendApiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  const replyToEmail = Deno.env.get('RESEND_REPLY_TO')?.trim();
  const siteUrl =
    Deno.env.get('VIEW2CONNECT_SITE_URL')?.trim() ||
    Deno.env.get('URBANCONNECT_SITE_URL')?.trim() ||
    'https://www.view2connect.ng';
  const logoUrl =
    Deno.env.get('URBANCONNECT_LOGO_URL')?.trim() ||
    `${siteUrl.replace(/\/+$/, '')}/assets/view2connect-mark.svg`;

  if (!resendApiKey) {
    return jsonResponse({ error: 'RESEND_API_KEY is not configured.' }, 500);
  }

  const senderEmailAddress = extractEmailAddress(fromEmail).toLowerCase();

  if (
    !fromEmail ||
    !isValidEmail(senderEmailAddress) ||
    senderEmailAddress.endsWith('@resend.dev')
  ) {
    return jsonResponse(
      { error: 'RESEND_FROM_EMAIL must be configured with a verified sender on your domain.' },
      500,
    );
  }

  if (replyToEmail && !isValidEmail(extractEmailAddress(replyToEmail))) {
    return jsonResponse({ error: 'RESEND_REPLY_TO must be a valid email address.' }, 500);
  }

  let payload: EmailPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  if (!isValidEmail(payload.recipientEmail)) {
    return jsonResponse({ error: 'A valid recipient email is required.' }, 400);
  }

  const subject = payload.subject?.trim();
  const body = payload.body?.trim();

  if (!subject || !body || subject.length > 160 || body.length > 10000) {
    return jsonResponse({ error: 'Email subject and body are required.' }, 400);
  }

  if (!(await authorizeEmailRequest(request, payload.recipientEmail!))) {
    return jsonResponse({ error: 'You are not authorized to send this email.' }, 403);
  }

  if (!(await consumeEmailRateLimit(payload.recipientEmail!))) {
    return jsonResponse({ error: 'Email rate limit reached. Try again later.' }, 429);
  }

  const safeRecipientName = escapeHtml(payload.recipientName?.trim() || 'View2Connect user');
  const safeBody = bodyToHtml(body);
  const safeSubject = escapeHtml(subject);
  const safeSiteUrl = escapeHtml(siteUrl);
  const safeLogoUrl = escapeHtml(logoUrl);

  let resendResponse: Response;

  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        ...(payload.id ? { 'Idempotency-Key': payload.id } : {}),
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.recipientEmail],
        subject,
        text: body,
        html: `<div style="margin:0;padding:0;background:#f7f5fc;font-family:Arial,sans-serif;color:#21183a;">
  <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
    <div style="background:#5B2BCB;border-radius:22px 22px 0 0;padding:28px;color:#ffffff;">
      <img src="${safeLogoUrl}" alt="View2Connect" width="58" height="58" style="display:block;border-radius:16px;margin-bottom:18px;" />
      <div style="font-size:13px;line-height:18px;font-weight:700;color:#F5C84C;text-transform:uppercase;">View2Connect notification</div>
      <h1 style="margin:8px 0 0;font-size:28px;line-height:34px;font-weight:900;color:#ffffff;">${safeSubject}</h1>
    </div>
    <div style="background:#ffffff;border:1px solid #dbe3dd;border-top:0;border-radius:0 0 22px 22px;padding:28px;">
      <p style="margin:0 0 18px;font-size:16px;line-height:25px;">Hello <strong>${safeRecipientName}</strong>,</p>
      <div style="font-size:16px;line-height:25px;color:#332a49;font-weight:600;">${safeBody}</div>
      <div style="margin-top:24px;padding:18px;border-radius:14px;background:#f7f5fc;border:1px solid #ded6f1;">
        <strong style="display:block;margin-bottom:6px;font-size:15px;line-height:22px;color:#5B2BCB;">About View2Connect</strong>
        <p style="margin:0;font-size:14px;line-height:22px;color:#625a73;">View2Connect is a CAC-registered marketplace for products, food, trusted services, secure payments, receipts, and delivery updates.</p>
      </div>
      <a href="${safeSiteUrl}" style="display:inline-block;margin-top:22px;background:#5B2BCB;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-size:14px;line-height:18px;font-weight:800;">Visit View2Connect</a>
      <p style="margin:22px 0 0;color:#667085;font-size:13px;line-height:20px;">View2Connect sends these emails automatically from your account activity, order updates, payment status, and account decisions.</p>
    </div>
  </div>
</div>`,
        ...(replyToEmail ? { reply_to: replyToEmail } : {}),
      }),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'Email provider did not respond.',
        providerBody: error instanceof Error ? error.message : 'Unknown provider timeout.',
      },
      504,
    );
  }

  const responseBody = await resendResponse.text();

  if (!resendResponse.ok) {
    return jsonResponse(
      {
        error: 'Email provider rejected the message.',
        providerStatus: resendResponse.status,
        providerBody: responseBody,
      },
      502,
    );
  }

  return jsonResponse({ id: payload.id, status: 'sent' });
});
