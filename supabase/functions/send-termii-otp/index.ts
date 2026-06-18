import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type SendTermiiOtpPayload = {
  phoneNumber?: string;
  recipientName?: string;
  purpose?: string;
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

function normalizePhoneNumber(value?: string) {
  const digits = (value ?? '').replace(/\D/g, '');

  if (digits.startsWith('234') && digits.length >= 13) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `234${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `234${digits}`;
  }

  return digits;
}

function maskPhoneNumber(value: string) {
  if (value.length <= 6) {
    return value;
  }

  return `${value.slice(0, 4)}****${value.slice(-3)}`;
}

function getTermiiBaseUrl() {
  return (Deno.env.get('TERMII_BASE_URL')?.trim() || 'https://api.ng.termii.com').replace(
    /\/+$/,
    '',
  );
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = Deno.env.get('TERMII_API_KEY')?.trim();
  const senderId = Deno.env.get('TERMII_SENDER_ID')?.trim() || 'UrbanConn';
  const channel = Deno.env.get('TERMII_CHANNEL')?.trim() || 'generic';

  if (!apiKey) {
    return jsonResponse({ error: 'TERMII_API_KEY is not configured.' }, 500);
  }

  let payload: SendTermiiOtpPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);

  if (!/^234\d{10}$/.test(phoneNumber)) {
    return jsonResponse({ error: 'Enter a valid Nigerian phone number for OTP.' }, 400);
  }

  const purpose = payload.purpose?.trim() || 'verify your UrbanConnect account';
  const messageText = `Your UrbanConnect OTP to ${purpose} is < 123456 >. It expires in 10 minutes.`;

  let termiiResponse: Response;

  try {
    termiiResponse = await fetch(`${getTermiiBaseUrl()}/api/sms/otp/send`, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        message_type: 'NUMERIC',
        to: phoneNumber,
        from: senderId,
        channel,
        pin_attempts: 5,
        pin_time_to_live: 10,
        pin_length: 6,
        pin_placeholder: '< 123456 >',
        message_text: messageText,
        pin_type: 'NUMERIC',
      }),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'OTP provider did not respond.',
        providerBody: error instanceof Error ? error.message : 'Unknown provider timeout.',
      },
      504,
    );
  }

  const responseText = await termiiResponse.text();
  let providerBody: Record<string, unknown> = {};

  try {
    providerBody = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    providerBody = { raw: responseText };
  }

  if (!termiiResponse.ok) {
    return jsonResponse(
      {
        error: 'OTP provider rejected the request.',
        providerStatus: termiiResponse.status,
        providerBody,
      },
      502,
    );
  }

  const pinId = String(
    providerBody.pinId ?? providerBody.pin_id ?? providerBody.pinID ?? providerBody.id ?? '',
  ).trim();

  if (!pinId) {
    return jsonResponse(
      {
        error: 'OTP provider did not return a pin ID.',
        providerStatus: termiiResponse.status,
        providerBody,
      },
      502,
    );
  }

  return jsonResponse({
    status: 'sent',
    phoneNumber: maskPhoneNumber(phoneNumber),
    pinId,
  });
});
