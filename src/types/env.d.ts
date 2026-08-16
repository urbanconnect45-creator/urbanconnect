declare const process:
  | {
      env: {
        EXPO_PUBLIC_LOCAL_TEST_PASSWORD?: string;
        EXPO_PUBLIC_SUPABASE_URL?: string;
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
        EXPO_PUBLIC_URBANCONNECT_LOCAL_TEST_MODE?: string;
      };
    }
  | undefined;
