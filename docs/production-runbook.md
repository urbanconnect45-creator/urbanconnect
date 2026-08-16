# View2Connect Production Runbook

Production changes require the correct Supabase project reference and a verified backup. Never infer the project reference from an old URL.

## Preflight

```powershell
npm ci
npm test
npm run export:web
npx supabase projects list
npx supabase link --project-ref <confirmed-project-ref>
npx supabase migration list --linked
```

Compare the linked project URL with `EXPO_PUBLIC_SUPABASE_URL` in local, Vercel, and EAS environments before continuing.

## Backup

```powershell
New-Item -ItemType Directory -Force backups
npx supabase db dump --linked --schema public,auth,storage --file backups/predeploy-schema.sql
npx supabase db dump --linked --data-only --use-copy --file backups/predeploy-data.sql
Get-FileHash backups/predeploy-schema.sql -Algorithm SHA256
Get-FileHash backups/predeploy-data.sql -Algorithm SHA256
```

Copy both files to encrypted storage, verify they are non-empty, and record both hashes. Restore the dump into a separate test database before production migration approval.

## Local Migration Test

```powershell
npx supabase start
npx supabase db reset --local
npx supabase db lint --local --level warning
npm test
```

## Staged Deployment

```powershell
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase functions deploy --project-ref <confirmed-project-ref>
npm run export:web
npx vercel --prod
npx eas-cli build --platform android --profile production
npm run desktop:build:win
```

Do not deploy all Edge Functions if environment secrets have not been verified. Set secret values through the provider dashboards or `supabase secrets set`; never place values in source control.

## Rollback

Database migrations in this repository are forward-only. If validation fails before writes begin, add a reviewed compensating migration. If production data is damaged, stop writes, create an incident snapshot, and restore the verified backup into a new project/database before changing application endpoints. Do not run destructive rollback SQL against the only production copy.

Application rollback uses the previously verified Vercel deployment, EAS release, and Windows installer artifact. Keep at least one known-good artifact for every production release.
