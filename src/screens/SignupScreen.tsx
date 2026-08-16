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
} from '../components/CustomerMobileAuth';
import { FormField } from '../components/FormField';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
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

const countryCodes = [
  { code: '+234', label: 'NG' },
  { code: '+233', label: 'GH' },
  { code: '+1', label: 'US' },
  { code: '+44', label: 'UK' },
] as const;

function normalizeLocalPhoneDigits(value: string, countryCode: string) {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  return countryCode === '+234' ? digits.slice(0, 10) : digits.slice(0, 15);
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
  const [form, setForm] = useState<SignUpFormValues>(initialForm);
  const [countryCode, setCountryCode] = useState('+234');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
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
  const phoneDigits = normalizeLocalPhoneDigits(form.phoneNumber, countryCode);
  const normalizedSignupPhone = `${countryCode}${phoneDigits}`;

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
    if (
      countryCode === '+234'
        ? phoneDigits.length !== 10
        : !hasValidPhone(normalizedSignupPhone)
    ) {
      return countryCode === '+234'
        ? 'Enter the 10 digit Nigerian phone number after +234.'
        : 'Use a valid phone number.';
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
      await requestSignUpVerification({ ...form, phoneNumber: normalizedSignupPhone });
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
      await signUp({ ...form, phoneNumber: normalizedSignupPhone }, verificationCode);
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

  if (!isWideWeb && signupStep === 'verification' && activeVerification) {
    return (
      <CustomerMobileAuthShell
        footer={
          <View style={styles.mobileFooterRow}>
            <Text style={styles.mobileFooterText}>Already registered?</Text>
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={styles.mobileFooterLink}>Sign in</Text>
            </Pressable>
          </View>
        }
        subtitle={`Enter the 8 digit code sent to ${activeVerification.email}.`}
        title="Verify your email"
      >
        <View style={styles.mobileVerificationIcon}>
          <Ionicons color={colors.primary} name="mail-unread-outline" size={30} />
        </View>
        <CustomerMobileField
          autoFocus
          icon="keypad-outline"
          keyboardType="number-pad"
          label="Verification code"
          maxLength={verificationCodeLength}
          onChangeText={(value) => setVerificationCodeDraft(value.replace(/\D/g, '').slice(0, verificationCodeLength))}
          placeholder="00000000"
          value={verificationCodeDraft}
        />
        <Text style={styles.mobileOtpHint}>The account is created only after this code is verified.</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <AppButton
          disabled={verificationCodeDraft.trim().length < verificationCodeLength}
          label="Verify and create account"
          loading={isLoading}
          onPress={() => void handleSignup()}
          style={styles.mobilePrimaryButton}
        />
        <View style={styles.mobileVerificationActions}>
          <Pressable onPress={() => void handleRequestVerification()} style={styles.mobileActionButton}>
            <Text style={styles.mobileFooterLink}>Resend code</Text>
          </Pressable>
          <Pressable
            onPress={() => { setSignupStep('details'); setError(null); }}
            style={styles.mobileActionButton}
          >
            <Text style={styles.mobileFooterLink}>Edit details</Text>
          </Pressable>
        </View>
      </CustomerMobileAuthShell>
    );
  }

  if (!isWideWeb) {
    return (
      <>
        <CustomerMobileAuthShell
          footer={
            <View style={styles.mobileFooterRow}>
              <Text style={styles.mobileFooterText}>Already have an account?</Text>
              <Pressable onPress={() => navigation.goBack()}>
                <Text style={styles.mobileFooterLink}>Sign in</Text>
              </Pressable>
            </View>
          }
          subtitle="Join the marketplace for local shopping, secure orders, and delivery updates."
          title="Create your account"
        >
          {securitySettings.maintenanceMode || !signupsAllowedForRole ? (
            <View style={styles.mobileNotice}>
              <Ionicons color={colors.warning} name="construct-outline" size={18} />
              <Text style={styles.mobileNoticeText}>
                {securitySettings.maintenanceMode ? 'Signup is temporarily paused for maintenance.' : 'Customer signup is temporarily paused.'}
              </Text>
            </View>
          ) : null}
          <View style={styles.mobileFieldRow}>
            <View style={styles.mobileFieldHalf}>
              <CustomerMobileField
                autoCapitalize="words"
                icon="person-outline"
                label="First name"
                onChangeText={(value) => updateField('firstName', value)}
                placeholder="First name"
                value={form.firstName}
              />
            </View>
            <View style={styles.mobileFieldHalf}>
              <CustomerMobileField
                autoCapitalize="words"
                icon="person-outline"
                label="Last name"
                onChangeText={(value) => updateField('lastName', value)}
                placeholder="Last name"
                value={form.lastName}
              />
            </View>
          </View>
          <CustomerMobilePhoneField
            countryCode={countryCode}
            onChangeCountryCode={(code) => {
              setCountryCode(code);
              updateField('phoneNumber', normalizeLocalPhoneDigits(form.phoneNumber, code));
            }}
            onChangeText={(value) => updateField('phoneNumber', normalizeLocalPhoneDigits(value, countryCode))}
            options={countryCodes}
            value={form.phoneNumber}
          />
          <CustomerMobileField
            autoCapitalize="none"
            icon="mail-outline"
            keyboardType="email-address"
            label="Email address"
            onChangeText={(value) => updateField('email', value)}
            placeholder="email@example.com"
            value={form.email}
          />
          <View style={[styles.mobileFieldRow, width < 350 && styles.mobileFieldStack]}>
            <View style={styles.mobileFieldHalf}>
              <CustomerMobileField
                icon="lock-closed-outline"
                label="Password"
                onChangeText={(value) => updateField('password', value)}
                placeholder="Password"
                rightAccessory={
                  <Pressable
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                    accessibilityRole="button"
                    onPress={() => setPasswordVisible((current) => !current)}
                    style={styles.mobileIconButton}
                  >
                    <Ionicons color={colors.primary} name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={18} />
                  </Pressable>
                }
                secureTextEntry={!passwordVisible}
                value={form.password}
              />
            </View>
            <View style={styles.mobileFieldHalf}>
              <CustomerMobileField
                icon="shield-checkmark-outline"
                label="Confirm"
                onChangeText={(value) => updateField('confirmPassword', value)}
                placeholder="Repeat"
                rightAccessory={
                  <Pressable
                    accessibilityLabel={confirmPasswordVisible ? 'Hide password confirmation' : 'Show password confirmation'}
                    accessibilityRole="button"
                    onPress={() => setConfirmPasswordVisible((current) => !current)}
                    style={styles.mobileIconButton}
                  >
                    <Ionicons color={colors.primary} name={confirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={18} />
                  </Pressable>
                }
                secureTextEntry={!confirmPasswordVisible}
                value={form.confirmPassword}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedAgreement }}
            onPress={() => { setAcceptedAgreement((current) => !current); setError(null); }}
            style={({ pressed }) => [styles.mobileAgreementRow, pressed && styles.agreementRowPressed]}
          >
            <View style={[styles.checkbox, acceptedAgreement && styles.checkboxActive]}>
              {acceptedAgreement ? <Ionicons color={colors.white} name="checkmark" size={16} /> : null}
            </View>
            <Text style={styles.mobileAgreementText}>I agree to the user agreement, privacy policy, and marketplace rules.</Text>
          </Pressable>
          <Pressable onPress={() => setShowAgreement(true)} style={styles.mobilePolicyLink}>
            <Text style={styles.mobileFooterLink}>Read the policies</Text>
          </Pressable>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AppButton
            disabled={securitySettings.maintenanceMode || !signupsAllowedForRole || !acceptedAgreement}
            label="Send verification code"
            loading={isLoading}
            onPress={() => void handleRequestVerification()}
            style={styles.mobilePrimaryButton}
          />
          <SocialAuthButtons compact webRedirectPath="/auth/callback?oauthRole=resident" />
        </CustomerMobileAuthShell>

        <Modal animationType="slide" transparent visible={showAgreement} onRequestClose={() => setShowAgreement(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.policyCard}>
              <View style={styles.policyHeader}>
                <View style={styles.policyHeaderCopy}>
                  <Text style={styles.sectionTitle}>{privacyPolicyTitle}</Text>
                  <Text style={styles.noticeCopy}>{userAgreementTitle}</Text>
                </View>
                <Pressable onPress={() => setShowAgreement(false)} style={styles.closeButton}>
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
      </>
    );
  }

  if (signupStep === 'verification' && activeVerification) {
    return (
      <AuthPageBackground
        contentContainerStyle={[styles.container, isWideWeb && styles.containerWide]}
        minimalMobile={!isWideWeb}
      >
        {isWideWeb ? (
          <AuthVisualPanel
            subtitle="Your account stays protected while you shop, pay, and track every order."
            title="One quick verification, then you are connected."
            wide
          />
        ) : null}

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
              style={isDarkMode ? styles.authPrimaryButton : undefined}
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
            {isWideWeb ? (
              <Text style={styles.copyright}>
                Copyright © 2026 View2Connect. CAC registered. All rights reserved.
              </Text>
            ) : null}
          </View>
        </View>
      </AuthPageBackground>
    );
  }

  return (
    <AuthPageBackground
      contentContainerStyle={[styles.container, isWideWeb && styles.containerWide]}
      minimalMobile={!isWideWeb}
    >
      {isWideWeb ? (
        <AuthVisualPanel
          subtitle="Create one account for products, food, secure checkout, receipts, and delivery updates."
          title="Join the marketplace built for everyday local shopping."
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
          <Text style={styles.mobileHeroTitle}>Create your account</Text>
          <Text style={styles.mobileHeroText}>
            Join your local marketplace and keep shopping, payments, and delivery in one place.
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
          <View style={[styles.signupField, !isWideWeb && styles.signupFieldMobile]}>
            <FormField
              label="First name"
              onChangeText={(value) => updateField('firstName', value)}
              placeholder="Maya"
              value={form.firstName}
            />
          </View>
          <View style={[styles.signupField, !isWideWeb && styles.signupFieldMobile]}>
            <FormField
              label="Last name"
              onChangeText={(value) => updateField('lastName', value)}
              placeholder="Johnson"
              value={form.lastName}
            />
          </View>
          <View style={[styles.signupField, !isWideWeb && styles.signupFieldMobile]}>
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
                        updateField(
                          'phoneNumber',
                          normalizeLocalPhoneDigits(form.phoneNumber, country.code),
                        );
                      }}
                      style={({ pressed }) => [
                        styles.countryChip,
                        isActive && styles.countryChipActive,
                        pressed && styles.agreementRowPressed,
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
                  onChangeText={(value) =>
                    updateField('phoneNumber', normalizeLocalPhoneDigits(value, countryCode))
                  }
                  placeholder={countryCode === '+234' ? '8012345678' : 'Phone number'}
                  placeholderTextColor={colors.textMuted}
                  style={styles.inlineInput}
                  value={form.phoneNumber}
                />
              </View>
            </View>
          </View>
          <View style={[styles.signupField, !isWideWeb && styles.signupFieldMobile]}>
            <FormField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={(value) => updateField('email', value)}
              placeholder="Email address"
              value={form.email}
            />
          </View>
          <View style={[styles.signupField, !isWideWeb && styles.signupFieldMobile]}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordInputRow}>
                <TextInput
                  onChangeText={(value) => updateField('password', value)}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!passwordVisible}
                  style={styles.inlineInput}
                  value={form.password}
                />
                <Pressable
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                  onPress={() => setPasswordVisible((current) => !current)}
                  style={({ pressed }) => [
                    styles.passwordToggle,
                    pressed && styles.agreementRowPressed,
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
          </View>
          <View style={[styles.signupField, !isWideWeb && styles.signupFieldMobile]}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Confirm password</Text>
              <View style={styles.passwordInputRow}>
                <TextInput
                  onChangeText={(value) => updateField('confirmPassword', value)}
                  placeholder="Repeat"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!confirmPasswordVisible}
                  style={styles.inlineInput}
                  value={form.confirmPassword}
                />
                <Pressable
                  accessibilityLabel={confirmPasswordVisible ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                  onPress={() => setConfirmPasswordVisible((current) => !current)}
                  style={({ pressed }) => [
                    styles.passwordToggle,
                    pressed && styles.agreementRowPressed,
                  ]}
                >
                  <Ionicons
                    color={colors.primary}
                    name={confirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                  />
                </Pressable>
              </View>
            </View>
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
          style={isDarkMode ? styles.authPrimaryButton : undefined}
        />
        </View>

        <View style={[styles.footer, !isWideWeb && styles.footerMobile]}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <AppButton label="Back to login" onPress={() => navigation.goBack()} variant="ghost" />
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
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      gap: spacing.md,
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
      gap: spacing.md,
    },
    formCardMobile: {
      borderRadius: 0,
      gap: spacing.md,
      padding: 0,
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
    signupFieldMobile: {
      flexBasis: '100%',
      minWidth: '100%',
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
    mobileFieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    mobileFieldStack: { flexDirection: 'column' },
    mobileFieldHalf: { flex: 1, minWidth: 0 },
    mobileIconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
    mobileAgreementRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10 },
    mobileAgreementText: { flex: 1, color: colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '600' },
    mobilePolicyLink: { minHeight: 22, alignSelf: 'center', justifyContent: 'center' },
    mobilePrimaryButton: { minHeight: 48, borderRadius: 8 },
    mobileFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    mobileFooterText: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
    mobileFooterLink: { color: colors.primary, fontSize: 12, lineHeight: 17, fontWeight: '900' },
    mobileNotice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.card, paddingHorizontal: 10 },
    mobileNoticeText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '600' },
    mobileVerificationIcon: { width: 64, height: 64, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primarySoft },
    mobileOtpHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
    mobileVerificationActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    mobileActionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
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
