import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FormField } from '../components/FormField';
import {
  privacyPolicySections,
  privacyPolicyTitle,
  userAgreementSections,
  userAgreementTitle,
} from '../data/policies';
import { useAuth } from '../hooks/useAuth';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';

type PolicyModalType = 'privacy' | 'agreement';
type SettingsPage = 'main' | 'security' | 'passcode';

export function SettingsScreen({ navigation }: MainTabsScreenProps<'Settings'>) {
  const {
    changePassword,
    deleteCurrentAccount,
    updateUserSecurityPreference,
    user,
    userSecurityPreference: securityPreference,
  } = useAuth();
  const { colors, isDarkMode, toggleTheme } = useAppTheme();
  const styles = createStyles(colors);
  const [policyModal, setPolicyModal] = useState<PolicyModalType | null>(null);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmNextPassword, setConfirmNextPassword] = useState('');
  const [passcodeDraft, setPasscodeDraft] = useState('');
  const [passcodeConfirmDraft, setPasscodeConfirmDraft] = useState('');
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmDraft, setDeleteConfirmDraft] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const policyTitle =
    policyModal === 'privacy'
      ? privacyPolicyTitle
      : policyModal === 'agreement'
        ? userAgreementTitle
        : '';
  const policySections =
    policyModal === 'privacy'
      ? privacyPolicySections
      : policyModal === 'agreement'
        ? userAgreementSections
        : [];

  const updateSecurityPreference = (patch: Parameters<typeof updateUserSecurityPreference>[0]) => {
    updateUserSecurityPreference(patch);
    setSecurityError(null);
    setSecurityMessage(null);
  };

  const handlePasswordChange = async () => {
    if (nextPassword !== confirmNextPassword) {
      setSecurityError('New passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      setSecurityError(null);
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmNextPassword('');
      setSecurityMessage('Password updated. Use the new password next time you log in.');
      Alert.alert('Password updated', 'Your login password has been changed.');
    } catch (error) {
      setSecurityError(
        error instanceof Error ? error.message : 'Unable to change password right now.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePasscode = () => {
    const cleanedPasscode = passcodeDraft.replace(/\D/g, '').slice(0, 6);
    const cleanedConfirmPasscode = passcodeConfirmDraft.replace(/\D/g, '').slice(0, 6);

    if (cleanedPasscode.length < 4) {
      setSecurityError('Passcode must be 4 to 6 digits.');
      return;
    }

    if (cleanedPasscode !== cleanedConfirmPasscode) {
      setSecurityError('Passcodes do not match.');
      return;
    }

    updateSecurityPreference({
      passcodeEnabled: true,
      passcode: cleanedPasscode,
    });
    setPasscodeDraft('');
    setPasscodeConfirmDraft('');
    setSecurityMessage('App passcode saved.');
    Alert.alert('Passcode saved', 'Your app passcode is ready.');
  };

  const handleRemovePasscode = () => {
    updateSecurityPreference({
      passcodeEnabled: false,
      passcode: '',
    });
    setPasscodeDraft('');
    setPasscodeConfirmDraft('');
    setSecurityMessage('App passcode removed.');
  };

  const handleToggleBiometric = async () => {
    if (securityPreference.biometricEnabled) {
      updateSecurityPreference({ biometricEnabled: false });
      setSecurityMessage('Biometric access turned off.');
      return;
    }

    try {
      setIsCheckingBiometric(true);
      setSecurityError(null);
      setSecurityMessage(null);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        setSecurityError('This device does not have Face ID or Touch ID available.');
        return;
      }

      if (!isEnrolled) {
        setSecurityError('Set up Face ID or Touch ID on this iPhone before turning this on.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
        promptMessage: 'Enable biometric unlock',
      });

      if (!result.success) {
        setSecurityError('Biometric check was cancelled.');
        return;
      }

      updateSecurityPreference({ biometricEnabled: true });
      setSecurityMessage('Biometric access turned on.');
    } catch {
      setSecurityError('Unable to start biometric access on this device.');
    } finally {
      setIsCheckingBiometric(false);
    }
  };

  const openDeleteAccountModal = () => {
    setDeleteConfirmDraft('');
    setDeleteAccountError(null);
    setShowDeleteAccountModal(true);
  };

  const closeDeleteAccountModal = () => {
    if (isDeletingAccount) {
      return;
    }

    setShowDeleteAccountModal(false);
    setDeleteConfirmDraft('');
    setDeleteAccountError(null);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmDraft.trim().toUpperCase() !== 'DELETE') {
      setDeleteAccountError('Type DELETE to confirm account deletion.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      setDeleteAccountError(null);
      await deleteCurrentAccount();
      setShowDeleteAccountModal(false);
      setDeleteConfirmDraft('');
      Alert.alert('Account deleted', 'This account was removed from this device.');
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error ? error.message : 'Unable to delete this account right now.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const renderBackRow = (title: string, subtitle: string) => (
    <View style={styles.subpageHeader}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setSettingsPage('main');
          setSecurityError(null);
          setSecurityMessage(null);
        }}
        style={({ pressed }) => [styles.backButton, pressed && styles.rowPressed]}
      >
        <Ionicons color={colors.text} name="chevron-back-outline" size={22} />
      </Pressable>
      <View style={styles.copy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{subtitle}</Text>
      </View>
    </View>
  );

  const renderMainSettings = () => (
    <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.title}>Control your UrbanConnect app.</Text>
        <Text style={styles.subtitle}>
          Theme, privacy, agreement, account security, and app lock controls live here.
        </Text>
      </View>

      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          onPress={toggleTheme}
          style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        >
          <View style={styles.iconShell}>
            <Ionicons
              color={colors.primary}
              name={isDarkMode ? 'moon' : 'sunny-outline'}
              size={20}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{isDarkMode ? 'Dark mode' : 'Light mode'}</Text>
            <Text style={styles.rowMeta}>Tap to switch the app theme.</Text>
          </View>
          <Ionicons color={colors.textMuted} name="swap-horizontal-outline" size={20} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setSettingsPage('security')}
          style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        >
          <View style={styles.iconShell}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Security</Text>
            <Text style={styles.rowMeta}>Change password and biometric access.</Text>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward-outline" size={20} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setSettingsPage('passcode')}
          style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        >
          <View style={styles.iconShell}>
            <Ionicons color={colors.primary} name="lock-closed-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>App passcode</Text>
            <Text style={styles.rowMeta}>
              {securityPreference.passcodeEnabled
                ? 'Passcode is active for this account.'
                : 'Create a 4 to 6 digit app unlock code.'}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              securityPreference.passcodeEnabled && styles.statusPillActive,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                securityPreference.passcodeEnabled && styles.statusPillTextActive,
              ]}
            >
              {securityPreference.passcodeEnabled ? 'On' : 'Off'}
            </Text>
          </View>
        </Pressable>

        {user?.role === 'businessOwner' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Withdrawal')}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
          >
            <View style={styles.iconShell}>
              <Ionicons color={colors.primary} name="cash-outline" size={20} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>Withdrawal</Text>
              <Text style={styles.rowMeta}>Withdraw seller earnings. BVN or NIN is required only here.</Text>
            </View>
            <Ionicons color={colors.textMuted} name="chevron-forward-outline" size={20} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => setPolicyModal('privacy')}
          style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        >
          <View style={styles.iconShell}>
            <Ionicons color={colors.primary} name="shield-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Privacy Policy</Text>
            <Text style={styles.rowMeta}>Data, media, payment, and support rules.</Text>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward-outline" size={20} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setPolicyModal('agreement')}
          style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        >
          <View style={styles.iconShell}>
            <Ionicons color={colors.primary} name="document-text-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>User Agreement</Text>
            <Text style={styles.rowMeta}>Marketplace and business owner terms.</Text>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward-outline" size={20} />
        </Pressable>
      </View>

      <View style={styles.dangerCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.dangerTitle}>Danger zone</Text>
          <Text style={styles.rowMeta}>Permanent account actions are kept at the bottom.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openDeleteAccountModal}
          style={({ pressed }) => [styles.settingsRow, styles.dangerRow, pressed && styles.rowPressed]}
        >
          <View style={styles.dangerIconShell}>
            <Ionicons color={colors.danger} name="trash-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.dangerTitle}>Delete account</Text>
            <Text style={styles.rowMeta}>Remove your login from this device and disable the live profile.</Text>
          </View>
          <Ionicons color={colors.danger} name="chevron-forward-outline" size={20} />
        </Pressable>
      </View>

      <AppButton label="Back to profile" onPress={() => navigation.navigate('Account')} />
    </>
  );

  const renderSecurityPage = () => (
    <>
      {renderBackRow('Security', 'Change your login password and manage biometric access.')}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Login password</Text>
          <Text style={styles.rowMeta}>This is the password used on the sign in screen.</Text>
        </View>

        <FormField
          label="Current password"
          onChangeText={(value) => {
            setCurrentPassword(value);
            setSecurityError(null);
            setSecurityMessage(null);
          }}
          placeholder="Enter current password"
          secureTextEntry
          value={currentPassword}
        />
        <FormField
          label="New password"
          onChangeText={(value) => {
            setNextPassword(value);
            setSecurityError(null);
            setSecurityMessage(null);
          }}
          placeholder="Enter new password"
          secureTextEntry
          value={nextPassword}
        />
        <FormField
          label="Confirm new password"
          onChangeText={(value) => {
            setConfirmNextPassword(value);
            setSecurityError(null);
            setSecurityMessage(null);
          }}
          placeholder="Repeat new password"
          secureTextEntry
          value={confirmNextPassword}
        />
        <AppButton
          label="Update password"
          loading={isChangingPassword}
          onPress={() => void handlePasswordChange()}
        />

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: securityPreference.biometricEnabled }}
          onPress={() => void handleToggleBiometric()}
          style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
        >
          <View style={styles.iconShell}>
            <Ionicons color={colors.primary} name="finger-print-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>Biometric access</Text>
            <Text style={styles.rowMeta}>Unlock the app with device biometrics when available.</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              securityPreference.biometricEnabled && styles.statusPillActive,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                securityPreference.biometricEnabled && styles.statusPillTextActive,
              ]}
            >
              {isCheckingBiometric ? 'Checking' : securityPreference.biometricEnabled ? 'On' : 'Off'}
            </Text>
          </View>
        </Pressable>

        {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}
        {securityMessage ? <Text style={styles.successText}>{securityMessage}</Text> : null}
      </View>
    </>
  );

  const renderPasscodePage = () => (
    <>
      {renderBackRow('App passcode', 'Create a short unlock code for this account on this device.')}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>
            {securityPreference.passcodeEnabled ? 'Passcode active' : 'Set passcode'}
          </Text>
          <Text style={styles.rowMeta}>
            {securityPreference.passcodeEnabled
              ? 'You will be asked for this passcode after login.'
              : 'Use 4 to 6 digits. Avoid your bank PIN.'}
          </Text>
        </View>

        <FormField
          keyboardType="number-pad"
          label={securityPreference.passcodeEnabled ? 'New passcode' : 'Passcode'}
          maxLength={6}
          onChangeText={(value) => {
            setPasscodeDraft(value.replace(/\D/g, '').slice(0, 6));
            setSecurityError(null);
            setSecurityMessage(null);
          }}
          placeholder="0000"
          secureTextEntry
          value={passcodeDraft}
        />
        <FormField
          keyboardType="number-pad"
          label="Confirm passcode"
          maxLength={6}
          onChangeText={(value) => {
            setPasscodeConfirmDraft(value.replace(/\D/g, '').slice(0, 6));
            setSecurityError(null);
            setSecurityMessage(null);
          }}
          placeholder="0000"
          secureTextEntry
          value={passcodeConfirmDraft}
        />
        <View style={styles.inlineActionRow}>
          <AppButton
            label={securityPreference.passcodeEnabled ? 'Change passcode' : 'Set passcode'}
            onPress={handleSavePasscode}
            variant="secondary"
          />
          {securityPreference.passcodeEnabled ? (
            <AppButton label="Remove passcode" onPress={handleRemovePasscode} variant="ghost" />
          ) : null}
        </View>

        {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}
        {securityMessage ? <Text style={styles.successText}>{securityMessage}</Text> : null}
      </View>
    </>
  );

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {settingsPage === 'main' ? renderMainSettings() : null}
        {settingsPage === 'security' ? renderSecurityPage() : null}
        {settingsPage === 'passcode' ? renderPasscodePage() : null}
      </ScrollView>

      <Modal
        animationType="slide"
        visible={Boolean(policyModal)}
        onRequestClose={() => setPolicyModal(null)}
      >
        <View style={styles.modalShell}>
          <View style={styles.modalHeader}>
            <Text style={styles.sectionTitle}>{policyTitle}</Text>
            <Pressable
              onPress={() => setPolicyModal(null)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.rowPressed]}
            >
              <Ionicons color={colors.text} name="close-outline" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {policySections.map((section) => (
              <View key={section.title} style={styles.policySection}>
                <Text style={styles.rowTitle}>{section.title}</Text>
                <Text style={styles.bodyText}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={showDeleteAccountModal}
        onRequestClose={closeDeleteAccountModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteModalCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.bodyText}>
                This will sign you out, remove this account from the app on this device, disable
                the live profile, remove the saved app passcode, and stop this login from being
                used again. Orders, receipts, payment records, and support history may still be
                retained for compliance and customer care records.
              </Text>
            </View>
            <FormField
              autoCapitalize="characters"
              label="Type DELETE to continue"
              onChangeText={(value) => {
                setDeleteConfirmDraft(value);
                setDeleteAccountError(null);
              }}
              placeholder="DELETE"
              value={deleteConfirmDraft}
            />
            {deleteAccountError ? (
              <Text style={styles.errorText}>{deleteAccountError}</Text>
            ) : null}
            <View style={styles.inlineActionRow}>
              <AppButton
                disabled={deleteConfirmDraft.trim().toUpperCase() !== 'DELETE'}
                label="Delete account"
                loading={isDeletingAccount}
                onPress={() => void handleDeleteAccount()}
                variant="secondary"
              />
              <AppButton label="Cancel" onPress={closeDeleteAccountModal} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    hero: {
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.xl,
      ...shadows.card,
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
    card: {
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    dangerCard: {
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: spacing.lg,
      ...shadows.soft,
    },
    cardHeader: {
      gap: 4,
    },
    subpageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    backButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      width: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    dangerRow: {
      borderColor: colors.danger,
    },
    rowPressed: {
      opacity: 0.92,
    },
    iconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.primarySoft,
    },
    dangerIconShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.secondarySoft,
    },
    copy: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    dangerTitle: {
      ...typography.bodyStrong,
      color: colors.danger,
    },
    rowMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    inlineActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statusPill: {
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    statusPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    statusPillText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    statusPillTextActive: {
      color: colors.white,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    successText: {
      ...typography.caption,
      color: colors.success,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    modalShell: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.lg,
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backdrop,
      padding: spacing.lg,
    },
    deleteModalCard: {
      width: '100%',
      maxWidth: 480,
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: spacing.lg,
      ...shadows.card,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingBottom: spacing.md,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalContent: {
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    policySection: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
  });
}
