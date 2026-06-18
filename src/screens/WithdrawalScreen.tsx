import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { WithdrawalScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { WithdrawalKycType } from '../types/business';
import { formatCurrency, formatDateTime } from '../utils/format';

const kycTypeOptions: { label: string; value: WithdrawalKycType }[] = [
  { label: 'BVN', value: 'bvn' },
  { label: 'NIN', value: 'nin' },
];

function isWarehouseReleased(status: string) {
  return status === 'delivered';
}

export function WithdrawalScreen({ navigation }: WithdrawalScreenProps) {
  const { user } = useAuth();
  const {
    getOrdersForOwner,
    getVirtualAccountForOwner,
    getWithdrawalsForOwner,
    requestWithdrawal,
    verifyOwnerVirtualAccount,
  } = useBusinessDirectory();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [kycType, setKycType] = useState<WithdrawalKycType>('bvn');
  const [kycNumber, setKycNumber] = useState('');
  const [idDocumentUri, setIdDocumentUri] = useState('');
  const [idDocumentName, setIdDocumentName] = useState('');
  const [isReplacingKyc, setIsReplacingKyc] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownerOrders = useMemo(
    () => (user?.role === 'businessOwner' ? getOrdersForOwner(user.id, user) : []),
    [getOrdersForOwner, user],
  );
  const withdrawals = useMemo(
    () => (user?.role === 'businessOwner' ? getWithdrawalsForOwner(user.id) : []),
    [getWithdrawalsForOwner, user],
  );
  const ownerKeys = [
    user?.id,
    user?.fullName,
    user?.businessName,
    user?.email,
  ]
    .map((key) => key?.trim().toLowerCase())
    .filter((key): key is string => Boolean(key));
  const availableBeforeWithdrawals = ownerOrders.reduce(
    (total, order) =>
      total +
      (order.paymentStatus === 'paid' && isWarehouseReleased(order.status)
        ? order.items
            .filter((item) =>
              [item.ownerUserId, item.ownerName]
                .map((key) => key?.trim().toLowerCase())
                .some((key) => Boolean(key && ownerKeys.includes(key))),
            )
            .reduce((itemTotal, item) => itemTotal + item.lineTotal, 0)
        : 0),
    0,
  );
  const withdrawn = withdrawals.reduce((total, withdrawal) => total + withdrawal.amount, 0);
  const available = Math.max(0, availableBeforeWithdrawals - withdrawn);
  const virtualAccount =
    user?.role === 'businessOwner' ? getVirtualAccountForOwner(user.id) : undefined;
  const withdrawalAccountVerified =
    !isReplacingKyc &&
    virtualAccount?.status === 'verified' &&
    Boolean(
      virtualAccount.kycType &&
        virtualAccount.kycLast4 &&
        virtualAccount.kycReference &&
        virtualAccount.idDocumentUri,
    );

  if (!user) {
    return null;
  }

  const pickIdDocument = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Allow photo access so you can upload your ID.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setIdDocumentUri(asset.uri);
    setIdDocumentName(asset.fileName ?? `id-document-${Date.now()}.jpg`);
    setError(null);
  };

  const submitKycVerification = async () => {
    if (user.role !== 'businessOwner' || isVerifying) {
      return;
    }

    const cleanKycNumber = kycNumber.replace(/\D/g, '');

    if (cleanKycNumber.length !== 11) {
      setError('Enter an 11-digit BVN or NIN for Flutterwave verification.');
      return;
    }

    if (!idDocumentUri) {
      setError('Upload your BVN/NIN ID document before verification.');
      return;
    }

    try {
      setIsVerifying(true);
      const account = await verifyOwnerVirtualAccount(user, {
        kycType,
        kycNumber: cleanKycNumber,
        idDocumentUri,
        idDocumentName,
      });

      setKycNumber('');
      setIdDocumentUri('');
      setIdDocumentName('');
      setIsReplacingKyc(false);
      setError(null);
      Alert.alert(
        'Withdrawal account verified',
        `${account.kycReference ?? 'Your identity'} is verified for matching-account withdrawals.`,
      );
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Flutterwave could not verify this account right now.',
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const submitWithdrawal = () => {
    if (user.role !== 'businessOwner') {
      return;
    }

    if (!withdrawalAccountVerified) {
      setError('Verify your BVN or NIN with Flutterwave before withdrawal.');
      return;
    }

    const parsedAmount = Number(amount.replace(/,/g, '').trim());

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid withdrawal amount.');
      return;
    }

    if (!accountName.trim()) {
      setError('Enter the bank account name exactly as it appears on the verified BVN/NIN account.');
      return;
    }

    if (parsedAmount > available) {
      setError('Withdrawal amount is higher than your available balance.');
      return;
    }

    try {
      const withdrawal = requestWithdrawal(user, {
        amount: parsedAmount,
        bankName,
        accountNumber,
        accountName,
      });

      setAmount('');
      setBankName('');
      setAccountNumber('');
      setAccountName('');
      setKycNumber('');
      setError(null);
      Alert.alert('Withdrawal paid', `${formatCurrency(withdrawal.amount)} was withdrawn.`);
    } catch (withdrawalError) {
      setError(
        withdrawalError instanceof Error ? withdrawalError.message : 'Unable to withdraw right now.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons color={colors.white} name="cash-outline" size={26} />
        </View>
        <Text style={styles.eyebrow}>Withdrawal</Text>
        <Text style={styles.title}>Send seller earnings to your bank.</Text>
        <Text style={styles.subtitle}>
          Only delivered seller earnings are available for withdrawal.
        </Text>
      </View>

      {user.role !== 'businessOwner' ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>No withdrawal for buyers</Text>
          <Text style={styles.bodyText}>
            Resident portfolios are for buying items only. Withdrawal is available to sellers.
          </Text>
          <AppButton label="Back to profile" onPress={() => navigation.navigate('Account')} />
        </View>
      ) : (
        <>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatCurrency(available)}</Text>
              <Text style={styles.metricLabel}>Available</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatCurrency(withdrawn)}</Text>
              <Text style={styles.metricLabel}>Withdrawn</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>KYC verification</Text>
            {withdrawalAccountVerified && virtualAccount ? (
              <>
                <View style={styles.verifiedRow}>
                  <Ionicons color={colors.success} name="checkmark-circle-outline" size={22} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Flutterwave confirmed</Text>
                    <Text style={styles.rowMeta}>{virtualAccount.kycReference}</Text>
                  </View>
                </View>
                <View style={styles.accountBox}>
                  <Text style={styles.rowMeta}>Verified identity</Text>
                  <Text style={styles.rowTitle}>{virtualAccount.accountName}</Text>
                  <Text style={styles.bodyText}>
                    ID uploaded: {virtualAccount.idDocumentName ?? 'Government ID'}
                  </Text>
                </View>
                <AppButton
                  label="Verify again"
                  onPress={() => {
                    setIsReplacingKyc(true);
                    setError(null);
                  }}
                  variant="secondary"
                />
              </>
            ) : (
              <>
                <View style={styles.warningBox}>
                  <Ionicons color={colors.warning} name="alert-circle-outline" size={22} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>BVN or NIN required</Text>
                    <Text style={styles.rowMeta}>
                      Withdrawal inputs stay locked until Flutterwave confirms your identity.
                    </Text>
                  </View>
                </View>
                <View style={styles.kycToggleRow}>
                  {kycTypeOptions.map((option) => {
                    const isActive = option.value === kycType;

                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        onPress={() => {
                          setKycType(option.value);
                          setError(null);
                        }}
                        style={({ pressed }) => [
                          styles.kycOption,
                          isActive && styles.kycOptionActive,
                          pressed && styles.kycOptionPressed,
                        ]}
                      >
                        <Text style={[styles.kycOptionText, isActive && styles.kycOptionTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  keyboardType="numeric"
                  maxLength={11}
                  onChangeText={(value) => {
                    setKycNumber(value.replace(/\D/g, '').slice(0, 11));
                    setError(null);
                  }}
                  placeholder={`${kycType.toUpperCase()} number`}
                  placeholderTextColor="#8A8A8A"
                  secureTextEntry
                  style={styles.input}
                  value={kycNumber}
                />
                <Text style={styles.secureNote}>
                  The full number is sent to Flutterwave through Supabase only.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void pickIdDocument()}
                  style={({ pressed }) => [
                    styles.uploadBox,
                    idDocumentUri && styles.uploadBoxReady,
                    pressed && styles.kycOptionPressed,
                  ]}
                >
                  <Ionicons
                    color={idDocumentUri ? colors.success : colors.primary}
                    name={idDocumentUri ? 'checkmark-circle-outline' : 'cloud-upload-outline'}
                    size={22}
                  />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      {idDocumentUri ? 'ID document selected' : 'Upload BVN/NIN ID'}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {idDocumentUri
                        ? idDocumentName || 'Government ID selected'
                        : 'Required before Flutterwave verification.'}
                    </Text>
                  </View>
                </Pressable>
                <AppButton
                  disabled={kycNumber.length !== 11 || !idDocumentUri}
                  label="Verify with Flutterwave"
                  loading={isVerifying}
                  onPress={submitKycVerification}
                />
              </>
            )}
            {!withdrawalAccountVerified && error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {withdrawalAccountVerified ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Bank details</Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={(value) => {
                  setAmount(value);
                  setError(null);
                }}
                placeholder="Amount"
                placeholderTextColor="#8A8A8A"
                style={styles.input}
                value={amount}
              />
              <TextInput
                onChangeText={(value) => {
                  setBankName(value);
                  setError(null);
                }}
                placeholder="Bank name"
                placeholderTextColor="#8A8A8A"
                style={styles.input}
                value={bankName}
              />
              <TextInput
                keyboardType="numeric"
                onChangeText={(value) => {
                  setAccountNumber(value);
                  setError(null);
                }}
                placeholder="Account number"
                placeholderTextColor="#8A8A8A"
                style={styles.input}
                value={accountNumber}
              />
              <TextInput
                onChangeText={setAccountName}
                placeholder={`Account name matching ${virtualAccount?.accountName ?? user.fullName}`}
                placeholderTextColor="#8A8A8A"
                style={styles.input}
                value={accountName}
              />
              <Text style={styles.secureNote}>
                The account name must match the Flutterwave-verified BVN/NIN identity. Mismatched
                payout accounts are blocked.
              </Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <AppButton disabled={available <= 0} label="Withdraw now" onPress={submitWithdrawal} />
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent withdrawals</Text>
            <View style={styles.stack}>
              {withdrawals.slice(0, 6).map((withdrawal) => (
                <View key={withdrawal.id} style={styles.row}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{formatCurrency(withdrawal.amount)}</Text>
                    <Text style={styles.rowMeta}>
                      {withdrawal.bankName} - {withdrawal.accountNumber}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {withdrawal.kycReference ?? 'KYC not recorded'}
                    </Text>
                    <Text style={styles.rowMeta}>{formatDateTime(withdrawal.createdAt)}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Paid</Text>
                  </View>
                </View>
              ))}
              {withdrawals.length === 0 ? (
                <Text style={styles.bodyText}>Withdrawals will appear here after payment.</Text>
              ) : null}
            </View>
          </View>
        </>
      )}
    </ScrollView>
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
    heroIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      width: 52,
      borderRadius: 26,
      backgroundColor: colors.secondary,
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
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    metricCard: {
      flex: 1,
      minWidth: 150,
      gap: spacing.xs,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    metricValue: {
      ...typography.subtitle,
      color: colors.primary,
    },
    metricLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    input: {
      minHeight: 50,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.text,
      paddingHorizontal: spacing.md,
      ...typography.body,
    },
    kycToggleRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    kycOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 46,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    kycOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    kycOptionPressed: {
      opacity: 0.82,
    },
    kycOptionText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    kycOptionTextActive: {
      color: colors.white,
    },
    secureNote: {
      ...typography.caption,
      color: colors.textMuted,
    },
    uploadBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 74,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    uploadBoxReady: {
      borderColor: colors.success,
      backgroundColor: colors.primarySoft,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: spacing.md,
    },
    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radii.lg,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.success,
      padding: spacing.md,
    },
    accountBox: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    stack: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    rowCopy: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    rowMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    badge: {
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    badgeText: {
      ...typography.caption,
      color: colors.white,
    },
  });
}
