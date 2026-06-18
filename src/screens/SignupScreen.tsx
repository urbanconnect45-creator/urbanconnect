import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
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
import type { SignUpFormValues, UserRole } from '../types/auth';
import { riverParkClusters, type RiverParkCluster } from '../types/business';
import { createRandomSignupForm } from '../utils/randomSignup';

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

type RoleCardProps = {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  helper: string;
};

type SignupVerificationState = {
  email: string;
  recipientName: string;
  expiresAt: number;
};

function RoleCard({ active, helper, icon, label, onPress }: RoleCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        active && styles.roleCardActive,
        pressed && styles.roleCardPressed,
      ]}
    >
      <View style={[styles.roleIconShell, active && styles.roleIconShellActive]}>
        <Ionicons color={active ? colors.white : colors.primary} name={icon} size={20} />
      </View>
      <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>{label}</Text>
      <Text style={[styles.roleHelper, active && styles.roleHelperActive]}>{helper}</Text>
    </Pressable>
  );
}

export function SignupScreen({ navigation }: SignupScreenProps) {
  const { requestSignUpVerification, signUp } = useAuth();
  const { appendEmailLog, securitySettings } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [form, setForm] = useState<SignUpFormValues>(initialForm());
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signupStep, setSignupStep] = useState<'details' | 'verification'>('details');
  const [verification, setVerification] = useState<SignupVerificationState | null>(null);
  const [verificationCodeDraft, setVerificationCodeDraft] = useState('');

  const updateField = <K extends keyof SignUpFormValues>(key: K, value: SignUpFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setVerification(null);
    setVerificationCodeDraft('');
    setSignupStep('details');
    setError(null);
  };

  const fillRandomAccount = (role: UserRole) => {
    setForm(createRandomSignupForm(role));
    setAcceptedAgreement(true);
    setSignupStep('details');
    setVerification(null);
    setVerificationCodeDraft('');
    setError(null);
  };

  const signupsAllowedForRole =
    form.role === 'resident'
      ? securitySettings.allowResidentSignups
      : securitySettings.allowBusinessOwnerSignups;

  const validateSignupForm = () => {
    if (securitySettings.maintenanceMode) {
      return 'Signup is paused while the marketplace is in maintenance mode.';
    }
    if (!signupsAllowedForRole) {
      return form.role === 'resident'
        ? 'Resident signup is currently paused by the owner.'
        : 'Business owner signup is currently paused by the owner.';
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
    if (form.role === 'businessOwner' && !form.businessName.trim()) {
      return 'Business name is required for business owners.';
    }
    if (!acceptedAgreement) {
      return 'Please accept the UrbanConnect user agreement to continue.';
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
        subject: 'UrbanConnect signup verification code',
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
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.launchPill}>
            <Text style={styles.launchPillText}>Email sent</Text>
          </View>
          <Text style={styles.eyebrow}>Verify email</Text>
          <Text style={styles.title}>Enter the code sent to your inbox.</Text>
          <Text style={styles.subtitle}>
            {activeVerification.email} must be verified before UrbanConnect creates the account.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.verificationHeader}>
            <Ionicons color={colors.primary} name="mail-outline" size={22} />
            <View style={styles.verificationCopy}>
              <Text style={styles.noticeTitle}>Signup verification</Text>
              <Text style={styles.noticeCopy}>
                The account for {activeVerification.recipientName || activeVerification.email} will
                only be created after this code is accepted.
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
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.launchPill}>
          <Text style={styles.launchPillText}>River Park access</Text>
        </View>
        <Text style={styles.eyebrow}>Create account</Text>
        <Text style={styles.title}>Join as a buyer or business owner.</Text>
        <Text style={styles.subtitle}>
          Sign up with your personal details first. If you choose the business icon, we also ask
          for your business name and River Park cluster. Every field is required before the email
          code is sent.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Choose account type</Text>
        <View style={styles.roleGrid}>
          <RoleCard
            active={form.role === 'resident'}
            helper="Shop products, order delivery, and message customer care."
            icon="person-outline"
            label="Resident"
            onPress={() => updateField('role', 'resident')}
          />
          <RoleCard
            active={form.role === 'businessOwner'}
            helper="List products or services inside River Park."
            icon="storefront-outline"
            label="Business"
            onPress={() => updateField('role', 'businessOwner')}
          />
        </View>

        <View style={styles.randomFillRow}>
          {[
            { icon: 'person-add-outline' as const, label: 'Random resident', role: 'resident' as const },
            { icon: 'briefcase-outline' as const, label: 'Random business', role: 'businessOwner' as const },
          ].map((option) => (
            <Pressable
              key={option.role}
              onPress={() => fillRandomAccount(option.role)}
              style={({ pressed }) => [
                styles.randomFillButton,
                pressed && styles.randomFillButtonPressed,
              ]}
            >
              <Ionicons color={colors.primary} name={option.icon} size={18} />
              <Text style={styles.randomFillText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            {securitySettings.maintenanceMode
              ? 'Marketplace maintenance is active'
              : signupsAllowedForRole
                ? 'Signup is open for this role'
                : 'Signup is paused for this role'}
          </Text>
          <Text style={styles.noticeCopy}>
            {securitySettings.maintenanceMode
              ? 'The owner has temporarily paused signup while system work is being completed.'
              : signupsAllowedForRole
                ? `New ${form.role === 'resident' ? 'resident' : 'business owner'} accounts can still be created inside River Park.`
                : `The owner has temporarily disabled new ${form.role === 'resident' ? 'resident' : 'business owner'} registrations.`}
          </Text>
        </View>

        <View style={styles.inlineFieldRow}>
          <View style={styles.inlineField}>
            <FormField
              label="First name"
              onChangeText={(value) => updateField('firstName', value)}
              placeholder="Maya"
              value={form.firstName}
            />
          </View>
          <View style={styles.inlineField}>
            <FormField
              label="Last name"
              onChangeText={(value) => updateField('lastName', value)}
              placeholder="Johnson"
              value={form.lastName}
            />
          </View>
        </View>

        <FormField
          keyboardType="phone-pad"
          label="Phone number"
          onChangeText={(value) => updateField('phoneNumber', value)}
          placeholder="+2348001234567"
          value={form.phoneNumber}
        />
        <FormField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => updateField('email', value)}
          placeholder="you@example.com"
          value={form.email}
        />
        {form.role === 'businessOwner' ? (
          <View style={styles.businessSection}>
            <FormField
              label="Business name"
              onChangeText={(value) => updateField('businessName', value)}
              placeholder="SwiftFix River Park"
              value={form.businessName}
            />
            <View style={styles.clusterWrap}>
              {riverParkClusters.map((cluster) => {
                const isActive = form.businessCluster === cluster;

                return (
                  <Pressable
                    key={cluster}
                    onPress={() => updateField('businessCluster', cluster as RiverParkCluster)}
                    style={({ pressed }) => [
                      styles.clusterChip,
                      isActive && styles.clusterChipActive,
                      pressed && styles.clusterChipPressed,
                    ]}
                  >
                    <Text style={[styles.clusterChipText, isActive && styles.clusterChipTextActive]}>
                      {cluster}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <FormField
          label="Password"
          onChangeText={(value) => updateField('password', value)}
          placeholder="Create a password"
          secureTextEntry
          value={form.password}
        />
        <FormField
          label="Confirm password"
          onChangeText={(value) => updateField('confirmPassword', value)}
          placeholder="Repeat your password"
          secureTextEntry
          value={form.confirmPassword}
        />

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{estates[0]?.name ?? 'River Park Estate'}</Text>
          <Text style={styles.noticeCopy}>
            Signups are still limited to River Park while the marketplace rollout stays focused.
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
            I agree to the UrbanConnect user agreement, privacy policy, and marketplace rules.
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <AppButton label="Back to login" onPress={() => navigation.goBack()} variant="ghost" />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.xl,
      padding: spacing.lg,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
    },
    header: {
      position: 'relative',
      overflow: 'hidden',
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
    },
    heroGlowOne: {
      position: 'absolute',
      top: -28,
      right: -10,
      height: 144,
      width: 144,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.28)',
    },
    heroGlowTwo: {
      position: 'absolute',
      bottom: -46,
      left: -16,
      height: 156,
      width: 156,
      borderRadius: 999,
      backgroundColor: 'rgba(58, 144, 158, 0.24)',
    },
    launchPill: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      backgroundColor: colors.overlayMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    launchPillText: {
      ...typography.caption,
      color: colors.white,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: '#D7EAE2',
    },
    title: {
      ...typography.title,
      color: colors.white,
    },
    subtitle: {
      ...typography.body,
      color: '#D6DFE2',
    },
    formCard: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    roleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    roleCard: {
      flex: 1,
      minWidth: 180,
      gap: spacing.sm,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    roleCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    roleCardPressed: {
      opacity: 0.92,
    },
    roleIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      width: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
    },
    roleIconShellActive: {
      backgroundColor: colors.primary,
    },
    roleTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    roleTitleActive: {
      color: colors.primary,
    },
    roleHelper: {
      ...typography.caption,
      color: colors.textMuted,
    },
    roleHelperActive: {
      color: colors.primary,
    },
    inlineFieldRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    inlineField: {
      flex: 1,
      minWidth: 180,
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
    businessSection: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    clusterWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    clusterChip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    clusterChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    clusterChipPressed: {
      opacity: 0.92,
    },
    clusterChipText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    clusterChipTextActive: {
      color: colors.white,
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
  });
}
