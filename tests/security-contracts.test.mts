import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('checkout and payment settlement remain server authoritative', () => {
  const orderMigration = source(
    'supabase/migrations/20260815123000_financial_ledger_and_server_orders.sql',
  );
  const checkoutFunction = source('supabase/functions/create-flutterwave-checkout/index.ts');
  const webhook = source('supabase/functions/flutterwave-webhook/index.ts');

  assert.match(orderMigration, /create_marketplace_order\([\s\S]*for share;/i);
  assert.match(orderMigration, /product\.price \* quantity/i);
  assert.match(orderMigration, /finalize_paid_order[\s\S]*for update;/i);
  assert.match(checkoutFunction, /total_amount/i);
  assert.match(webhook, /FLUTTERWAVE_WEBHOOK_SECRET_HASH/);
  assert.match(webhook, /finalize_paid_order/);
});

test('seller payout cannot be marked paid by an authenticated admin client', () => {
  const migration = source(
    'supabase/migrations/20260821120000_provider_confirmed_seller_payouts.sql',
  );
  const payoutFunction = source(
    'supabase/functions/process-flutterwave-withdrawal/index.ts',
  );
  const webhook = source('supabase/functions/flutterwave-webhook/index.ts');
  const adminScreen = source('src/screens/AdminPanelScreen.tsx');

  assert.match(migration, /Paid status requires Flutterwave confirmation/);
  assert.match(
    migration,
    /finalize_flutterwave_withdrawal[\s\S]*auth\.role\(\) <> 'service_role'/i,
  );
  assert.match(migration, /round\(target_amount, 2\) <> round\(existing\.amount, 2\)/i);
  assert.match(payoutFunction, /api\.flutterwave\.com\/v3\/transfers/);
  assert.match(payoutFunction, /consume_edge_rate_limit/);
  assert.match(payoutFunction, /status=in\.\(pending,failed\)/);
  assert.match(payoutFunction, /provider_status: 'initiating'/);
  assert.match(webhook, /handleTransferCompleted/);
  assert.match(webhook, /target_currency: optionalString\(data\.currency\)/);
  assert.doesNotMatch(adminScreen, /Payout provider reference/);
  assert.doesNotMatch(adminScreen, /label="Mark paid"/);
});

test('privileged payout functions are not executable by anon or authenticated', () => {
  const migration = source(
    'supabase/migrations/20260821120000_provider_confirmed_seller_payouts.sql',
  );

  assert.match(
    migration,
    /revoke all on function public\.finalize_flutterwave_withdrawal[\s\S]*from public, anon, authenticated;/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.finalize_flutterwave_withdrawal[\s\S]*to service_role;/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.fail_flutterwave_withdrawal[\s\S]*from public, anon, authenticated;/i,
  );
});

test('message attachments use private storage and participant-scoped reads', () => {
  const migration = source(
    'supabase/migrations/20260821130000_private_message_attachments.sql',
  );
  const api = source('src/services/supabaseApi.ts');

  assert.match(migration, /'urbanconnect-message-attachments'[\s\S]*false/i);
  assert.match(migration, /listing_messages message[\s\S]*recipient_user_id = auth\.uid\(\)::text/i);
  assert.match(migration, /support_messages message[\s\S]*message\.user_id = auth\.uid\(\)::text/i);
  assert.match(api, /messageAttachmentBucket = 'urbanconnect-message-attachments'/);
  assert.match(api, /createMessageAttachmentSignedUrl/);
  assert.doesNotMatch(
    api,
    /uploadChatAttachmentToSupabaseStorage[\s\S]{0,900}uploadMediaUriToSupabaseStorage\(/,
  );
});

test('self-service account deletion removes auth only after server-side anonymization', () => {
  const migration = source('supabase/migrations/20260821140000_account_deletion.sql');
  const accountFunction = source('supabase/functions/delete-user-account/index.ts');

  assert.match(migration, /auth\.role\(\) <> 'service_role'/i);
  assert.match(migration, /status = 'archived'[\s\S]*where owner_user_id = target_user_id::text/i);
  assert.match(migration, /payout_account_number = null/i);
  assert.match(
    migration,
    /revoke all on function public\.anonymize_user_account_for_deletion\(uuid\)[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(accountFunction, /rpc\/anonymize_user_account_for_deletion/);
  assert.match(accountFunction, /auth\/v1\/admin\/users\/\$\{authUser\.id\}/);
  assert.ok(
    accountFunction.indexOf('rpc/anonymize_user_account_for_deletion') <
      accountFunction.indexOf('auth/v1/admin/users/${authUser.id}'),
  );
});
