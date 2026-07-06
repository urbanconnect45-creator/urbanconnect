import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { isUrbanConnectLocalTestMode } from '../config/runtime';
import { getSupabaseOAuthUrl, isSupabaseConfigured } from '../services/supabaseApi';
import type { AppColors } from '../theme';
import { radii, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type SocialProvider = 'google' | 'apple';

type SocialAuthButtonsProps = {
  webRedirectPath?: string;
};

const providers: {
  id: SocialProvider;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'google', label: 'Google', icon: 'logo-google' },
  { id: 'apple', label: 'Apple', icon: 'logo-apple' },
];

export function SocialAuthButtons({ webRedirectPath }: SocialAuthButtonsProps = {}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const openProvider = async (provider: SocialProvider) => {
    if (provider === 'apple') {
      Alert.alert('Coming soon', 'Apple sign-in is not connected yet.');
      return;
    }

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
      await Linking.openURL(getSupabaseOAuthUrl(provider, webRedirectPath));
    } catch {
      Alert.alert(
        'Social login unavailable',
        'Enable this provider in Supabase Auth, then try again.',
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
            <Ionicons color={colors.text} name={provider.icon} size={20} />
            <Text style={styles.socialButtonText}>{provider.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.md,
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
      minHeight: 52,
      flexDirection: 'row',
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
    },
    socialButtonPressed: {
      opacity: 0.9,
      transform: [{ translateY: 1 }],
    },
    socialButtonText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
  });
}
