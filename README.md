# View2Connect

View2Connect is an Expo, React Native, web, Electron, and Supabase marketplace for customers,
store owners, and dispatch riders. Each account role has an isolated sign-in context, route guard,
profile domain, navigation model, and operational data.

## Version 1 flows

- Customer: browse approved stores and adverts, manage a synchronized cart, select a HERE delivery
  location, pay with Flutterwave, message sellers, and track orders.
- Store owner: manage the store profile and catalog, verify a payout account, receive paid orders,
  mark orders ready, and request withdrawals from delivered earnings.
- Dispatch: create or access a dispatch-only account, manage a rider profile, accept available
  delivery jobs, and update pickup and arrival progress.
- Admin: role-separated staff access, PIN-authorized sensitive actions, listing/store moderation,
  order/refund operations, catalog management, configurable plans/fees, and audit logs.

Supabase is the production source of truth. Persistent device storage is a local cache and an
explicit local-test fallback; production writes use RLS-protected tables, RPCs, or authenticated
Edge Functions.

## Local setup

```powershell
npm install
Copy-Item .env.example .env
npm run typecheck
npm run test:unit
npm run web
```

For isolated fixture testing without Supabase:

```powershell
$env:EXPO_PUBLIC_URBANCONNECT_LOCAL_TEST_MODE='true'
$env:EXPO_PUBLIC_LOCAL_TEST_PASSWORD='choose-a-local-password'
npm run web
```

Never enable local-test mode in a production build.

## Production configuration

Public Expo/Vercel variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_HERE_API_KEY`

Supabase Edge Function secrets:

- `ACCOUNT_SIGNUP_OTP_SECRET`
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`
- `VIEW2CONNECT_WEB_ORIGIN=https://www.view2connect.ng`
- `VIEW2CONNECT_SITE_URL=https://www.view2connect.ng`
- `FLUTTERWAVE_REDIRECT_URL=https://www.view2connect.ng/payments/flutterwave/return`
- `PASSWORD_RESET_REDIRECT_URL=https://www.view2connect.ng/auth/recovery`
- `CAC_VAS_BASE_URL` and `CAC_VAS_API_KEY` when CAC validation is enabled

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed
Edge Functions. Do not expose server secrets through `EXPO_PUBLIC_*` variables.

## Verification and builds

```powershell
npm run test
npm run export:web
npm run desktop:build:win
```

The Windows installer is generated at `release/View2Connect-Seller-Portal-Setup.exe`. The desktop
runtime opens the View2Connect animation, then the existing seller sign-in screen, at 90% zoom.

Deployment order and smoke tests are in `docs/V1_RELEASE_CHECKLIST.md`.
