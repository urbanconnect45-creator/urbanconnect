declare const process:
  | {
      env: {
        EXPO_PUBLIC_ADMIN_ACCESS_TOKEN?: string;
        EXPO_PUBLIC_SUPABASE_URL?: string;
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
      };
    }
  | undefined;
