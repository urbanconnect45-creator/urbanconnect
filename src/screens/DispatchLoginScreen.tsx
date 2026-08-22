import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
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
import { estates } from '../data/estates';
import { useAuth } from '../hooks/useAuth';
import { requestSupabasePasswordReset } from '../services/supabaseApi';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { SignUpFormValues } from '../types/auth';
import { riverParkClusters } from '../types/business';

type DispatchAuthMode = 'login' | 'signup';
type DispatchSignupStep = 'details' | 'verification';

function looksLikeEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function looksLikePhone(value: string) {
  return value.replace(/[^\d]/g, '').length >= 10;
}

export function DispatchLoginScreen() {
  const { width } = useWindowDimensions();
  const { requestSignUpVerification, signIn, signUp } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isWideLayout = width >= 980;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [authMode, setAuthMode] = useState<DispatchAuthMode>('login');
  const [signupStep, setSignupStep] = useState<DispatchSignupStep>('details');
  const [signupDraft, setSignupDraft] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [signupCode, setSignupCode] = useState('');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [isSignupLoading, setIsSignupLoading] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const dispatchStats = [
    { label: 'Queue', value: 'Live' },
    { label: 'Updates', value: 'Fast' },
    { label: 'Access', value: 'Approved' },
  ];

  const validateIdentifier = (value: string) =>
    looksLikeEmail(value.trim()) || looksLikePhone(value.trim());

  const updateSignupDraft = (field: keyof typeof signupDraft, value: string) => {
    setSignupDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setSignupError(null);
  };

  const buildDispatchSignupValues = (): SignUpFormValues => {
    const nameParts = signupDraft.fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ') || 'Rider';

    return {
      firstName,
      lastName,
      phoneNumber: signupDraft.phoneNumber.trim(),
      email: signupDraft.email.trim().toLowerCase(),
      password: signupDraft.password,
      confirmPassword: signupDraft.confirmPassword,
      role: 'dispatch',
      estateId: estates[0]?.id ?? 'river-park',
      businessName: '',
      businessCluster: riverParkClusters[0],
    };
  };

  const validateDispatchSignup = () => {
    const values = buildDispatchSignupValues();

    if (!values.firstName) {
      throw new Error('Enter the dispatch rider full name.');
    }

    if (!looksLikeEmail(values.email)) {
      throw new Error('Enter a valid dispatch email address.');
    }

    if (!looksLikePhone(values.phoneNumber)) {
      throw new Error('Enter a valid dispatch phone number.');
    }

    if (values.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    if (values.password !== values.confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    return values;
  };

  const sendDispatchSignupCode = async () => {
    try {
      const values = validateDispatchSignup();
      setIsSignupLoading(true);
      setSignupError(null);
      await requestSignUpVerification(values);
      setSignupStep('verification');
      setSignupCode('');
      Alert.alert(
        'Verification code sent',
        `Enter the 8 digit code sent to ${values.email}. Your dispatch account will be created after the code is confirmed.`,
      );
    } catch (signupFailure) {
      setSignupError(
        signupFailure instanceof Error
          ? signupFailure.message
          : 'Unable to send dispatch verification code.',
      );
    } finally {
      setIsSignupLoading(false);
    }
  };

  const completeDispatchSignup = async () => {
    try {
      const values = validateDispatchSignup();

      if (!/^\d{8}$/.test(signupCode.trim())) {
        throw new Error('Enter the 8 digit verification code.');
      }

      setIsSignupLoading(true);
      setSignupError(null);
      await signUp(values, signupCode.trim());
    } catch (signupFailure) {
      setSignupError(
        signupFailure instanceof Error
          ? signupFailure.message
          : 'Unable to create dispatch account right now.',
      );
    } finally {
      setIsSignupLoading(false);
    }
  };

  const showLoginMode = () => {
    setAuthMode('login');
    setSignupError(null);
  };

  const showSignupMode = () => {
    setAuthMode('signup');
    setSignupError(null);
  };

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
    setResetIdentifier('');
    setResetError(null);
  };

  const sendPasswordResetCode = async () => {
    const currentIdentifier = resetIdentifier.trim();

    if (!validateIdentifier(currentIdentifier)) {
      setResetError('Enter the dispatch email or phone number on the account.');
      return;
    }

    setResetError(null);
    setIsResetLoading(true);
    try {
      await requestSupabasePasswordReset(currentIdentifier, 'dispatch');
      closePasswordReset();
      Alert.alert(
        'Check your email',
        'If that dispatch account exists, Supabase has sent a secure recovery link.',
      );
    } catch (resetFailure) {
      const message =
        resetFailure instanceof Error
          ? resetFailure.message
          : 'Unable to reset password right now.';
      setResetError(message);
    } finally {
      setIsResetLoading(false);
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
          {isWideLayout ? (
            <View style={[styles.heroPanel, styles.heroPanelWide]}>
              <View style={styles.brandRow}>
                <UrbanConnectLogo inverted />
                <View style={styles.portalBadge}>
                  <Ionicons color={colors.white} name="car-sport-outline" size={16} />
                  <Text style={styles.portalBadgeText}>Dispatch portal</Text>
                </View>
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>Delivery operations</Text>
                <Text style={styles.heroTitle}>Dispatch Login</Text>
                <Text style={styles.heroSubtitle}>Access your delivery dashboard.</Text>
                <Text style={styles.heroBody}>
                  Sign in with the dispatch account approved for pickups, delivery updates, and
                  arrival confirmations.
                </Text>
              </View>
              <View style={styles.heroStats}>
                {dispatchStats.map((item) => (
                  <View key={item.label} style={styles.heroStatCard}>
                    <Text style={styles.heroStatValue}>{item.value}</Text>
                    <Text style={styles.heroStatLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.heroList}>
                <View style={styles.heroListItem}>
                  <Ionicons color={colors.white} name="navigate-outline" size={18} />
                  <Text style={styles.heroListText}>Accept assigned jobs and follow the queue.</Text>
                </View>
                <View style={styles.heroListItem}>
                  <Ionicons color={colors.white} name="checkmark-done-outline" size={18} />
                  <Text style={styles.heroListText}>Update picked-up and arrived statuses fast.</Text>
                </View>
                <View style={styles.heroListItem}>
                  <Ionicons color={colors.white} name="shield-checkmark-outline" size={18} />
                  <Text style={styles.heroListText}>
                    Dispatch access stays separate from customer and seller accounts.
                  </Text>
                </View>
              </View>
              <View style={styles.noticeCard}>
                <Ionicons color={colors.white} name="information-circle-outline" size={18} />
                <Text style={styles.noticeText}>
                  Dispatch riders can create an account here, then use Dispatch Login for delivery
                  work only.
                </Text>
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.authCard,
              !isWideLayout && styles.authCardMobile,
              isWideLayout && styles.authCardWide,
            ]}
          >
            {authMode === 'login' ? (
              <>
                <View style={styles.authHeader}>
                  <View style={styles.cardBadge}>
                    <Ionicons color={colors.primary} name="shield-checkmark-outline" size={16} />
                    <Text style={styles.cardBadgeText}>Dispatch account access</Text>
                  </View>
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
                  rightAccessory={
                    <Pressable
                      accessibilityLabel={showLoginPassword ? 'Hide password' : 'Show password'}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setShowLoginPassword((current) => !current)}
                    >
                      <Ionicons
                        color={colors.textMuted}
                        name={showLoginPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                      />
                    </Pressable>
                  }
                  secureTextEntry={!showLoginPassword}
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

                <Pressable
                  accessibilityRole="button"
                  onPress={showSignupMode}
                  style={({ pressed }) => [styles.secondaryLink, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryLinkText}>Create dispatch account</Text>
                </Pressable>

                <Text style={styles.helperText}>
                  Customer, seller, and admin accounts are blocked automatically.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.authHeader}>
                  <View style={styles.cardBadge}>
                    <Ionicons color={colors.primary} name="person-add-outline" size={16} />
                    <Text style={styles.cardBadgeText}>New dispatch rider</Text>
                  </View>
                  <Text style={styles.cardTitle}>Create dispatch account</Text>
                  <Text style={styles.cardSubtitle}>
                    Enter rider details, then confirm the email code.
                  </Text>
                </View>

                <FormField
                  label="Full name"
                  onChangeText={(value) => updateSignupDraft('fullName', value)}
                  placeholder="Dispatch rider name"
                  value={signupDraft.fullName}
                />
                <FormField
                  autoCapitalize="none"
                  keyboardType="email-address"
                  label="Email"
                  onChangeText={(value) => updateSignupDraft('email', value)}
                  placeholder="dispatch@example.com"
                  value={signupDraft.email}
                />
                <FormField
                  keyboardType="phone-pad"
                  label="Phone number"
                  onChangeText={(value) => updateSignupDraft('phoneNumber', value)}
                  placeholder="08012345678"
                  value={signupDraft.phoneNumber}
                />
                <FormField
                  label="Password"
                  onChangeText={(value) => updateSignupDraft('password', value)}
                  placeholder="At least 8 characters"
                  rightAccessory={
                    <Pressable
                      accessibilityLabel={showSignupPassword ? 'Hide password' : 'Show password'}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setShowSignupPassword((current) => !current)}
                    >
                      <Ionicons
                        color={colors.textMuted}
                        name={showSignupPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                      />
                    </Pressable>
                  }
                  secureTextEntry={!showSignupPassword}
                  value={signupDraft.password}
                />
                <FormField
                  label="Confirm password"
                  onChangeText={(value) => updateSignupDraft('confirmPassword', value)}
                  placeholder="Repeat password"
                  rightAccessory={
                    <Pressable
                      accessibilityLabel={
                        showSignupConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'
                      }
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setShowSignupConfirmPassword((current) => !current)}
                    >
                      <Ionicons
                        color={colors.textMuted}
                        name={showSignupConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                      />
                    </Pressable>
                  }
                  secureTextEntry={!showSignupConfirmPassword}
                  value={signupDraft.confirmPassword}
                />

                {signupStep === 'verification' ? (
                  <FormField
                    keyboardType="numeric"
                    label="Email verification code"
                    onChangeText={(value) => {
                      setSignupCode(value.replace(/[^\d]/g, '').slice(0, 8));
                      setSignupError(null);
                    }}
                    placeholder="00000000"
                    value={signupCode}
                  />
                ) : null}

                {signupError ? <Text style={styles.errorText}>{signupError}</Text> : null}

                <AppButton
                  label={
                    signupStep === 'verification'
                      ? 'Create dispatch account'
                      : 'Send verification code'
                  }
                  loading={isSignupLoading}
                  onPress={() =>
                    signupStep === 'verification'
                      ? void completeDispatchSignup()
                      : void sendDispatchSignupCode()
                  }
                  style={styles.primaryButton}
                />

                {signupStep === 'verification' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void sendDispatchSignupCode()}
                    style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}
                  >
                    <Text style={styles.inlineLinkText}>Resend code</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={showLoginMode}
                  style={({ pressed }) => [styles.secondaryLink, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryLinkText}>Back to Dispatch login</Text>
                </Pressable>
              </>
            )}
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
                  Send a secure recovery link to the email on the dispatch account.
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

              <AppButton
                label="Send secure reset link"
                loading={isResetLoading}
                onPress={() => void sendPasswordResetCode()}
              />

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
      maxWidth: 1180,
      alignSelf: 'center',
      gap: spacing.lg,
    },
    shellWide: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.xl,
    },
    heroPanel: {
      gap: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      padding: spacing.xxl,
      ...shadows.card,
    },
    heroPanelWide: {
      flex: 1,
      minWidth: 0,
      minHeight: 620,
      justifyContent: 'space-between',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    portalBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    portalBadgeText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    heroCopy: {
      gap: spacing.xs,
    },
    heroEyebrow: {
      ...typography.eyebrow,
      color: '#F2C45A',
    },
    heroTitle: {
      fontSize: 38,
      lineHeight: 44,
      fontWeight: '900',
      color: colors.white,
    },
    heroSubtitle: {
      ...typography.section,
      color: '#E7DFFF',
    },
    heroBody: {
      ...typography.body,
      color: '#D6DFE2',
      maxWidth: 520,
    },
    heroStats: {
      flexDirection: 'row',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    heroStatCard: {
      minWidth: 110,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    heroStatValue: {
      ...typography.section,
      color: colors.white,
    },
    heroStatLabel: {
      ...typography.caption,
      color: '#D6DFE2',
    },
    heroList: {
      gap: spacing.md,
    },
    heroListItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      padding: spacing.md,
    },
    heroListText: {
      flex: 1,
      ...typography.body,
      color: colors.white,
    },
    noticeCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      padding: spacing.md,
    },
    noticeText: {
      flex: 1,
      ...typography.caption,
      color: '#E7DFFF',
    },
    authCard: {
      width: '100%',
      gap: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xxl,
      ...shadows.card,
    },
    authCardMobile: {
      padding: spacing.lg,
    },
    authCardWide: {
      flexShrink: 0,
      width: 470,
      maxWidth: '100%',
      alignSelf: 'center',
    },
    authHeader: {
      gap: spacing.xs,
    },
    cardBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginBottom: spacing.xs,
    },
    cardBadgeText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
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
    secondaryLink: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    secondaryLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    primaryButton: {
      width: '100%',
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
