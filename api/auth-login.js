function normalizeSupabaseUrl(value) {
  const candidate = String(value ?? '').trim();

  if (!candidate || /your-project-ref|myprojectid|your-project-id/i.test(candidate)) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    return new URL(withProtocol).toString().replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

function json(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    json(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const email = String(request.body?.email ?? '').trim().toLowerCase();
  const password = String(request.body?.password ?? '');

  if (!email || !email.includes('@') || password.length < 6) {
    json(response, 400, { error: 'Enter a valid email address and password.' });
    return;
  }

  const supabaseUrl = normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const publishableKey = String(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

  if (!supabaseUrl || !publishableKey) {
    json(response, 503, {
      error: 'Authentication is not configured. Contact View2Connect support.',
    });
    return;
  }

  try {
    const supabaseResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      },
    );
    const text = await supabaseResponse.text();
    let payload;

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: 'Authentication service returned an invalid response.' };
    }

    json(response, supabaseResponse.status, payload);
  } catch {
    json(response, 503, {
      error: 'The login service is temporarily unavailable. Please try again.',
    });
  }
}
