import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type CompletePayload = {
  email?: string;
  code?: string;
  password?: string;
  sellerType?: 'individual' | 'store';
  selectedPlan?: 'free' | 'gold';
  ownerName?: string;
  businessName?: string;
  phone?: string;
  businessType?: string;
  area?: string;
  address?: string;
  cacNumber?: string;
  posSystem?: string;
  catalogStatus?: string;
  notes?: string;
};

type AuthUser = {
  id: string;
  email?: string;
};

type AppUserRow = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number: string;
  estate_id: string;
  created_at: string;
  role?: string;
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

function optionalText(value?: string) {
  const text = value?.trim();
  return text || null;
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || 'View2Connect';
  const lastName = parts.join(' ') || 'Seller';

  return { firstName, lastName };
}

async function hashCode(email: string, code: string, secret: string) {
  const bytes = new TextEncoder().encode(`${email}:${code}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Seller registration is not configured.' }, 500);
  }

  let payload: CompletePayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const email = payload.email?.trim().toLowerCase() ?? '';
  const code = payload.code?.replace(/\D/g, '') ?? '';
  const password = payload.password ?? '';
  const ownerName = payload.ownerName?.trim() ?? '';
  const businessName = payload.businessName?.trim() ?? '';
  const phone = payload.phone?.trim() ?? '';
  const sellerType = payload.sellerType;
  const selectedPlan = payload.selectedPlan;
  const area = payload.area?.trim() ?? '';
  const address = payload.address?.trim() ?? '';
  const notes = payload.notes?.trim() ?? '';

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^\d{8}$/.test(code) ||
    password.length < 8 ||
    !ownerName ||
    !businessName ||
    !phone ||
    !area ||
    !address ||
    !notes ||
    (sellerType !== 'individual' && sellerType !== 'store') ||
    (selectedPlan !== 'free' && selectedPlan !== 'gold')
  ) {
    return jsonResponse({ error: 'Complete all registration fields and enter the 8-digit code.' }, 400);
  }

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const verificationResponse = await fetch(
    `${supabaseUrl}/rest/v1/seller_signup_verifications?select=*&email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: serviceHeaders },
  );
  const verificationRows = verificationResponse.ok
    ? ((await verificationResponse.json()) as Array<{
        code_hash: string;
        expires_at: string;
        attempts: number;
      }>)
    : [];
  const verification = verificationRows[0];

  if (!verification) {
    return jsonResponse({ error: 'Request a new verification code.' }, 400);
  }

  if (new Date(verification.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: 'This verification code has expired. Request a new one.' }, 400);
  }

  if ((verification.attempts ?? 0) >= 5) {
    return jsonResponse({ error: 'Too many incorrect attempts. Request a new code.' }, 429);
  }

  const expectedHash = await hashCode(email, code, serviceRoleKey);

  if (expectedHash !== verification.code_hash) {
    await fetch(
      `${supabaseUrl}/rest/v1/seller_signup_verifications?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          ...serviceHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ attempts: (verification.attempts ?? 0) + 1 }),
      },
    ).catch(() => undefined);

    return jsonResponse({ error: 'The verification code is incorrect.' }, 400);
  }

  const usersResponse = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: serviceHeaders },
  );
  const usersPayload = (await readJson(usersResponse)) as { users?: AuthUser[] };
  const authUserWithEmail = usersPayload.users?.find(
    (user) => user.email?.trim().toLowerCase() === email,
  );
  const existingProfileResponse = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=id,email,role&email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: serviceHeaders },
  );
  const existingProfiles = existingProfileResponse.ok
    ? ((await existingProfileResponse.json()) as AppUserRow[])
    : [];
  const existingProfile = existingProfiles[0];

  if (existingProfile || authUserWithEmail) {
    return jsonResponse(
      {
        error:
          'This email is already registered. Use a different email for the store owner account.',
      },
      409,
    );
  }

  const { firstName, lastName } = splitName(ownerName);
  const userMetadata = {
    first_name: firstName,
    last_name: lastName,
    full_name: ownerName,
    phone_number: phone,
    role: 'businessOwner',
    estate_id: 'river-park',
    business_name: businessName,
    business_cluster: area,
    accepted_user_agreement: true,
    seller_type: sellerType,
    selected_plan: selectedPlan,
  };
  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    }),
  });
  const createPayload = (await readJson(createResponse)) as AuthUser & { message?: string };

  if (!createResponse.ok || !createPayload.id) {
    return jsonResponse(
      { error: createPayload.message || 'Unable to create the verified account.' },
      502,
    );
  }

  const authUser = createPayload;
  const profileUserId = authUser.id;
  const profilePayload = {
    id: profileUserId,
    first_name: firstName,
    last_name: lastName,
    full_name: ownerName,
    email,
    phone_number: phone,
    password_hash: 'supabase-auth-managed',
    role: 'businessOwner',
    estate_id: 'river-park',
    business_name: businessName,
    business_cluster: area,
    river_park_verified: true,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/app_users?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...serviceHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(profilePayload),
  });

  if (!profileResponse.ok) {
    const profileError = await readJson(profileResponse);
    return jsonResponse(
      { error: String((profileError as { message?: string }).message || 'Unable to save the seller profile.') },
      502,
    );
  }

  const isFreePlan = selectedPlan === 'free';
  const planAmount = isFreePlan ? 0 : sellerType === 'store' ? 15000 : 5000;
  const freePlanEndsAt = new Date(Date.now() + 90 * 86400000).toISOString();
  const profileId = profileUserId;
  const ownerProfileResponse = await fetch(
    `${supabaseUrl}/rest/v1/owner_business_profiles?on_conflict=id`,
    {
      method: 'POST',
      headers: {
        ...serviceHeaders,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: profileId,
        owner_user_id: profileUserId,
        account_name: ownerName,
        account_email: email,
        owner_name: ownerName,
        phone,
        whatsapp: phone,
        email,
        address,
        subscription_cycle: 'monthly',
        subscription_status: isFreePlan ? 'active' : 'pending',
        verified_amount: 0,
        subscription_next_billing_at: isFreePlan ? freePlanEndsAt : null,
        subscription_item_count: 1,
        river_park_verified: true,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!ownerProfileResponse.ok) {
    return jsonResponse({ error: 'Unable to save the business profile.' }, 502);
  }

  const applicationId = crypto.randomUUID();
  const applicationResponse = await fetch(`${supabaseUrl}/rest/v1/seller_applications`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      id: applicationId,
      auth_user_id: authUser.id,
      profile_user_id: profileUserId,
      email,
      owner_name: ownerName,
      phone,
      seller_type: sellerType,
      business_name: businessName,
      business_type: optionalText(payload.businessType),
      area,
      address,
      cac_number: optionalText(payload.cacNumber),
      pos_system: optionalText(payload.posSystem),
      catalog_status: optionalText(payload.catalogStatus),
      notes,
      selected_plan: selectedPlan,
      plan_amount: planAmount,
      status: 'pending',
    }),
  });

  if (!applicationResponse.ok) {
    return jsonResponse({ error: 'Unable to save the seller application.' }, 502);
  }

  const createdAt = new Date().toISOString();
  const welcomeTitle = 'Welcome to View2Connect Seller';
  const planLabel = isFreePlan
    ? 'Free Plan for 3 months with standard placement'
    : `Gold Plan application (${sellerType === 'store' ? 'NGN 15,000' : 'NGN 5,000'})`;
  const welcomeBody = `Your store owner email is verified and your seller dashboard is ready. You selected the ${planLabel}. Product and listing approval remain separate before items become public. Use this dedicated store owner account for the seller dashboard.`;

  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: `notification-seller-welcome-${applicationId}`,
        user_id: profileUserId,
        user_name: ownerName,
        audience: 'businessOwner',
        title: welcomeTitle,
        body: welcomeBody,
        context_type: 'general',
        context_id: applicationId,
        created_at: createdAt,
      }),
    }),
    fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: `audit-seller-registration-${applicationId}`,
        actor_name: ownerName,
        actor_role: 'system',
        action: 'Seller account verified',
        details: `${businessName} selected the ${selectedPlan} plan and can access the seller dashboard. Listing approval remains separate.`,
        created_at: createdAt,
      }),
    }),
    fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: `seller-welcome-${applicationId}`,
        recipientName: ownerName,
        recipientEmail: email,
        subject: welcomeTitle,
        body: welcomeBody,
      }),
    }),
  ]).catch(() => undefined);

  await fetch(
    `${supabaseUrl}/rest/v1/seller_signup_verifications?email=eq.${encodeURIComponent(email)}`,
    { method: 'DELETE', headers: serviceHeaders },
  ).catch(() => undefined);

  return jsonResponse({
    status: 'created',
    applicationId,
    email,
    profileUserId,
    selectedPlan,
  });
});
