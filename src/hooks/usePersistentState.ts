import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'localStorage' in window;
}

function readStoredValue<T>(key: string, initialValue: T) {
  if (!canUseWebStorage()) {
    return initialValue;
  }

  try {
    const storedValue = window.localStorage.getItem(key);

    if (!storedValue) {
      return initialValue;
    }

    return JSON.parse(storedValue) as T;
  } catch {
    return initialValue;
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, initialValue));
  const [isNativeValueLoaded, setIsNativeValueLoaded] = useState(() => canUseWebStorage());

  useEffect(() => {
    if (canUseWebStorage()) {
      setIsNativeValueLoaded(true);
      return;
    }

    let isMounted = true;

    AsyncStorage.getItem(key)
      .then((storedValue) => {
        if (!isMounted || !storedValue) {
          return;
        }

        setValue(JSON.parse(storedValue) as T);
      })
      .catch(() => {
        // Ignore storage read failures so the app can still boot with defaults.
      })
      .finally(() => {
        if (isMounted) {
          setIsNativeValueLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [key]);

  useEffect(() => {
    if (!canUseWebStorage()) {
      if (!isNativeValueLoaded) {
        return;
      }

      AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {
        // Ignore storage write failures so private or restricted storage does not break the UI.
      });
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage write failures so native and private browsing still work.
    }
  }, [isNativeValueLoaded, key, value]);

  return [value, setValue];
}
