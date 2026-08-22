# View2Connect V1 Release Checklist

## 1. Validate locally

```powershell
npm install
npm run typecheck
npm run test:unit
npm run export:web
```

Optional UI probes while a local-test web server is running on port 8097:

```powershell
node scripts/verify-auth-ui.mjs
node scripts/verify-customer-journey-ui.mjs
node scripts/verify-dispatch-ui.mjs
```

## 2. Apply Supabase changes

```powershell
npx.cmd supabase link --project-ref uyhudlqajzuzonntodqk
npx.cmd supabase db push --linked --include-all
npx.cmd supabase functions deploy --project-ref uyhudlqajzuzonntodqk
```

Set the Edge Function secrets listed in `README.md` before exercising OTP, payments, refunds,
notifications, CAC validation, or payout-account verification. Configure Flutterwave's webhook to:

`https://uyhudlqajzuzonntodqk.supabase.co/functions/v1/flutterwave-webhook`

Do not launch payment traffic until migration `20260816120000_v1_server_authority.sql` and the
configured Edge Functions have deployed successfully.

## 3. Deploy web

```powershell
npx.cmd vercel --prod
```

Confirm `/`, `/seller-portal/`, `/dispatch-login`, `/admin-portal`, `/auth/callback`,
`/auth/recovery`, `/privacy-policy/`, and `/payments/flutterwave/return` all return HTTP 200.

## 4. Build Windows seller portal

```powershell
npm run desktop:build:win
node scripts/verify-desktop-installer.mjs
```

Confirm the opening animation appears on every app start, the restored seller sign-in follows it,
the store-owner application action is absent, and the installer uses the View2Connect icon.

## 5. Android internal testing

```powershell
npx.cmd eas build --platform android --profile production
npx.cmd eas submit --platform android --profile internal --latest
```

Verify the remote EAS `versionCode` increased, existing internal testers can upgrade, Google OAuth
returns to the app, and the release remains on the Internal Testing track rather than production.

## 6. Role smoke tests

- Customer: OTP account creation, role-scoped password/Google sign-in, browse, cart, location,
  Flutterwave checkout, messages, and order tracking.
- Store owner: seller sign-in, profile/catalog persistence, payout verification, paid order receipt,
  seller-ready action, delivered balance, and withdrawal request.
- Dispatch: account creation, dispatch-only login, rider profile edit, job accept, pickup, arrival,
  buyer contact, and completion confirmation.
- Admin: PIN gate, store approval, seller/customer listing moderation, order status, refund,
  withdrawal review, staff management, settings, and audit log.
