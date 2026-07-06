import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AuthPageBackground } from '../components/AuthPageBackground';
import { FormField } from '../components/FormField';
import { UrbanConnectLogo } from '../components/UrbanConnectLogo';
import { isUrbanConnectLocalTestMode } from '../config/runtime';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import { getSupabaseOAuthUrl, isSupabaseConfigured } from '../services/supabaseApi';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type PasswordResetState = {
  identifier: string;
  recipientEmail: string;
  code: string;
  expiresAt: number;
};

function looksLikeEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function looksLikePhone(value: string) {
  return value.replace(/[^\d]/g, '').length >= 10;
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function generateVerificationCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function DispatchLoginScreen() {
  const { width } = useWindowDimensions();
  const { appendEmailLog } = useBusinessDirectory();
  const { resetPassword, signIn, users } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isWideLayout = width >= 980;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordReset, setPasswordReset] = useState<PasswordResetState | null>(null);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetCodeDraft, setResetCodeDraft] = useState('');
  const [resetPasswordDraft, setResetPasswordDraft] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isOpeningGoogle, setIsOpeningGoogle] = useState(false);

  const validateIdentifier = (value: string) =>
    looksLikeEmail(value.trim()) || looksLikePhone(value.trim());

  const handleLogin = async () => {
    const currentIdentifier = identifier.trim();

    if (!validateIdentifier(currentIdentifier)) {
      setError('Use the dispatch email address or phone number on the account.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await signIn({ identifier: currentIdentifier, password, accountRole: 'dispatch' });
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : 'Unable to sign in right now.';
      setError(message);
      Alert.alert('Login failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const closePasswordReset = () => {
    setShowPasswordReset(false);
    setPasswordReset(null);
    setResetIdentifier('');
    setResetCodeDraft('');
    setResetPasswordDraft('');
    setResetConfirmPassword('');
    setResetError(null);
  };

  const findDispatchAccount = (value: string) => {
    const normalizedValue = value.trim();
    const normalizedEmail = normalizedValue.toLowerCase();
    const normalizedPhone = normalizePhone(normalizedValue);

    return users.find(
      (account) =>
        account.role === 'dispatch' &&
        (account.email.trim().toLowerCase() === normalizedEmail ||
          normalizePhone(account.phoneNumber) === normalizedPhone),
    );
  };

  const sendPasswordResetCode = () => {
    const currentIdentifier = resetIdentifier.trim();

    if (!validateIdentifier(currentIdentifier)) {
      setResetError('Enter the dispatch email or phone number on the account.');
      return;
    }

    const matchedAccount = findDispatchAccount(currentIdentifier);

    if (!matchedAccount) {
      setResetError('This account is not registered as a dispatch account.');
      return;
    }

    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    setPasswordReset({
      identifier: matchedAccount.email,
      recipientEmail: matchedAccount.email,
      code,
      expiresAt,
    });
    setResetCodeDraft('');
    setResetError(null);

    appendEmailLog({
      recipientType: 'dispatch',
      recipientName: matchedAccount.fullName,
      recipientEmail: matchedAccount.email,
      subject: 'View2Connect dispatch password reset code',
      body: `Your View2Connect dispatch password reset code is ${code}. It expires in 10 minutes.`,
    });

    Alert.alert(
      'Reset code sent',
      `Enter the 8 digit code sent to ${matchedAccount.email}. Testing code: ${code}`,
    );
  };

  const handlePasswordReset = async () => {
    if (!passwordReset) {
      setResetError('Send a reset code first.');
      return;
    }

    if (Date.now() > passwordReset.expiresAt) {
      setResetError('Reset code expired. Send a new code to continue.');
      setPasswordReset(null);
      setResetCodeDraft('');
      return;
    }

    if (resetCodeDraft.trim() !== passwordReset.code) {
      setResetError('Enter the correct 8 digit reset code.');
      return;
    }

    if (resetPasswordDraft.trim().length < 6) {
      setResetError('New password must be at least 6 characters.');
      return;
    }

    if (resetPasswordDraft !== resetConfirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    try {
      await resetPassword(passwordReset.identifier, resetPasswordDraft);
      const nextEmail = passwordReset.recipientEmail;
      closePasswordReset();
      setIdentifier(nextEmail);
      setPassword(resetPasswordDraft);
      Alert.alert('Password updated', 'Your dispatch password has been updated.');
    } catch (resetFailure) {
      const message =
        resetFailure instanceof Error
          ? resetFailure.message
          : 'Unable to reset password right now.';
      setResetError(message);
    }
  };

  const openGoogleLogin = async () => {
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
      setIsOpeningGoogle(true);
      setError(null);
      await Linking.openURL(getSupabaseOAuthUrl('google', '/app/?oauthRole=dispatch'));
    } catch {
      Alert.alert(
        'Google login unavailable',
        'Enable Google in Supabase Auth, then try again.',
      );
    } finally {
      setIsOpeningGoogle(false);
    }
  };

  return (
    <AuthPageBackground contentContainerStyle={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isWideLayout && styles.scrollContentWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.shell, isWideLayout && styles.shellWide]}>
          <View style={[styles.heroPanel, isWideLayout && styles.heroPanelWide]}>
            <View style={styles.brandRow}>
              <UrbanConnectLogo compact />
              <View style={styles.dispatchBadge}>
                <Ionicons color={colors.white} name="bicycle-outline" size={16} />
                <Text style={styles.dispatchBadgeText}>Dispatch</Text>
              </View>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Dispatch Login</Text>
              <Text style={styles.heroSubtitle}>Access your delivery dashboard.</Text>
              <Text style={styles.heroBody}>
                Sign in with the dispatch account approved for pickups, delivery updates, and
                arrival confirmations.
              </Text>
            </View>
            <View style={styles.heroList}>
              <View style={styles.heroListItem}>
                <Ionicons color={colors.primary} name="navigate-outline" size={18} />
                <Text style={styles.heroListText}>Accept assigned jobs and follow the queue.</Text>
              </View>
              <View style={styles.heroListItem}>
                <Ionicons color={colors.primary} name="checkmark-done-outline" size={18} />
                <Text style={styles.heroListText}>Update picked-up and arrived statuses fast.</Text>
              </View>
              <View style={styles.heroListItem}>
                <Ionicons color={colors.primary} name="shield-checkmark-outline" size={18} />
                <Text style={styles.heroListText}>Dispatch access stays separate from customer and seller accounts.</Text>
              </View>
            </View>
          </View>

          <View style={styles.authCard}>
            <View style={styles.authHeader}>
              <Text style={styles.cardTitle}>Sign in</Text>
              <Text style={styles.cardSubtitle}>
                Use your dispatch email or phone number.
              </Text>
            </View>

            <FormField
              autoCapitalize="none"
              keyboardType={looksLikePhone(identifier) ? 'phone-pad' : 'default'}
              label="Email or phone number"
              onChangeText={(value) => {
                setIdentifier(value);
                setError(null);
              }}
              placeholder="dispatch@example.com or 08012345678"
              value={identifier}
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

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setResetIdentifier(identifier);
                setShowPasswordReset(true);
                setResetError(null);
              }}
              style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}
            >
              <Text style={styles.inlineLinkText}>Forgot Password?</Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              label="Login"
              loading={isLoading}
              onPress={() => void handleLogin()}
              style={styles.primaryButton}
            />

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => void openGoogleLogin()}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.pressed,
                isOpeningGoogle && styles.googleButtonDisabled,
              ]}
            >
              <Ionicons color={colors.text} name="logo-google" size={20} />
              <Text style={styles.googleButtonText}>
                {isOpeningGoogle ? 'Opening Google...' : 'Login with Google'}
              </Text>
            </Pressable>

            <Text style={styles.helperText}>
              Only dispatch accounts can enter this portal. Customer and seller accounts are
              blocked automatically.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={showPasswordReset}
        onRequestClose={closePasswordReset}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.cardTitle}>Reset dispatch password</Text>
                <Text style={styles.cardSubtitle}>
                  Send a code to the dispatch email, then set a new password.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close password reset"
                onPress={closePasswordReset}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.text} name="close-outline" size={22} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FormField
                autoCapitalize="none"
                label="Dispatch email or phone number"
                onChangeText={(value) => {
                  setResetIdentifier(value);
                  setResetError(null);
                }}
                placeholder="dispatch@example.com or 08012345678"
                value={resetIdentifier}
              />

              {!passwordReset ? (
                <AppButton label="Send reset code" onPress={sendPasswordResetCode} />
              ) : (
                <>
                  <Text style={styles.helperText}>
                    Enter the 8 digit code sent to {passwordReset.recipientEmail}.
                  </Text>
                  <FormField
                    keyboardType="numeric"
                    label="Reset code"
                    onChangeText={(value) => {
                      setResetCodeDraft(value.replace(/[^\d]/g, '').slice(0, 8));
                      setResetError(null);
                    }}
                    placeholder="00000000"
                    value={resetCodeDraft}
                  />
                  <FormField
                    label="New password"
                    onChangeText={(value) => {
                      setResetPasswordDraft(value);
                      setResetError(null);
                    }}
                    placeholder="Enter new password"
                    secureTextEntry
                    value={resetPasswordDraft}
                  />
                  <FormField
                    label="Confirm new password"
                    onChangeText={(value) => {
                      setResetConfirmPassword(value);
                      setResetError(null);
                    }}
                    placeholder="Confirm new password"
                    secureTextEntry
                    value={resetConfirmPassword}
                  />
                  <AppButton label="Update password" onPress={() => void handlePasswordReset()} />
                </>
              )}

              {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AuthPageBackground>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    page: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    scrollContentWide: {
      paddingVertical: spacing.xxl,
    },
    shell: {
      width: '100%',
      maxWidth: 1080,
      alignSelf: 'center',
      gap: spacing.lg,
    },
    shellWide: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    heroPanel: {
      gap: spacing.lg,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroPanelWide: {
      flex: 1,
      minWidth: 0,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    dispatchBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    dispatchBadgeText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    heroCopy: {
      gap: spacing.xs,
    },
    heroTitle: {
      fontSize: 32,
      lineHeight: 36,
      fontWeight: '900',
      color: colors.text,
    },
    heroSubtitle: {
      ...typography.section,
      color: colors.primary,
    },
    heroBody: {
      ...typography.body,
      color: colors.textMuted,
    },
    heroList: {
      gap: spacing.md,
    },
    heroListItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      padding: spacing.md,
    },
    heroListText: {
      flex: 1,
      ...typography.body,
      color: colors.text,
    },
    authCard: {
      width: '100%',
      gap: spacing.md,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.card,
    },
    authHeader: {
      gap: spacing.xs,
    },
    cardTitle: {
      ...typography.section,
      color: colors.text,
    },
    cardSubtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    inlineLink: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
    },
    inlineLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    primaryButton: {
      width: '100%',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
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
    googleButton: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    googleButtonDisabled: {
      opacity: 0.7,
    },
    googleButtonText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    helperText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: colors.backdrop,
    },
    modalCard: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '86%',
      alignSelf: 'center',
      gap: spacing.md,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    modalHeaderCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    closeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalContent: {
      gap: spacing.md,
      paddingBottom: spacing.xs,
    },
    pressed: {
      opacity: 0.9,
    },
  });
}
