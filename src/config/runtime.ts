type PublicEnvName =
  | 'EXPO_PUBLIC_ADMIN_ACCESS_TOKEN'
  | 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
  | 'EXPO_PUBLIC_HERE_API_KEY'
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  | 'EXPO_PUBLIC_URBANCONNECT_LOCAL_TEST_MODE';

export function readPublicEnv(name: PublicEnvName) {
  return typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)[name]
    : undefined;
}

function isEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

export const isUrbanConnectLocalTestMode = isEnabled(
  readPublicEnv('EXPO_PUBLIC_URBANCONNECT_LOCAL_TEST_MODE'),
);

export function getUrbanConnectStorageKey(key: string) {
  return isUrbanConnectLocalTestMode
    ? key.replace(/^urbanconnect\./, 'urbanconnect.localTest.')
    : key;
}
