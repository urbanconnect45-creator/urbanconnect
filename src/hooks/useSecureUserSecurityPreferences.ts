import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { UserSecurityPreference } from '../types/auth';

const preferencesStorageKey = 'view2connect.userSecurityPreferences.v2';

function isPreferenceMap(value: unknown): value is Record<string, UserSecurityPreference> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function useSecureUserSecurityPreferences() {
  const [preferences, setPreferences] = useState<Record<string, UserSecurityPreference>>({});
  const [isHydrated, setIsHydrated] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isCancelled = false;
    SecureStore.getItemAsync(preferencesStorageKey)
      .then((storedValue) => {
        if (isCancelled || !storedValue) {
          return;
        }

        try {
          const parsed = JSON.parse(storedValue) as unknown;
          if (isPreferenceMap(parsed)) {
            setPreferences(parsed);
          }
        } catch {
          void SecureStore.deleteItemAsync(preferencesStorageKey);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !isHydrated) {
      return;
    }

    const serialized = JSON.stringify(preferences);
    void SecureStore.setItemAsync(preferencesStorageKey, serialized).catch(() => undefined);
  }, [isHydrated, preferences]);

  return [preferences, setPreferences] as const;
}
