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
import { UrbanConnectLogo } from '../components/UrbanConnectLogo';
import { estates } from '../data/estates';
import {
  privacyPolicySections,
  privacyPolicyTitle,
  userAgreementSections,
  userAgreementTitle,
} from '../data/policies';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { SignupScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { SignUpFormValues } from '../types/auth';
import { riverParkClusters } from '../types/business';

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function hasValidPhone(value: string) {
  return value.replace(/[^\d]/g, '').length >= 10;
}

const verificationCodeLength = 8;

function initialForm(): SignUpFormValues {
  return {
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'resident',
    estateId: estates[0]?.id ?? 'river-park',
    businessName: '',
    businessCluster: riverParkClusters[0],
  };
}

type SignupVerificationState = {
  email: string;
  recipientName: string;
  expiresAt: number;
};

export function SignupScreen({ navigation }: SignupScreenProps) {
  const { requestSignUpVerification, signUp } = useAuth();
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
  const [form, setForm] = useState<SignUpFormValues>(initialForm);
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signupStep, setSignupStep] = useState<'details' | 'verification'>('details');
  const [verification, setVerification] = useState<SignupVerificationState | null>(null);
  const [verificationCodeDraft, setVerificationCodeDraft] = useState('');

  const signupAudienceLabel = 'user';
  const signupTitle = 'Create your user account.';
  const signupSubtitle =
    'Sign up with your personal details to shop approved products, discover food, and track orders.';
  const verificationTitle = 'Verify your email.';

  const updateField = <K extends keyof SignUpFormValues>(key: K, value: SignUpFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setVerification(null);
    setVerificationCodeDraft('');
    setSignupStep('details');
    setError(null);
  };

  const signupsAllowedForRole = securitySettings.allowResidentSignups;

  const validateSignupForm = () => {
    if (securitySettings.maintenanceMode) {
      return 'Signup is paused while the marketplace is in maintenance mode.';
    }
    if (!signupsAllowedForRole) {
      return 'User signup is currently paused by the owner.';
    }
    if (!form.firstName.trim()) {
      return 'First name is required.';
    }
    if (!form.lastName.trim()) {
      return 'Last name is required.';
    }
    if (!hasValidPhone(form.phoneNumber)) {
      return 'Use a valid phone number.';
    }
    if (!isValidEmail(form.email)) {
      return 'Use a valid email address.';
    }
    if (form.password.trim().length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match.';
    }
    if (!acceptedAgreement) {
      return 'Please accept the View2Connect user agreement to continue.';
    }

    return null;
  };

  const handleRequestVerification = async () => {
    const validationError = validateSignupForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const email = form.email.trim().toLowerCase();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

    try {
      setIsLoading(true);
      await requestSignUpVerification(form);
      setVerification({ email, recipientName: fullName, expiresAt });
      setVerificationCodeDraft('');
      setSignupStep('verification');
      setError(null);

      appendEmailLog({
        recipientType: form.role === 'businessOwner' ? 'owner' : 'buyer',
        recipientName: fullName,
        recipientEmail: email,
        subject: 'View2Connect signup verification code',
        body: 'A Supabase one-time signup verification code was sent to this email address. It expires shortly.',
      });

      Alert.alert(
        'Verification email sent',
        `We sent an 8 digit code to ${email}. Enter it on the verification page to create the account.`,
      );
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : 'Unable to send the verification email right now.';
      setError(message);
      Alert.alert('Email not sent', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    const validationError = validateSignupForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const email = form.email.trim().toLowerCase();

    if (!verification || verification.email !== email) {
      setSignupStep('details');
      setError('Send a verification code to this email before creating the account.');
      return;
    }

    if (Date.now() > verification.expiresAt) {
      setError('Verification code expired. Send a new code to continue.');
      setVerification(null);
      setVerificationCodeDraft('');
      return;
    }

    const verificationCode = verificationCodeDraft.trim();

    if (!new RegExp(`^\\d{${verificationCodeLength}}$`).test(verificationCode)) {
      setError('Enter the 8 digit code sent to your email.');
      return;
    }

    try {
      setIsLoading(true);
      await signUp(form, verificationCode);
    } catch (signupError) {
      const message =
        signupError instanceof Error ? signupError.message : 'Unable to create account right now.';
      setError(message);
      Alert.alert('Signup failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const activeVerification =
    verification && verification.email === form.email.trim().toLowerCase()
      ? verification
      : null;

  if (signupStep === 'verification' && activeVerification) {
    return (
      <AuthPageBackground
        contentContainerStyle={[styles.container, isWideWeb && styles.containerWide]}
      >
        {isWideWeb ? (
          <AuthVisualPanel
            subtitle="Your account stays protected while you shop, pay, and track every order."
            title="One quick verification, then you are connected."
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
            <View style={styles.verificationHeader}>
              <Ionicons color={colors.primary} name="mail-outline" size={22} />
              <View style={styles.verificationCopy}>
                <Text style={styles.sectionTitle}>{verificationTitle}</Text>
                <Text style={styles.noticeCopy}>
                  {activeVerification.email} must be verified before View2Connect creates the
                  account.
                </Text>
              </View>
            </View>

            <FormField
              helper="Enter exactly the 8 numbers from the email. Do not enter a link or extra characters."
              keyboardType="number-pad"
              label="Verification code"
              maxLength={verificationCodeLength}
              onChangeText={(value) =>
                setVerificationCodeDraft(value.replace(/\D/g, '').slice(0, verificationCodeLength))
              }
              placeholder="00000000"
              value={verificationCodeDraft}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              disabled={verificationCodeDraft.trim().length < verificationCodeLength}
              label="Create account"
              loading={isLoading}
              onPress={() => void handleSignup()}
            />

            <View style={styles.verificationActionRow}>
              <Pressable
                onPress={() => void handleRequestVerification()}
                style={({ pressed }) => [styles.policyLink, pressed && styles.agreementRowPressed]}
              >
                <Text style={styles.policyLinkText}>Resend code</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSignupStep('details');
                  setError(null);
                }}
                style={({ pressed }) => [styles.policyLink, pressed && styles.agreementRowPressed]}
              >
                <Text style={styles.policyLinkText}>Edit signup details</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <AppButton label="Back to login" onPress={() => navigation.goBack()} variant="ghost" />
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
      </AuthPageBackground>
    );
  }

  return (
    <AuthPageBackground
      contentContainerStyle={[styles.container, isWideWeb && styles.containerWide]}
    >
      {isWideWeb ? (
        <AuthVisualPanel
          subtitle="Create one account for products, food, secure checkout, receipts, and delivery updates."
          title="Join the marketplace built for everyday local shopping."
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
          <View style={styles.signupHeading}>
            <Text style={styles.sectionTitle}>{signupTitle}</Text>
            <Text style={styles.noticeCopy}>{signupSubtitle}</Text>
          </View>
        {securitySettings.maintenanceMode || !signupsAllowedForRole ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>
              {securitySettings.maintenanceMode
                ? 'Marketplace maintenance is active'
                : 'Signup is paused for this role'}
            </Text>
            <Text style={styles.noticeCopy}>
              {securitySettings.maintenanceMode
                ? 'Signup is temporarily paused while system work is completed.'
                : `New ${signupAudienceLabel} registrations are temporarily disabled.`}
            </Text>
          </View>
        ) : null}

        <View style={styles.signupFieldsGrid}>
          <View style={styles.signupField}>
            <FormField
              label="First name"
              onChangeText={(value) => updateField('firstName', value)}
              placeholder="Maya"
              value={form.firstName}
            />
          </View>
          <View style={styles.signupField}>
            <FormField
              label="Last name"
              onChangeText={(value) => updateField('lastName', value)}
              placeholder="Johnson"
              value={form.lastName}
            />
          </View>
          <View style={styles.signupField}>
            <FormField
              keyboardType="phone-pad"
              label="Phone number"
              onChangeText={(value) => updateField('phoneNumber', value)}
              placeholder="0800 123 4567"
              value={form.phoneNumber}
            />
          </View>
          <View style={styles.signupField}>
            <FormField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={(value) => updateField('email', value)}
              placeholder="Email address"
              value={form.email}
            />
          </View>
          <View style={styles.signupField}>
            <FormField
              label="Password"
              onChangeText={(value) => updateField('password', value)}
              placeholder="Password"
              secureTextEntry
              value={form.password}
            />
          </View>
          <View style={styles.signupField}>
            <FormField
              label="Confirm password"
              onChangeText={(value) => updateField('confirmPassword', value)}
              placeholder="Repeat"
              secureTextEntry
              value={form.confirmPassword}
            />
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{estates[0]?.name ?? 'View2Connect Marketplace'}</Text>
          <Text style={styles.noticeCopy}>
            Your customer account can be used to browse stores, place orders, and track delivery.
          </Text>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedAgreement }}
          onPress={() => {
            setAcceptedAgreement((current) => !current);
            setError(null);
          }}
          style={({ pressed }) => [styles.agreementRow, pressed && styles.agreementRowPressed]}
        >
          <View style={[styles.checkbox, acceptedAgreement && styles.checkboxActive]}>
            {acceptedAgreement ? (
              <Ionicons color={colors.white} name="checkmark" size={16} />
            ) : null}
          </View>
          <Text style={styles.agreementText}>
            I agree to the View2Connect user agreement, privacy policy, and marketplace rules.
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowAgreement(true)}
          style={({ pressed }) => [styles.policyLink, pressed && styles.agreementRowPressed]}
        >
          <Text style={styles.policyLinkText}>View privacy policy and user agreement</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <AppButton
          disabled={securitySettings.maintenanceMode || !signupsAllowedForRole || !acceptedAgreement}
          label="Send verification code"
          loading={isLoading}
          onPress={() => void handleRequestVerification()}
        />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <AppButton label="Back to login" onPress={() => navigation.goBack()} variant="ghost" />
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
            <View style={styles.policyHeader}>
              <View style={styles.policyHeaderCopy}>
                <Text style={styles.sectionTitle}>{privacyPolicyTitle}</Text>
                <Text style={styles.noticeCopy}>{userAgreementTitle}</Text>
              </View>
              <Pressable
                onPress={() => setShowAgreement(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.agreementRowPressed]}
              >
                <Ionicons color={colors.text} name="close" size={20} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator>
              {[...privacyPolicySections, ...userAgreementSections].map((section) => (
                <View key={section.title} style={styles.policySection}>
                  <Text style={styles.noticeTitle}>{section.title}</Text>
                  <Text style={styles.noticeCopy}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
            <AppButton label="Close" onPress={() => setShowAgreement(false)} />
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
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      gap: spacing.md,
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
      gap: spacing.md,
    },
    formCardMobile: {
      borderRadius: 0,
      gap: spacing.md,
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
    signupHeading: {
      gap: 4,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    signupTypeBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      padding: spacing.md,
    },
    signupTypeIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      width: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
    },
    signupTypeCopy: {
      flex: 1,
      gap: 4,
    },
    signupFieldsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: spacing.md,
      rowGap: spacing.lg,
    },
    signupField: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '45%',
      minWidth: '45%',
    },
    randomFillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    randomFillButton: {
      minHeight: 46,
      flex: 1,
      minWidth: 150,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    randomFillButtonPressed: {
      opacity: 0.9,
    },
    randomFillText: {
      ...typography.bodyStrong,
      color: colors.primary,
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
    noticeCopy: {
      ...typography.caption,
      color: colors.textMuted,
    },
    verificationCard: {
      gap: spacing.md,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      padding: spacing.md,
    },
    verificationHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    verificationCopy: {
      flex: 1,
      gap: 4,
    },
    verificationActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    agreementRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    agreementRowPressed: {
      opacity: 0.9,
    },
    checkbox: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 24,
      width: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    checkboxActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    agreementText: {
      ...typography.caption,
      flex: 1,
      color: colors.textMuted,
    },
    policyLink: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
    },
    policyLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
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
    policyHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    policyHeaderCopy: {
      flex: 1,
      gap: 4,
    },
    closeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      width: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    policySection: {
      gap: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.md,
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
