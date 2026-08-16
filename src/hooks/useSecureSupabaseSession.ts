import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { SupabaseSession } from '../services/supabaseApi';

const sessionStorageKey = 'view2connect.supabaseSession.v2';

function isStoredSession(value: unknown): value is SupabaseSession {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { accessToken?: unknown }).accessToken === 'string',
  );
}

export function useSecureSupabaseSession() {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isCancelled = false;

    SecureStore.getItemAsync(sessionStorageKey)
      .then((storedValue) => {
        if (isCancelled || !storedValue) {
          return;
        }

        try {
          const parsed = JSON.parse(storedValue) as unknown;
          if (isStoredSession(parsed)) {
            setSession(parsed);
          }
        } catch {
          void SecureStore.deleteItemAsync(sessionStorageKey);
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

    const operation = session
      ? SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(session))
      : SecureStore.deleteItemAsync(sessionStorageKey);

    void operation.catch(() => {
      // Continue with the in-memory session if encrypted device storage is unavailable.
    });
  }, [isHydrated, session]);

  return [session, setSession, isHydrated] as const;
}
