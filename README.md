# UrbanConnect

UrbanConnect is an Expo + React Native + TypeScript app for large estates. Residents can log in, browse local businesses, and contact service providers quickly. Business owners can sign up, log in, and create their own business profiles from inside the app.

## Current flow

- Login screen
- Signup screen with account type selection
- Resident marketplace dashboard
- Fixed-fee ride request flow with pinned pickup location
- Business owner registration flow
- Secure web-only admin control center
- Account screen with logout

## Tech stack

- Expo
- React Native
- TypeScript
- React Navigation

## Project structure

```text
.
├── App.tsx
├── app.config.ts
├── index.ts
├── package.json
└── src
    ├── components
    ├── data
    ├── hooks
    ├── navigation
    ├── screens
    ├── theme
    ├── types
    └── utils
```

## Run locally

```bash
npm install
npm run start
```

When the hosted Supabase project is restricted or you want to test without using live database/storage space, run local test mode:

```bash
npm run start:local
```

Local test mode disables Supabase reads/writes and keeps test accounts, listings, orders, wallet state, and admin changes under separate local storage keys. Use external image URLs while testing media-heavy listings so Supabase Storage space is not used.

Set a local-only password before starting test mode. Never set this variable in production builds:

```powershell
$env:EXPO_PUBLIC_LOCAL_TEST_PASSWORD='choose-a-local-password'
npm run start:local
```

The local fixture emails are defined in `src/data/localTestUsers.ts`. No fixed test password is committed.

Seller portal product import test file:

- `sample-data/seller-product-import.csv`

For web:

```bash
npm run web
```

For web local test mode:

```bash
npm run web:local
```

## Secure admin panel

Admin access uses Supabase Auth plus an active, linked `admin_users` record. Public environment variables are never used as admin credentials.

The admin panel includes:

- Dashboard cards for users, businesses, rides, payments, and categories
- Search and filters for users, businesses, ride requests, and payments
- CSV export for user, business, ride, and payment reports
- Create, edit, and delete category management
- Business verification/removal controls
- Ride and payment status updates

## Notes

- The app currently uses local app state, with web persistence via localStorage for auth, businesses, rides, payments, and admin categories.
- The secure admin route is implemented in the existing Expo web app so it can share the same operational data model as the mobile experience.
- The nested `my-app` folder is excluded from TypeScript checks so it does not interfere with this project.
