// @ts-nocheck

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const rawNumber = String(body.rcNumber ?? body.cacNumber ?? '').trim();
    const businessName = String(body.businessName ?? '').trim();
    const tin = String(body.tin ?? '').trim();

    const cleanedNumber = rawNumber.replace(/\s+/g, '').toUpperCase();

    if (!cleanedNumber && !businessName && !tin) {
      return Response.json(
        {
          verified: false,
          source: 'cac',
          message: 'Enter CAC/RC/BN/IT number, business name, or TIN.',
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const cacBaseUrl = Deno.env.get('CAC_VAS_BASE_URL');
    const cacApiKey = Deno.env.get('CAC_VAS_API_KEY');

    if (!cacBaseUrl || !cacApiKey) {
      return Response.json(
        {
          verified: false,
          source: 'cac',
          message: 'CAC VAS API is not configured. Add CAC_VAS_BASE_URL and CAC_VAS_API_KEY.',
        },
        { status: 500, headers: corsHeaders },
      );
    }

    const cleanBaseUrl = cacBaseUrl.replace(/\/$/, '');

    /**
     * Change this endpoint to the EXACT endpoint CAC gives you.
     * CAC VAS docs show the validation APIs under /api/vas/validation/secure/...
     */
    const endpoint = `${cleanBaseUrl}/api/vas/validation/secure/get-company-by-rc-number`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        X_API_KEY: cacApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        rcNumber: cleanedNumber,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json(
        {
          verified: false,
          source: 'cac',
          message:
            payload?.message ??
            payload?.error ??
            'CAC API could not verify this CAC business number.',
          status: response.status,
          endpointUsed: endpoint,
          raw: payload,
        },
        { status: response.status, headers: corsHeaders },
      );
    }

    return Response.json(
      {
        verified: true,
        source: 'cac',
        rcNumber: cleanedNumber,
        businessName,
        tin,
        raw: payload,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      {
        verified: false,
        source: 'cac',
        message: error instanceof Error ? error.message : 'Unable to verify CAC registration.',
      },
      { status: 500, headers: corsHeaders },
    );
  }
});