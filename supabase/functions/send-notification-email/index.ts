import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type EmailPayload = {
  id?: string;
  recipientName?: string;
  recipientEmail?: string;
  subject?: string;
  body?: string;
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isValidEmail(value?: string) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function extractEmailAddress(value?: string) {
  const trimmedValue = value?.trim() ?? '';
  const bracketMatch = trimmedValue.match(/<([^<>]+)>/);

  return (bracketMatch?.[1] ?? trimmedValue).trim();
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

  if (!subject || !body) {
    return jsonResponse({ error: 'Email subject and body are required.' }, 400);
  }

  const safeRecipientName = escapeHtml(payload.recipientName?.trim() || 'UrbanConnect user');
  const safeBody = escapeHtml(body).replaceAll('\n', '<br />');
  const safeSubject = escapeHtml(subject);

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
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2933;"><p>Hello ${safeRecipientName},</p><h2 style="font-size:20px;">${safeSubject}</h2><p>${safeBody}</p><p style="color:#667085;font-size:13px;">UrbanConnect</p></div>`,
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
