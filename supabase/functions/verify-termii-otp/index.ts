import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type VerifyTermiiOtpPayload = {
  pinId?: string;
  pin?: string;
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

function getTermiiBaseUrl() {
  return (Deno.env.get('TERMII_BASE_URL')?.trim() || 'https://api.ng.termii.com').replace(
    /\/+$/,
    '',
  );
}

function isVerifiedProviderBody(providerBody: Record<string, unknown>) {
  const verifiedValue = providerBody.verified ?? providerBody.status ?? providerBody.message;

  if (typeof verifiedValue === 'boolean') {
    return verifiedValue;
  }

  return String(verifiedValue ?? '').trim().toLowerCase() === 'true';
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = Deno.env.get('TERMII_API_KEY')?.trim();

  if (!apiKey) {
    return jsonResponse({ error: 'TERMII_API_KEY is not configured.' }, 500);
  }

  let payload: VerifyTermiiOtpPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const pinId = payload.pinId?.trim();
  const pin = payload.pin?.replace(/\D/g, '') ?? '';

  if (!pinId) {
    return jsonResponse({ error: 'A Termii pin ID is required.' }, 400);
  }

  if (!/^\d{4,8}$/.test(pin)) {
    return jsonResponse({ error: 'Enter the numeric OTP code.' }, 400);
  }

  let termiiResponse: Response;

  try {
    termiiResponse = await fetch(`${getTermiiBaseUrl()}/api/sms/otp/verify`, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        pin_id: pinId,
        pin,
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
        error: 'OTP provider rejected the verification.',
        providerStatus: termiiResponse.status,
        providerBody,
      },
      502,
    );
  }

  if (!isVerifiedProviderBody(providerBody)) {
    return jsonResponse(
      {
        error: 'OTP code was not verified.',
        verified: false,
        providerBody,
      },
      400,
    );
  }

  return jsonResponse({
    status: 'verified',
    verified: true,
    pinId,
  });
});
