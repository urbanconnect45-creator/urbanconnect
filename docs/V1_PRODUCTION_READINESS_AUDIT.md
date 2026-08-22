# View2Connect V1 Production Readiness Audit

Audit date: 2026-08-21

## Decision

The repository is substantially hardened, but it is not approved for production traffic yet.
Local compilation, contract tests, Expo validation, and web export pass. Production approval is
blocked until the linked Supabase project is available, all migrations and Edge Functions are
deployed, role/RLS tests pass against that database, and payment/payout webhooks are exercised in
Flutterwave test mode. Vercel and Android releases must follow the backend deployment.

## Architecture and source of truth

| Surface | Authoritative source | Client responsibility |
| --- | --- | --- |
| Authentication and roles | Supabase Auth plus `app_users`/`admin_users` | Hold encrypted session, request role-specific login, route by returned role |
| Profiles and catalog | Supabase profile, `businesses`, and storage rows | Validate forms, upload media, refetch/merge current rows |
| Cart and delivery location | Supabase cart/location tables | Edit selection and synchronize on sign-in/refetch |
| Orders and fees | `create_marketplace_order` database function | Submit product IDs, quantities, location, and phone only |
| Payment settlement/refunds | Flutterwave webhook plus service-role functions | Open checkout and display authoritative status |
| Seller earnings/withdrawals | Wallet ledger plus provider-confirmed withdrawal functions | Request withdrawal; owner admin can initiate but cannot mark paid |
| Dispatch | `delivery_jobs`, orders, and `rider_profiles` | Display authorized queue and invoke state-transition functions |
| Messages | Message tables plus private attachment bucket | Upload private media and display temporary signed URLs |
| Admin controls | Server-side staff role, recent PIN authorization, audit logs | Request privileged actions and show returned errors |

Local persistent state is a cache or local-test fixture. It must not be treated as production
authority.

## Authorization matrix

| Resource/action | Customer | Store owner | Dispatch | Customer care | Owner admin |
| --- | --- | --- | --- | --- | --- |
| Customer shopping/cart/orders | Own | No | Delivery subset | Read/support scope | Administrative scope |
| Seller profile/catalog/orders | No | Own | Delivery subset | Moderation/support scope | Administrative scope |
| Dispatch queue/profile | Own-order visibility only | Own-order visibility only | Available/assigned jobs and own profile | Support scope | Administrative scope |
| Listing messages/files | Participant only | Participant only | No unrelated access | Staff support scope | Staff scope |
| Payout initiation | No | Request only | No | No | Start provider transfer after PIN |
| Payout paid state | No | No | No | No | No direct write; service-role provider confirmation only |
| Staff/security settings | No | No | No | Permission-limited | Owner only |

This matrix is represented in migrations and security-contract tests. It is not considered proven
until the migrations run on a clean database and authenticated role tests pass against Postgres.

## Evidence collected

- `npm test`: 14/14 tests pass, including server-authoritative checkout, provider-confirmed payout,
  private message storage, account deletion, fee calculations, role controls, and wallet totals.
- `npx expo-doctor`: 18/18 checks pass when Node uses the Windows system CA.
- `npm run export:web`: succeeds; 778 modules and 28 assets exported.
- Secret-pattern scan: no service keys, private keys, Flutterwave secret keys, Google API key
  patterns, or Supabase personal access tokens found in tracked project content.
- `git diff --check`: no whitespace errors.
- Production dependency audit: no critical vulnerabilities; 9 high and 11 moderate findings remain
  in Expo/Metro build tooling. npm requires a breaking Expo 57 upgrade to remove them.

## Readiness scores

Scores are evidence-based and are not raised to meet a target.

| Area | Score | Reason it is not higher |
| --- | ---: | --- |
| Security | 78/100 | Static controls are strong; remote RLS tests and Expo-chain high advisories remain |
| Reliability | 76/100 | Local tests pass; no live webhook exercise, crash reporting, or restore drill evidence |
| Data integrity | 80/100 | Server-authoritative order/ledger/payout design exists; clean migration run is unproven |
| Maintainability | 82/100 | TypeScript, tests, CI, runbooks; several very large hooks/screens remain expensive to change |
| Mobile readiness | 86/100 | Expo Doctor/export pass; production Android deep-link and older-device tests remain |
| Deployment readiness | 58/100 | Supabase is on hold and Vercel team authorization is unavailable; no current AAB rollout |

## Release blockers

1. Restore the linked Supabase project and take a verified encrypted backup.
2. Run a clean database reset in an environment with Docker, then apply every migration.
3. Deploy all configured Edge Functions and required secrets.
4. Execute authenticated customer, store-owner, dispatch, customer-care, and owner RLS tests.
5. Exercise Flutterwave checkout, webhook settlement, refund, bank resolution, transfer initiation,
   transfer webhook completion, and duplicate-event idempotency in test mode.
6. Resolve Vercel project/team authorization and deploy only after backend verification.
7. Schedule a tested Expo SDK 57 upgrade to clear remaining build-tool advisories.
8. Add production crash/error monitoring and prove alert delivery.
9. Build/submit Android internal testing after the backend is live, then verify OAuth deep links and
   upgrade compatibility on a production APK/AAB installation.

## Deployment order

Follow `docs/V1_RELEASE_CHECKLIST.md`. Do not deploy the current frontend ahead of migrations
`20260821120000_provider_confirmed_seller_payouts.sql`,
`20260821130000_private_message_attachments.sql`, and
`20260821140000_account_deletion.sql`, because the client now depends on those server contracts.
