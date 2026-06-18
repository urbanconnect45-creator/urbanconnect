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

## Demo accounts

- Resident: `resident@urbanconnect.com` / `password123`
- Business owner: `owner@urbanconnect.com` / `password123`

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

For web:

```bash
npm run web
```

## Secure admin panel

Set an admin token before sharing the web build:

```bash
EXPO_PUBLIC_ADMIN_ACCESS_TOKEN=replace-with-a-long-random-token
```

Then open the web app with:

```text
/?admin=1&token=replace-with-a-long-random-token
```

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
