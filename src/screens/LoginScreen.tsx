import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AuthPageBackground } from '../components/AuthPageBackground';
import { AuthVisualPanel } from '../components/AuthVisualPanel';
import { FormField } from '../components/FormField';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { UrbanConnectLogo } from '../components/UrbanConnectLogo';
import {
  privacyPolicySections,
  privacyPolicyTitle,
  userAgreementSections,
  userAgreementTitle,
} from '../data/policies';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { LoginScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { UserRole } from '../types/auth';

type LoginMode = 'email' | 'phone';
type PasswordResetState = {
  identifier: string;
  recipientEmail: string;
  accountType: 'user' | 'admin';
  code: string;
  expiresAt: number;
};

type PasswordResetAccount = {
  identifier: string;
  recipientEmail: string;
  recipientName: string;
  recipientType: 'buyer' | 'owner' | 'admin' | 'customerCare' | 'dispatch';
  accountType: 'user' | 'admin';
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

const verificationCodeLength = 8;

function generateVerificationCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

type RoleLoginScreenProps = LoginScreenProps & {
  accountRole?: Extract<UserRole, 'resident' | 'dispatch'>;
};

function accountCopy(role: Extract<UserRole, 'resident' | 'dispatch'>) {
  if (role === 'dispatch') {
    return {
      title: 'Dispatch login',
      helper: 'Use your dispatch email or phone number to continue.',
      visualTitle: 'Delivery work, orders, and confirmations in one place.',
      visualSubtitle: 'Accept assigned jobs and keep delivery progress organized.',
      maintenance: 'Dispatch login is paused while the owner keeps the marketplace in maintenance mode.',
      accountLabel: 'dispatch',
      createLabel: 'Create dispatch account',
    };
  }

  return {
    title: 'Welcome back',
    helper: 'Use your email or phone number to continue.',
    visualTitle: 'Everything nearby, connected in one place.',
    visualSubtitle: 'Discover products, food, and trusted local sellers from one marketplace.',
    maintenance: 'Resident login is paused while the owner keeps the marketplace in maintenance mode.',
    accountLabel: 'customer',
    createLabel: 'Create user account',
  };
}

export function LoginScreen({ navigation, accountRole = 'resident' }: RoleLoginScreenProps) {
  const { resetPassword, signIn, users } = useAuth();
  const { appendEmailLog, securitySettings } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width >= 900;
  const isPublicStoreWeb =
    Platform.OS === 'web' &&
    ((globalThis as { location?: { pathname?: string } }).location?.pathname ?? '').replace(
      /\/+$/,
      '',
    ) === '';
  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordReset, setPasswordReset] = useState<PasswordResetState | null>(null);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetCodeDraft, setResetCodeDraft] = useState('');
  const [resetPasswordDraft, setResetPasswordDraft] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const copy = accountCopy(accountRole);

  const currentIdentifier = loginMode === 'email' ? email.trim() : phoneNumber.trim();

  const closePasswordReset = () => {
    setShowPasswordReset(false);
    setPasswordReset(null);
    setResetIdentifier('');
    setResetCodeDraft('');
    setResetPasswordDraft('');
    setResetConfirmPassword('');
    setResetError(null);
  };

  const validateLoginFields = () => {
    if (securitySettings.maintenanceMode) {
      return copy.maintenance;
    }

    if (loginMode === 'email' && !looksLikeEmail(currentIdentifier)) {
      return 'Use a valid email address.';
    }

    if (loginMode === 'phone' && !looksLikePhone(currentIdentifier)) {
      return 'Use a valid phone number.';
    }

    if (password.trim().length < 6) {
      return 'Password must be at least 6 characters.';
    }

    return null;
  };

  const handleLogin = async () => {
    const validationError = validateLoginFields();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      await signIn({ identifier: currentIdentifier, password, accountRole });
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : 'Unable to sign in right now.';
      setError(message);
      Alert.alert('Login failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const findPasswordResetAccount = (identifier: string): PasswordResetAccount | undefined => {
    const normalizedIdentifier = identifier.trim();
    const normalizedEmail = normalizedIdentifier.toLowerCase();
    const normalizedPhone = normalizePhone(normalizedIdentifier);

    const matchedUser = users.find(
      (account) =>
        account.role === accountRole &&
        (account.email.trim().toLowerCase() === normalizedEmail ||
          normalizePhone(account.phoneNumber) === normalizedPhone),
    );

    if (matchedUser) {
        return {
          identifier: matchedUser.email,
          recipientEmail: matchedUser.email,
          recipientName: matchedUser.fullName,
          recipientType:
            matchedUser.role === 'businessOwner'
              ? 'owner'
              : matchedUser.role === 'dispatch'
                ? 'dispatch'
                : 'buyer',
          accountType: 'user',
        };
    }

    return undefined;
  };

  const sendPasswordResetCode = () => {
    const trimmedIdentifier = resetIdentifier.trim();

    if (!looksLikeEmail(trimmedIdentifier) && !looksLikePhone(trimmedIdentifier)) {
      setResetError('Enter the email or phone number on your View2Connect account.');
      return;
    }

    const matchedAccount = findPasswordResetAccount(trimmedIdentifier);

    if (!matchedAccount) {
      setResetError('No View2Connect account was found for that email or phone number.');
      return;
    }

    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    setPasswordReset({
      identifier: matchedAccount.identifier,
      recipientEmail: matchedAccount.recipientEmail,
      accountType: matchedAccount.accountType,
      code,
      expiresAt,
    });
    setResetCodeDraft('');
    setResetError(null);

    appendEmailLog({
      recipientType: matchedAccount.recipientType,
      recipientName: matchedAccount.recipientName,
      recipientEmail: matchedAccount.recipientEmail,
      subject: 'View2Connect password reset code',
      body: `Your View2Connect password reset code is ${code}. It expires in 10 minutes.`,
    });

    Alert.alert(
      'Reset code sent',
      `Enter the 8 digit code sent to ${matchedAccount.recipientEmail}. Testing code: ${code}`,
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
      const recipientEmail = passwordReset.recipientEmail;
      const nextPassword = resetPasswordDraft;
      closePasswordReset();

      setLoginMode('email');
      setEmail(recipientEmail);
      setPhoneNumber('');
      setPassword(nextPassword);
      Alert.alert('Password updated', 'Your new password is ready. Sign in with it now.');
    } catch (resetFailure) {
      const message =
        resetFailure instanceof Error ? resetFailure.message : 'Unable to reset password right now.';
      setResetError(message);
    }
  };

  return (
    <AuthPageBackground
      contentContainerStyle={[styles.container, isWideWeb && styles.containerWide]}
    >
      {isWideWeb ? (
        <AuthVisualPanel
          subtitle={copy.visualSubtitle}
          title={copy.visualTitle}
          wide
        />
      ) : (
        <View style={styles.mobileBrand}>
          <UrbanConnectLogo />
          <View style={styles.mobileCacBadge}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={16} />
            <Text style={styles.mobileCacText}>CAC registered</Text>
          </View>
        </View>
      )}

      <View style={[styles.formColumn, isWideWeb && styles.formColumnWide]}>
        <View
          style={[
            styles.formCard,
            !isWideWeb && styles.formCardMobile,
            isWideWeb && styles.formCardWide,
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>{copy.title}</Text>
            <Text style={styles.helperText}>{copy.helper}</Text>
          </View>

          {securitySettings.maintenanceMode ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Maintenance mode is active</Text>
              <Text style={styles.noticeText}>
                Customer login is temporarily paused. Use the private admin portal on desktop.
              </Text>
            </View>
          ) : null}

          <View style={styles.switchShell}>
            {(['email', 'phone'] as LoginMode[]).map((mode) => {
              const isActive = loginMode === mode;

              return (
                <Pressable
                  key={mode}
                  onPress={() => {
                    setLoginMode(mode);
                    setError(null);

                    if (mode === 'email') {
                      setPhoneNumber('');
                    } else {
                      setEmail('');
                    }
                  }}
                  style={({ pressed }) => [
                    styles.switchButton,
                    isActive && styles.switchButtonActive,
                    pressed && styles.switchButtonPressed,
                  ]}
                >
                  <Ionicons
                    color={isActive ? colors.white : colors.primary}
                    name={mode === 'email' ? 'mail-outline' : 'call-outline'}
                    size={17}
                  />
                  <Text style={[styles.switchText, isActive && styles.switchTextActive]}>
                    {mode === 'email' ? 'Email' : 'Phone'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {loginMode === 'email' ? (
            <FormField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={(value) => {
                setEmail(value);
              }}
              placeholder="email@example.com"
              value={email}
            />
          ) : (
            <FormField
              keyboardType="phone-pad"
              label="Phone number"
              onChangeText={(value) => {
                setPhoneNumber(value);
              }}
              placeholder="+2348000000000"
              value={phoneNumber}
            />
          )}
          <FormField
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            value={password}
          />

          <Pressable
            onPress={() => {
              setResetIdentifier(currentIdentifier);
              setShowPasswordReset(true);
              setResetError(null);
            }}
            style={({ pressed }) => [styles.inlineLink, pressed && styles.inlineLinkPressed]}
          >
            <Text style={styles.inlineLinkText}>Forgot password?</Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AppButton
            disabled={securitySettings.maintenanceMode}
            label="Login"
            loading={isLoading}
            onPress={() => void handleLogin()}
          />
          <Pressable onPress={() => setShowAgreement(true)}>
            <Text style={styles.agreementText}>
              By continuing, you agree to the View2Connect user agreement and privacy policy.
            </Text>
          </Pressable>
          <SocialAuthButtons />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Need an account?</Text>
          <AppButton
            label={copy.createLabel}
            onPress={() => navigation.navigate('Signup')}
            variant="ghost"
          />
          {isPublicStoreWeb ? (
            <AppButton
              label="Continue shopping"
              onPress={() => navigation.navigate('Dashboard')}
              variant="secondary"
            />
          ) : null}
          <Text style={styles.copyright}>
            Copyright © 2026 View2Connect. CAC registered. All rights reserved.
          </Text>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={showAgreement}
        onRequestClose={() => setShowAgreement(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.policyCard}>
            <Text style={styles.sectionTitle}>{privacyPolicyTitle}</Text>
            <Text style={styles.helperText}>{userAgreementTitle}</Text>
            <ScrollView showsVerticalScrollIndicator>
              {[...privacyPolicySections, ...userAgreementSections].map((section) => (
                <View key={section.title} style={styles.policySection}>
                  <Text style={styles.noticeTitle}>{section.title}</Text>
                  <Text style={styles.noticeText}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
            <AppButton label="Close" onPress={() => setShowAgreement(false)} />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={showPasswordReset}
        onRequestClose={closePasswordReset}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.policyCard}>
            <Text style={styles.sectionTitle}>Reset password</Text>
            <Text style={styles.helperText}>
              Enter your account email or phone number. We will send a reset code to the email on
              that account.
            </Text>
            <FormField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email or phone"
              onChangeText={(value) => {
                setResetIdentifier(value);
                setPasswordReset(null);
                setResetCodeDraft('');
                setResetError(null);
              }}
              placeholder="email@example.com"
              value={resetIdentifier}
            />
            <AppButton
              label={passwordReset ? 'Resend reset code' : 'Send reset code'}
              onPress={sendPasswordResetCode}
              variant="secondary"
            />
            {passwordReset ? (
              <View style={styles.resetCodeCard}>
                <View style={styles.verificationHeader}>
                  <Ionicons color={colors.primary} name="mail-open-outline" size={20} />
                  <View style={styles.verificationCopy}>
                    <Text style={styles.noticeTitle}>Code sent</Text>
                    <Text style={styles.noticeText}>
                      Check {passwordReset.recipientEmail}, then enter the code below.
                    </Text>
                  </View>
                </View>
                <FormField
                  keyboardType="number-pad"
                  label="Reset code"
                  maxLength={verificationCodeLength}
                  onChangeText={(value) =>
                    setResetCodeDraft(value.replace(/\D/g, '').slice(0, verificationCodeLength))
                  }
                  placeholder="00000000"
                  value={resetCodeDraft}
                />
                <FormField
                  label="New password"
                  onChangeText={setResetPasswordDraft}
                  placeholder="Enter new password"
                  secureTextEntry
                  value={resetPasswordDraft}
                />
                <FormField
                  label="Confirm password"
                  onChangeText={setResetConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                  value={resetConfirmPassword}
                />
                <AppButton label="Update password" onPress={() => void handlePasswordReset()} />
              </View>
            ) : null}
            {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
            <AppButton label="Close" onPress={closePasswordReset} variant="ghost" />
          </View>
        </View>
      </Modal>

    </AuthPageBackground>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      gap: spacing.md,
      padding: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    containerWide: {
      width: '100%',
      maxWidth: 1240,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'center',
      gap: 0,
      minHeight: 700,
      marginVertical: spacing.xl,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.78)',
      backgroundColor: colors.surface,
      padding: 0,
      overflow: 'hidden',
      ...shadows.card,
    },
    formColumn: {
      gap: spacing.md,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.82)',
      backgroundColor: 'rgba(255,255,255,0.97)',
      padding: spacing.md,
      ...shadows.card,
    },
    formColumnWide: {
      flex: 1,
      width: 'auto',
      maxWidth: 620,
      minWidth: 0,
      justifyContent: 'center',
      alignSelf: 'stretch',
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      shadowOpacity: 0,
      elevation: 0,
    },
    formCard: {
      gap: spacing.md,
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 0,
    },
    formCardWide: {
      justifyContent: 'center',
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
      padding: 0,
      shadowOpacity: 0,
      elevation: 0,
    },
    formCardMobile: {
      borderRadius: 0,
      padding: 0,
    },
    mobileBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    mobileCacBadge: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
    },
    mobileCacText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    cardHeader: {
      gap: 4,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    helperText: {
      ...typography.body,
      color: colors.textMuted,
    },
    switchShell: {
      flexDirection: 'row',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
    },
    switchButton: {
      flex: 1,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
    },
    switchButtonActive: {
      backgroundColor: colors.primary,
    },
    switchButtonPressed: {
      opacity: 0.9,
    },
    switchText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    switchTextActive: {
      color: colors.white,
    },
    inlineLink: {
      alignSelf: 'flex-start',
    },
    inlineLinkPressed: {
      opacity: 0.8,
    },
    inlineLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    agreementText: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backdrop,
      padding: spacing.lg,
    },
    policyCard: {
      width: '100%',
      maxWidth: 680,
      maxHeight: '86%',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    policySection: {
      gap: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.md,
    },
    noticeCard: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    noticeTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    noticeText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    resetCodeCard: {
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: spacing.md,
    },
    verificationHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    verificationCopy: {
      flex: 1,
      gap: 2,
    },
    demoCard: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    demoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    demoRowPressed: {
      opacity: 0.92,
    },
    demoAvatar: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.primarySoft,
    },
    demoAvatarText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    demoCopy: {
      flex: 1,
      gap: 4,
    },
    demoName: {
      ...typography.subtitle,
      color: colors.text,
    },
    demoMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    demoAction: {
      ...typography.caption,
      color: colors.primary,
    },
    demoActionPill: {
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    footer: {
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    footerText: {
      ...typography.body,
      color: colors.textMuted,
    },
    copyright: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
}
