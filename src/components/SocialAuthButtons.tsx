import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { isUrbanConnectLocalTestMode } from '../config/runtime';
import { useAuth } from '../hooks/useAuth';
import {
  getSupabaseNativeOAuthCallbackUrl,
  getSupabaseOAuthUrl,
  isSupabaseConfigured,
} from '../services/supabaseApi';
import type { AppColors } from '../theme';
import { spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type SocialProvider = 'google';

type SocialAuthButtonsProps = {
  compact?: boolean;
  webRedirectPath?: string;
};

const providers: {
  id: SocialProvider;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'google', label: 'Google', icon: 'logo-google' },
];

WebBrowser.maybeCompleteAuthSession();

export function SocialAuthButtons({ compact = false, webRedirectPath }: SocialAuthButtonsProps = {}) {
  const { beginSocialSignIn, completeSocialSignIn } = useAuth();
  const { colors, isDarkMode } = useAppTheme();
  const styles = createStyles(colors, isDarkMode, compact);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    void WebBrowser.warmUpAsync().catch(() => undefined);

    return () => {
      void WebBrowser.coolDownAsync().catch(() => undefined);
    };
  }, []);

  const openProvider = async (provider: SocialProvider) => {
    if (isUrbanConnectLocalTestMode) {
      Alert.alert(
        'Local test mode',
        'Google sign-in is disabled while Supabase calls are turned off.',
      );
      return;
    }

    if (!isSupabaseConfigured) {
      Alert.alert('Supabase not configured', 'Add your Supabase URL and publishable key first.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(getSupabaseOAuthUrl(provider, webRedirectPath));
        return;
      }

      const redirectUrl = getSupabaseNativeOAuthCallbackUrl();
      const authUrl = getSupabaseOAuthUrl(provider, webRedirectPath, { redirectTo: redirectUrl });
      beginSocialSignIn(webRedirectPath);
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
        {
          createTask: false,
          showInRecents: false,
          showTitle: false,
          toolbarColor: '#5B2BCB',
        },
      );

      if (result.type === 'success') {
        const handled = await completeSocialSignIn(result.url);

        if (handled) {
          return;
        }

        throw new Error('Google returned without a usable View2Connect login token.');
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      throw new Error('Google sign-in did not finish. Please try again.');
    } catch (error) {
      Alert.alert(
        'Social login unavailable',
        error instanceof Error
          ? error.message
          : 'Enable this provider in Supabase Auth, then try again.',
      );
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or sign in with</Text>
        <View style={styles.divider} />
      </View>
      <View style={styles.buttonRow}>
        {providers.map((provider) => (
          <Pressable
            accessibilityRole="button"
            key={provider.id}
            onPress={() => void openProvider(provider.id)}
            style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}
          >
            <Ionicons color={isDarkMode ? '#211B2E' : colors.text} name={provider.icon} size={20} />
            <Text style={styles.socialButtonText}>{provider.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors, isDarkMode: boolean, compact: boolean) {
  return StyleSheet.create({
    wrapper: {
      gap: compact ? spacing.sm : spacing.md,
    },
    dividerRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    socialButton: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minWidth: 132,
      minHeight: compact ? 46 : 52,
      flexDirection: 'row',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#D8D2E1' : colors.border,
      backgroundColor: isDarkMode ? '#FAF8FD' : colors.surface,
      paddingHorizontal: spacing.md,
    },
    socialButtonPressed: {
      opacity: 0.9,
      transform: [{ translateY: 1 }],
    },
    socialButtonText: {
      ...typography.bodyStrong,
      color: isDarkMode ? '#211B2E' : colors.text,
    },
  });
}
