declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

type JsonRecord = Record<string, unknown>;

type RequestPayload = {
  ownerUserId?: string;
  cacNumber?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeCredential(value?: string) {
  return value
    ?.trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^CAC_API_(KEY|TOKEN)\s*=\s*/i, '')
    .replace(/^Authorization\s*:\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as unknown) : {};
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as JsonRecord;
    const message = record.message ?? record.msg ?? record.error_description ?? record.error;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

function appendQueryParam(url: string, key: string, value: string) {
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function normalizeCacNumberForProvider(value: string) {
  return value.trim().toUpperCase().replace(/^(RC|BN|IT)[-/]?/i, '');
}

function inferCacEntityType(value: string) {
  const normalized = value.trim().toUpperCase();

  if (normalized.startsWith('BN')) {
    return 'BUSINESS_NAME';
  }

  if (normalized.startsWith('IT')) {
    return 'INCORPORATED_TRUSTEE';
  }

  return 'COMPANY';
}

function parseExtraBody(value?: string) {
  if (!value?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
  } catch {
    return {};
  }

  return {};
}

function normalizeLookupKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findProviderString(payload: unknown, keys: string[]): string | undefined {
  const wantedKeys = new Set(keys.map(normalizeLookupKey));

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const result = findProviderString(item, keys);

      if (result) {
        return result;
      }
    }

    return undefined;
  }

  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as JsonRecord;

  for (const [key, value] of Object.entries(record)) {
    if (wantedKeys.has(normalizeLookupKey(key))) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }
  }

  for (const value of Object.values(record)) {
    const result = findProviderString(value, keys);

    if (result) {
      return result;
    }
  }

  return undefined;
}

async function authenticatedUserId(request: Request) {
  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!authorization || !supabaseUrl || !anonKey) {
    return undefined;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await readJson(response)) as { id?: string };
  return payload.id;
}

async function updateSellerBusinessName(ownerUserId: string, businessName: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service credentials are unavailable.');
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const updatedAt = new Date().toISOString();
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?id=eq.${encodeURIComponent(ownerUserId)}&select=*&limit=1`,
    { headers },
  );
  const profileRows = profileResponse.ok
    ? ((await profileResponse.json()) as Array<{
        id: string;
        full_name: string;
        email: string;
        phone_number: string;
        business_cluster?: string | null;
        river_park_verified?: boolean | null;
      }>)
    : [];
  const profile = profileRows[0];

  if (!profile) {
    throw new Error('Seller profile was not found.');
  }

  await fetch(`${supabaseUrl}/rest/v1/app_users?id=eq.${encodeURIComponent(ownerUserId)}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      business_name: businessName,
      updated_at: updatedAt,
    }),
  });

  const ownerProfileResponse = await fetch(
    `${supabaseUrl}/rest/v1/owner_business_profiles?owner_user_id=eq.${encodeURIComponent(
      ownerUserId,
    )}&select=id&limit=1`,
    { headers },
  );
  const ownerProfileRows = ownerProfileResponse.ok
    ? ((await ownerProfileResponse.json()) as Array<{ id: string }>)
    : [];
  const ownerProfileId = ownerProfileRows[0]?.id;

  if (ownerProfileId) {
    await fetch(
      `${supabaseUrl}/rest/v1/owner_business_profiles?id=eq.${encodeURIComponent(ownerProfileId)}`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          owner_name: businessName,
          updated_at: updatedAt,
        }),
      },
    );
    return;
  }

  await fetch(`${supabaseUrl}/rest/v1/owner_business_profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: ownerUserId,
      owner_user_id: ownerUserId,
      account_name: profile.full_name || businessName,
      account_email: profile.email,
      owner_name: businessName,
      phone: profile.phone_number || '',
      whatsapp: profile.phone_number || '',
      email: profile.email,
      address: profile.business_cluster || '',
      cover_image: null,
      gallery_images: null,
      gallery_videos: null,
      river_park_verified: profile.river_park_verified ?? true,
      updated_at: updatedAt,
    }),
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let payload: RequestPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const ownerUserId = payload.ownerUserId?.trim() ?? '';
  const cacNumber = payload.cacNumber?.trim().toUpperCase() ?? '';

  if (!ownerUserId || !/^[A-Z0-9/-]{4,24}$/.test(cacNumber)) {
    return jsonResponse({ error: 'Enter a valid CAC business number.' }, 400);
  }

  const requesterId = await authenticatedUserId(request);

  if (requesterId !== ownerUserId) {
    return jsonResponse({ error: 'You can only verify your own business CAC number.' }, 403);
  }

  const apiCredential = normalizeCredential(
    Deno.env.get('CAC_API_KEY') ?? Deno.env.get('CAC_API_TOKEN'),
  );
  const endpoint =
    Deno.env.get('CAC_API_VERIFICATION_URL')?.trim() ??
    Deno.env.get('CAC_API_URL')?.trim() ??
    'https://vasapp.cac.gov.ng/api/vas/validation/company';
  const isCacVasValidationEndpoint = endpoint.includes('vasapp.cac.gov.ng/api/vas/validation');
  const isCacVasCompanyEndpoint = endpoint.includes('api/vas/validation/company');
  const configuredMethod = Deno.env.get('CAC_API_METHOD')?.trim().toUpperCase();
  const authHeaderName =
    Deno.env.get('CAC_API_AUTH_HEADER')?.trim() ||
    (isCacVasValidationEndpoint ? 'X_API_KEY' : 'Authorization');
  const authScheme =
    Deno.env.get('CAC_API_AUTH_SCHEME')?.trim() ||
    (authHeaderName.toLowerCase() === 'authorization' ? 'Bearer' : 'none');
  const basicUsername = Deno.env.get('CAC_API_USERNAME')?.trim();
  const basicPassword = Deno.env.get('CAC_API_PASSWORD')?.trim();
  const configuredNumberField =
    Deno.env.get('CAC_API_NUMBER_FIELD')?.trim() ||
    (isCacVasCompanyEndpoint ? 'rc_number' : undefined);
  const configuredNumberParam =
    Deno.env.get('CAC_API_NUMBER_PARAM')?.trim() ||
    configuredNumberField ||
    (isCacVasCompanyEndpoint ? 'rc_number' : 'registration_number');
  const configuredEntityType = Deno.env.get('CAC_API_ENTITY_TYPE')?.trim().toUpperCase();
  const configuredBusinessNameField = Deno.env.get('CAC_API_BUSINESS_NAME_FIELD')?.trim();
  const extraProviderBody = parseExtraBody(Deno.env.get('CAC_API_EXTRA_BODY_JSON'));
  const method = configuredMethod === 'GET' ? 'GET' : 'POST';

  if (!apiCredential && !(basicUsername && basicPassword)) {
    return jsonResponse(
      {
        error:
          'CAC API credentials are not configured. Log in to CAC VAS, copy or generate your VAS API key, then set CAC_API_KEY or CAC_API_TOKEN in Supabase secrets. The CAC VAS documentation uses the X_API_KEY header for validation requests.',
      },
      500,
    );
  }

  if (!endpoint) {
    return jsonResponse(
      {
        error:
          'CAC API verification endpoint is not configured. Add CAC_API_VERIFICATION_URL from your CAC API credentials.',
      },
      501,
    );
  }

  const providerUrl = endpoint.includes('{cacNumber}')
    ? endpoint.replace(/\{cacNumber\}/g, encodeURIComponent(cacNumber))
    : method === 'GET'
      ? appendQueryParam(endpoint, configuredNumberParam, normalizeCacNumberForProvider(cacNumber))
    : endpoint;
  const providerNumber = normalizeCacNumberForProvider(cacNumber);
  const entityType = configuredEntityType || inferCacEntityType(cacNumber);
  const providerHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (basicUsername && basicPassword) {
    providerHeaders.Authorization = `Basic ${btoa(`${basicUsername}:${basicPassword}`)}`;
  } else if (apiCredential) {
    if (authHeaderName.toLowerCase() === 'authorization') {
      providerHeaders.Authorization =
        authScheme.toLowerCase() === 'none'
          ? apiCredential
          : `${authScheme} ${apiCredential}`;
    } else {
      providerHeaders[authHeaderName] = apiCredential;
    }
  }

  const providerBody: JsonRecord = configuredNumberField
    ? {
        [configuredNumberField]: providerNumber,
        ...(isCacVasCompanyEndpoint
          ? {
              entity_type: entityType,
            }
          : {
              country: 'NG',
            }),
        ...extraProviderBody,
      }
    : {
        cac_number: providerNumber,
        cacNumber: providerNumber,
        rc_number: providerNumber,
        rcNumber: providerNumber,
        bn_number: providerNumber,
        bnNumber: providerNumber,
        registration_number: providerNumber,
        registrationNumber: providerNumber,
        company_registration_number: providerNumber,
        companyRegistrationNumber: providerNumber,
        search_term: providerNumber,
        searchTerm: providerNumber,
        number: providerNumber,
        value: providerNumber,
        query: providerNumber,
        country: 'NG',
        ...extraProviderBody,
      };

  let providerResponse = await fetch(providerUrl, {
    method,
    headers: providerHeaders,
    ...(method === 'GET'
      ? {}
      : {
          body: JSON.stringify(providerBody),
        }),
  });
  let providerPayload = await readJson(providerResponse);

  if (
    providerResponse.status === 401 &&
    isCacVasValidationEndpoint &&
    apiCredential &&
    !('X_API_KEY' in providerHeaders)
  ) {
    const retryUrl = endpoint.includes('{cacNumber}')
      ? endpoint.replace(/\{cacNumber\}/g, encodeURIComponent(providerNumber))
      : endpoint;

    providerResponse = await fetch(retryUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        X_API_KEY: apiCredential,
      },
      body: JSON.stringify(providerBody),
    });
    providerPayload = await readJson(providerResponse);
  }

  if (!providerResponse.ok) {
    const providerError = payloadMessage(providerPayload, '');

    return jsonResponse(
      {
        error: providerError
          ? `CAC API rejected the verification request: ${providerError}`
          : providerResponse.status === 401
            ? 'CAC API rejected the verification request with status 401. The CAC VAS documentation uses POST, X_API_KEY, rc_number, and entity_type for the company validation request. Check that CAC_API_KEY is the VAS API key, not your portal password or an expired login token.'
            : `CAC API rejected the verification request with status ${providerResponse.status}. Check CAC_API_VERIFICATION_URL, CAC_API_METHOD, CAC_API_AUTH_HEADER, CAC_API_AUTH_SCHEME, CAC_API_NUMBER_FIELD or CAC_API_NUMBER_PARAM, and CAC_API_ENTITY_TYPE.`,
      },
      providerResponse.status >= 400 ? providerResponse.status : 502,
    );
  }

  const businessNameKeys = [
    ...(configuredBusinessNameField ? [configuredBusinessNameField] : []),
    'business_name',
    'businessName',
    'company_name',
    'companyName',
    'registered_name',
    'registeredName',
    'account_name',
    'accountName',
    'name',
  ];
  const businessName = findProviderString(providerPayload, businessNameKeys);

  if (!businessName) {
    return jsonResponse(
      { error: 'CAC API did not return the registered business name.' },
      502,
    );
  }

  const verifiedAt = new Date().toISOString();

  try {
    await updateSellerBusinessName(ownerUserId, businessName);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The CAC was verified, but the seller profile could not be updated.',
      },
      502,
    );
  }

  return jsonResponse({
    status: 'verified',
    business: {
      cacNumber,
      businessName,
      verifiedAt,
    },
  });
});

export {};
