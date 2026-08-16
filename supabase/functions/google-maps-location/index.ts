declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

export {};

type LocationRequest = {
  action?: 'autocomplete' | 'placeDetails' | 'reverseGeocode';
  input?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VIEW2CONNECT_WEB_ORIGIN')?.trim() || 'https://www.view2connect.ng',
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

function normalizeSecret(value?: string) {
  return value
    ?.trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\s*=\s*/i, '')
    .replace(/^GOOGLE_MAPS_API_KEY\s*=\s*/i, '')
    .trim();
}

async function parseJson(response: Response) {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { error_message: text };
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = normalizeSecret(
    Deno.env.get('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY'),
  );

  if (!apiKey) {
    return jsonResponse(
      {
        error:
          'Google Maps API key is not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to Supabase secrets.',
      },
      500,
    );
  }

  const body = await request.json().catch(() => null) as LocationRequest | null;

  if (!body?.action) {
    return jsonResponse({ error: 'Choose a location action.' }, 400);
  }

  let googleUrl: URL;

  if (body.action === 'autocomplete') {
    const input = body.input?.trim() ?? '';

    if (!input || input.length < 3) {
      return jsonResponse({ status: 'ZERO_RESULTS', predictions: [] });
    }

    googleUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    googleUrl.searchParams.set('input', input);
    googleUrl.searchParams.set('types', 'geocode');
  } else if (body.action === 'placeDetails') {
    const placeId = body.placeId?.trim() ?? '';

    if (!placeId) {
      return jsonResponse({ error: 'Place id is required.' }, 400);
    }

    googleUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    googleUrl.searchParams.set('place_id', placeId);
    googleUrl.searchParams.set('fields', 'formatted_address,address_component,geometry,place_id');
  } else if (body.action === 'reverseGeocode') {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return jsonResponse({ error: 'Valid latitude and longitude are required.' }, 400);
    }

    googleUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    googleUrl.searchParams.set('latlng', `${latitude},${longitude}`);
  } else {
    return jsonResponse({ error: 'Unsupported location action.' }, 400);
  }

  googleUrl.searchParams.set('key', apiKey);

  const googleResponse = await fetch(googleUrl.toString());
  const payload = await parseJson(googleResponse);

  return jsonResponse(payload, googleResponse.ok ? 200 : googleResponse.status);
});
