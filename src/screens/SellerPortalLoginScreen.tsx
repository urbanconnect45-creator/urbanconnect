import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AuthPageBackground } from '../components/AuthPageBackground';
import { FormField } from '../components/FormField';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { useAuth } from '../hooks/useAuth';
import type { AppColors } from '../theme';
import { shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

const publicSiteUrl = 'https://www.view2connect.ng';

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export function SellerPortalLoginScreen() {
  const { signIn } = useAuth();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isMobileWeb = Platform.OS === 'web' && width < 900;

  const handleLogin = async () => {
    if (!isValidEmail(email.trim())) {
      setError('Use a valid store owner email address.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await signIn({ identifier: email.trim(), password, accountRole: 'businessOwner' });
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : 'Unable to sign in right now.';
      setError(message);
      Alert.alert('Login failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isMobileWeb) {
    return (
      <AuthPageBackground contentContainerStyle={styles.container}>
        <View style={styles.mobileBlockCard}>
          <View style={styles.heroIcon}>
            <Ionicons color={colors.white} name="laptop-outline" size={26} />
          </View>
          <Text style={styles.cardTitle}>Seller tools are desktop only</Text>
          <Text style={styles.subtitle}>
            Seller login and business registration are only available on laptop or desktop.
            Please use a larger screen to continue.
          </Text>
        </View>
      </AuthPageBackground>
    );
  }

  return (
    <AuthPageBackground contentContainerStyle={styles.container}>
      <View style={styles.shell}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons color={colors.white} name="storefront-outline" size={26} />
          </View>
          <Text style={styles.eyebrow}>Store owner portal</Text>
          <Text style={styles.title}>Manage products without the customer app nav.</Text>
          <Text style={styles.subtitle}>
            Sign in with the store owner account approved by View2Connect operations.
          </Text>
          <Pressable
            onPress={() => {
              const targetUrl = `${publicSiteUrl}/business-registration/`;
              if (Platform.OS === 'web') {
                const location = (globalThis as { location?: { href: string } }).location;
                if (location) {
                  location.href = '/business-registration/';
                  return;
                }
              }

              void Linking.openURL(targetUrl).catch(() => {
                Alert.alert(
                  'Open on the website',
                  'Store owner registration is available from view2connect.ng.',
                );
              });
            }}
            style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}
          >
            <Text style={styles.inlineLinkText}>Apply for a store owner account</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Store owner login</Text>
          <FormField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
            }}
            placeholder="seller@example.com"
            value={email}
          />
          <FormField
            label="Password"
            onChangeText={(value) => {
              setPassword(value);
              setError(null);
            }}
            placeholder="Enter password"
            secureTextEntry
            value={password}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AppButton label="Open dashboard" loading={isLoading} onPress={() => void handleLogin()} />
          <SocialAuthButtons webRedirectPath="/seller-portal/" />
        </View>
      </View>
    </AuthPageBackground>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.lg,
      paddingVertical: spacing.xxl,
    },
    shell: {
      width: '100%',
      maxWidth: 1060,
      alignSelf: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.78)',
      backgroundColor: 'rgba(248,247,251,0.97)',
      padding: spacing.md,
      overflow: 'hidden',
      ...shadows.card,
    },
    hero: {
      flex: 1.15,
      minWidth: 300,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      backgroundColor: colors.overlay,
      padding: spacing.xl,
    },
    heroIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 52,
      height: 52,
      borderRadius: 8,
      backgroundColor: colors.secondary,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: colors.accent,
    },
    title: {
      ...typography.title,
      color: colors.white,
    },
    subtitle: {
      ...typography.body,
      color: '#D6DFE2',
    },
    inlineLink: {
      alignSelf: 'flex-start',
      borderRadius: 8,
      backgroundColor: colors.white,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    inlineLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    pressed: {
      opacity: 0.88,
    },
    card: {
      flex: 0.85,
      minWidth: 300,
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      padding: spacing.lg,
    },
    mobileBlockCard: {
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      gap: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      padding: spacing.xl,
      ...shadows.card,
    },
    cardTitle: {
      ...typography.section,
      color: colors.text,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
  });
}
