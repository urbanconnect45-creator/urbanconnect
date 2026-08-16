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
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AuthPageBackground } from '../components/AuthPageBackground';
import { AuthVisualPanel } from '../components/AuthVisualPanel';
import {
  CustomerMobileAuthShell,
  CustomerMobileField,
  CustomerMobilePhoneField,
  CustomerMobileSegments,
} from '../components/CustomerMobileAuth';
import { FormField } from '../components/FormField';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import {
  privacyPolicySections,
  privacyPolicyTitle,
  userAgreementSections,
  userAgreementTitle,
} from '../data/policies';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import { requestSupabasePasswordReset } from '../services/supabaseApi';
import type { LoginScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { UserRole } from '../types/auth';

type LoginMode = 'email' | 'phone';
const countryCodes = [
  { code: '+234', label: 'NG' },
  { code: '+233', label: 'GH' },
  { code: '+1', label: 'US' },
  { code: '+44', label: 'UK' },
] as const;

function looksLikeEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function looksLikePhone(value: string) {
  return value.replace(/[^\d]/g, '').length >= 10;
}

function normalizeLocalPhoneDigits(value: string, countryCode: string) {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  return countryCode === '+234' ? digits.slice(0, 10) : digits.slice(0, 15);
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
      createLabel: 'Dispatch access',
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
  const { signIn } = useAuth();
  const { securitySettings } = useBusinessDirectory();
  const { colors, isDarkMode } = useAppTheme();
  const styles = createStyles(colors, isDarkMode);
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
  const [countryCode, setCountryCode] = useState('+234');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const copy = accountCopy(accountRole);
  const allowPublicSignup = accountRole !== 'dispatch';

  const phoneDigits = normalizeLocalPhoneDigits(phoneNumber, countryCode);
  const currentIdentifier =
    loginMode === 'email' ? email.trim() : `${countryCode}${phoneDigits}`;

  const closePasswordReset = () => {
    setShowPasswordReset(false);
    setResetIdentifier('');
    setResetError(null);
  };

  const validateLoginFields = () => {
    if (securitySettings.maintenanceMode) {
      return copy.maintenance;
    }

    if (loginMode === 'email' && !looksLikeEmail(currentIdentifier)) {
      return 'Use a valid email address.';
    }

    if (
      loginMode === 'phone' &&
      (countryCode === '+234' ? phoneDigits.length !== 10 : !looksLikePhone(currentIdentifier))
    ) {
      return countryCode === '+234'
        ? 'Enter the 10 digit Nigerian phone number after +234.'
        : 'Use a valid phone number.';
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

  const sendPasswordResetCode = async () => {
    const trimmedIdentifier = resetIdentifier.trim();

    if (!looksLikeEmail(trimmedIdentifier) && !looksLikePhone(trimmedIdentifier)) {
      setResetError('Enter the email or phone number on your View2Connect account.');
      return;
    }

    setResetError(null);
    setIsResetLoading(true);

    try {
      await requestSupabasePasswordReset(trimmedIdentifier, accountRole);
      closePasswordReset();
      Alert.alert(
        'Check your email',
        'If that account exists, Supabase has sent a secure password recovery link.',
      );
    } catch (resetRequestError) {
      setResetError(
        resetRequestError instanceof Error
          ? resetRequestError.message
          : 'Password recovery could not be started.',
      );
    } finally {
      setIsResetLoading(false);
    }
  };

  if (!isWideWeb && accountRole === 'resident') {
    return (
      <>
        <CustomerMobileAuthShell
          footer={
            <View style={styles.mobileFooterRow}>
              <Text style={styles.mobileFooterText}>New to View2Connect?</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Signup')}
                style={({ pressed }) => pressed && styles.inlineLinkPressed}
              >
                <Text style={styles.mobileFooterLink}>Create account</Text>
              </Pressable>
            </View>
          }
          subtitle="Use your email or phone number to continue."
          title="Welcome back"
        >
          {securitySettings.maintenanceMode ? (
            <View style={styles.mobileNotice}>
              <Ionicons color={colors.warning} name="construct-outline" size={18} />
              <Text style={styles.mobileNoticeText}>{copy.maintenance}</Text>
            </View>
          ) : null}
          <CustomerMobileSegments<LoginMode>
            onChange={(mode) => {
              setLoginMode(mode);
              setError(null);
              if (mode === 'email') setPhoneNumber('');
              else setEmail('');
            }}
            options={[
              { icon: 'mail-outline', label: 'Email', value: 'email' },
              { icon: 'call-outline', label: 'Phone', value: 'phone' },
            ]}
            value={loginMode}
          />
          {loginMode === 'email' ? (
            <CustomerMobileField
              autoCapitalize="none"
              icon="mail-outline"
              keyboardType="email-address"
              label="Email address"
              onChangeText={setEmail}
              placeholder="email@example.com"
              value={email}
            />
          ) : (
            <CustomerMobilePhoneField
              countryCode={countryCode}
              onChangeCountryCode={(code) => {
                setCountryCode(code);
                setPhoneNumber((current) => normalizeLocalPhoneDigits(current, code));
                setError(null);
              }}
              onChangeText={(value) => setPhoneNumber(normalizeLocalPhoneDigits(value, countryCode))}
              options={countryCodes}
              value={phoneNumber}
            />
          )}
          <CustomerMobileField
            icon="lock-closed-outline"
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter your password"
            rightAccessory={
              <Pressable
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
                onPress={() => setPasswordVisible((current) => !current)}
                style={({ pressed }) => [styles.mobileIconButton, pressed && styles.inlineLinkPressed]}
              >
                <Ionicons
                  color={colors.primary}
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                />
              </Pressable>
            }
            secureTextEntry={!passwordVisible}
            value={password}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setResetIdentifier(currentIdentifier);
              setShowPasswordReset(true);
              setResetError(null);
            }}
            style={({ pressed }) => [styles.mobileForgot, pressed && styles.inlineLinkPressed]}
          >
            <Text style={styles.mobileFooterLink}>Forgot password?</Text>
          </Pressable>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AppButton
            disabled={securitySettings.maintenanceMode}
            label="Sign in"
            loading={isLoading}
            onPress={() => void handleLogin()}
            style={styles.mobilePrimaryButton}
          />
          <SocialAuthButtons compact webRedirectPath="/auth/callback?oauthRole=resident" />
          <Pressable onPress={() => setShowAgreement(true)}>
            <Text style={styles.mobileAgreementText}>
              By continuing, you agree to the user agreement and privacy policy.
            </Text>
          </Pressable>
        </CustomerMobileAuthShell>

        <Modal animationType="slide" transparent visible={showAgreement} onRequestClose={() => setShowAgreement(false)}>
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

        <Modal animationType="slide" transparent visible={showPasswordReset} onRequestClose={closePasswordReset}>
          <View style={styles.modalBackdrop}>
            <View style={styles.policyCard}>
              <Text style={styles.sectionTitle}>Reset password</Text>
              <Text style={styles.helperText}>Enter the email or phone number on your customer account.</Text>
              <FormField
                autoCapitalize="none"
                keyboardType="email-address"
                label="Email or phone"
                onChangeText={(value) => { setResetIdentifier(value); setResetError(null); }}
                placeholder="email@example.com"
                value={resetIdentifier}
              />
              {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
              <AppButton label="Send secure reset link" loading={isResetLoading} onPress={() => void sendPasswordResetCode()} variant="secondary" />
              <AppButton label="Close" onPress={closePasswordReset} variant="ghost" />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <AuthPageBackground
      contentContainerStyle={[styles.container, isWideWeb && styles.containerWide]}
      minimalMobile={!isWideWeb}
    >
      {isWideWeb ? (
        <AuthVisualPanel
          subtitle={copy.visualSubtitle}
          title={copy.visualTitle}
          wide
        />
      ) : null}

      {!isWideWeb ? (
        <View style={styles.mobileHero}>
          <View style={styles.mobileHeroBrandRow}>
            <View style={styles.mobileHeroBrand}>
              <View style={styles.mobileHeroIcon}>
                <Ionicons color={colors.white} name="storefront-outline" size={22} />
              </View>
              <Text style={styles.mobileHeroBrandName}>View2Connect</Text>
            </View>
            <View style={styles.mobileHeroBadge}>
              <Text style={styles.mobileHeroBadgeText}>Customer</Text>
            </View>
          </View>
          <Text style={styles.mobileHeroTitle}>Welcome back</Text>
          <Text style={styles.mobileHeroText}>
            Sign in to shop nearby stores, pay securely, and follow every order.
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.formColumn,
          !isWideWeb && styles.formColumnMobile,
          isWideWeb && styles.formColumnWide,
        ]}
      >
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
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Phone number</Text>
              <View style={styles.countryCodeRow}>
                {countryCodes.map((country) => {
                  const isActive = country.code === countryCode;

                  return (
                    <Pressable
                      key={country.code}
                      onPress={() => {
                        setCountryCode(country.code);
                        setPhoneNumber((current) =>
                          normalizeLocalPhoneDigits(current, country.code),
                        );
                        setError(null);
                      }}
                      style={({ pressed }) => [
                        styles.countryChip,
                        isActive && styles.countryChipActive,
                        pressed && styles.switchButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.countryChipText,
                          isActive && styles.countryChipTextActive,
                        ]}
                      >
                        {country.label} {country.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.phoneInputRow}>
                <Text style={styles.phonePrefix}>{countryCode}</Text>
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={(value) => {
                    setPhoneNumber(normalizeLocalPhoneDigits(value, countryCode));
                  }}
                  placeholder={countryCode === '+234' ? '8012345678' : 'Phone number'}
                  placeholderTextColor={colors.textMuted}
                  style={styles.inlineInput}
                  value={phoneNumber}
                />
              </View>
            </View>
          )}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!passwordVisible}
                style={styles.inlineInput}
                value={password}
              />
              <Pressable
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
                onPress={() => setPasswordVisible((current) => !current)}
                style={({ pressed }) => [
                  styles.passwordToggle,
                  pressed && styles.switchButtonPressed,
                ]}
              >
                <Ionicons
                  color={colors.primary}
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                />
              </Pressable>
            </View>
          </View>

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
            style={isDarkMode ? styles.authPrimaryButton : undefined}
          />
          <Pressable onPress={() => setShowAgreement(true)}>
            <Text style={styles.agreementText}>
              By continuing, you agree to the View2Connect user agreement and privacy policy.
            </Text>
          </Pressable>
          <SocialAuthButtons webRedirectPath="/auth/callback?oauthRole=resident" />
        </View>

        <View style={[styles.footer, !isWideWeb && styles.footerMobile]}>
          {allowPublicSignup ? (
            <>
              <Text style={styles.footerText}>Need an account?</Text>
              <AppButton
                label={copy.createLabel}
                onPress={() => navigation.navigate('Signup')}
                variant="ghost"
              />
            </>
          ) : (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Dispatch access is private</Text>
              <Text style={styles.noticeText}>
                Use the Dispatch Login page to create or access a rider account. Customer and
                seller accounts cannot enter dispatch.
              </Text>
            </View>
          )}
          {isPublicStoreWeb ? (
            <AppButton
              label="Continue shopping"
              onPress={() => navigation.navigate('Dashboard')}
              variant="secondary"
            />
          ) : null}
          {isWideWeb ? (
            <Text style={styles.copyright}>
              Copyright © 2026 View2Connect. CAC registered. All rights reserved.
            </Text>
          ) : null}
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
              Enter your account email or phone number. We will send a secure recovery link to the
              email on that account.
            </Text>
            <FormField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email or phone"
              onChangeText={(value) => {
                setResetIdentifier(value);
                setResetError(null);
              }}
              placeholder="email@example.com"
              value={resetIdentifier}
            />
            <AppButton
              label="Send secure reset link"
              loading={isResetLoading}
              onPress={() => void sendPasswordResetCode()}
              variant="secondary"
            />
            {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
            <AppButton label="Close" onPress={closePasswordReset} variant="ghost" />
          </View>
        </View>
      </Modal>

    </AuthPageBackground>
  );
}

function createStyles(colors: AppColors, isDarkMode: boolean) {
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
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#463A55' : 'rgba(255,255,255,0.78)',
      backgroundColor: isDarkMode ? '#17111F' : colors.surface,
      padding: 0,
      overflow: 'hidden',
      ...shadows.card,
    },
    formColumn: {
      gap: spacing.md,
      width: '100%',
      maxWidth: 540,
      alignSelf: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#463A55' : 'rgba(255,255,255,0.82)',
      backgroundColor: isDarkMode ? '#17111F' : 'rgba(255,255,255,0.97)',
      padding: spacing.md,
      ...shadows.card,
    },
    formColumnMobile: {
      maxWidth: 460,
      borderWidth: 1,
      borderRadius: 8,
      borderColor: isDarkMode ? '#3C3349' : 'rgba(91,43,203,0.13)',
      backgroundColor: isDarkMode ? '#17111F' : colors.white,
      padding: spacing.lg,
      shadowColor: '#2F175F',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 5,
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
      backgroundColor: isDarkMode ? '#17111F' : colors.surface,
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
      gap: spacing.md,
    },
    mobileHero: {
      width: '100%',
      maxWidth: 460,
      alignSelf: 'center',
      minHeight: isDarkMode ? 146 : 184,
      justifyContent: 'space-between',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? '#533E79' : 'transparent',
      backgroundColor: isDarkMode ? '#2A1556' : colors.primary,
      padding: spacing.lg,
      overflow: 'hidden',
      shadowColor: '#321070',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 22,
      elevation: 6,
    },
    mobileHeroBrandRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    mobileHeroBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    mobileHeroIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    mobileHeroBrandName: {
      ...typography.bodyStrong,
      color: colors.white,
      fontWeight: '800',
    },
    mobileHeroBadge: {
      minHeight: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: colors.white,
      paddingHorizontal: spacing.sm,
    },
    mobileHeroBadgeText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    mobileHeroTitle: {
      color: colors.white,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      letterSpacing: 0,
    },
    mobileHeroText: {
      ...typography.body,
      color: 'rgba(255,255,255,0.82)',
      lineHeight: 22,
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
    fieldWrapper: {
      gap: spacing.xs,
    },
    fieldLabel: {
      ...typography.caption,
      color: colors.text,
      letterSpacing: 0.3,
    },
    countryCodeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    countryChip: {
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
    },
    countryChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    countryChipText: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: '700',
    },
    countryChipTextActive: {
      color: colors.white,
    },
    phoneInputRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#463A55' : 'rgba(91,43,203,0.18)',
      backgroundColor: isDarkMode ? '#201A2A' : '#FCFAFF',
      paddingHorizontal: spacing.md,
      ...shadows.soft,
    },
    phonePrefix: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    passwordInputRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#463A55' : 'rgba(91,43,203,0.18)',
      backgroundColor: isDarkMode ? '#201A2A' : '#FCFAFF',
      paddingLeft: spacing.lg,
      paddingRight: spacing.xs,
      ...shadows.soft,
    },
    inlineInput: {
      flex: 1,
      minHeight: 50,
      color: colors.text,
      ...typography.body,
      fontSize: Platform.OS === 'web' ? 16 : typography.body.fontSize,
    },
    passwordToggle: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#382B57' : colors.primarySoft,
    },
    switchShell: {
      flexDirection: 'row',
      gap: spacing.xs,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#110D18' : '#F5F1FC',
      borderWidth: 1,
      borderColor: isDarkMode ? '#463A55' : 'rgba(91,43,203,0.12)',
      padding: 4,
    },
    switchButton: {
      flex: 1,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 6,
      paddingHorizontal: spacing.md,
    },
    switchButtonActive: {
      backgroundColor: isDarkMode ? '#7C4DFF' : colors.primary,
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
    mobileFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    mobileFooterText: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
    mobileFooterLink: { color: colors.primary, fontSize: 12, lineHeight: 17, fontWeight: '900' },
    mobileNotice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.card, paddingHorizontal: 10 },
    mobileNoticeText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '600' },
    mobileIconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
    mobileForgot: { minHeight: 24, alignSelf: 'flex-end', justifyContent: 'center' },
    mobilePrimaryButton: { minHeight: 48, borderRadius: 8 },
    mobileAgreementText: { color: colors.textMuted, fontSize: 10, lineHeight: 14, textAlign: 'center' },
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
    footerMobile: {
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#3C3349' : 'rgba(91,43,203,0.1)',
      paddingTop: spacing.md,
    },
    authPrimaryButton: {
      borderRadius: 8,
      borderColor: '#7C4DFF',
      backgroundColor: '#7C4DFF',
      shadowColor: '#7C4DFF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 5,
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
