import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { FlutterwaveCheckoutModal } from '../components/FlutterwaveCheckoutModal';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { CartScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { Order, PaymentMethod } from '../types/business';
import { formatCurrency } from '../utils/format';
import { getPaymentMethodLabel } from '../utils/order';
import { getAccountWalletBalance } from '../utils/wallet';

const launchPaymentMethods: PaymentMethod[] = ['flutterwave', 'walletAccount'];

type FlutterwaveChannelId = 'card' | 'bank';

const flutterwaveChannels: Array<{
  id: FlutterwaveChannelId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  paymentOptions: string[];
  subtitle: string;
}> = [
  {
    id: 'card',
    label: 'Card',
    icon: 'card-outline',
    paymentOptions: ['card'],
    subtitle: 'Pay with debit or credit card',
  },
  {
    id: 'bank',
    label: 'Bank',
    icon: 'business-outline',
    paymentOptions: ['account', 'banktransfer'],
    subtitle: 'Pay by bank transfer',
  },
];

type ActiveFlutterwaveCheckout = {
  checkoutUrl: string;
  order: Order;
  reference: string;
  title: string;
  subtitle: string;
  channelLabel: string;
};

export function CartScreen({ navigation }: CartScreenProps) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    cartEntries,
    cartTotal,
    checkoutCart,
    clearCart,
    completeCartFlutterwaveCheckout,
    dynamicDepositAccounts,
    estates,
    getAvailableStock,
    getOrdersForUser,
    isBusinessOwnedByUser,
    removeFromCart,
    securitySettings,
    startCartFlutterwaveCheckout,
    subscriptionPayments,
    updateCartQuantity,
  } = useBusinessDirectory();
  const defaultCluster = cartEntries[0]?.business.cluster ?? estates[0]?.clusters[0] ?? 'Cluster 1';
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCluster, setDeliveryCluster] = useState(defaultCluster);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('flutterwave');
  const [flutterwaveChannel, setFlutterwaveChannel] = useState<FlutterwaveChannelId>('card');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFlutterwaveCheckout, setActiveFlutterwaveCheckout] =
    useState<ActiveFlutterwaveCheckout | null>(null);
  const selectedFlutterwaveChannel =
    flutterwaveChannels.find((channel) => channel.id === flutterwaveChannel) ??
    flutterwaveChannels[0]!;

  useEffect(() => {
    if (!deliveryCluster.trim()) {
      setDeliveryCluster(defaultCluster);
    }
  }, [defaultCluster, deliveryCluster]);

  const deliveryFee = cartEntries.length === 0 ? 0 : cartTotal >= 20000 ? 0 : 2000;
  const orderTotal = cartTotal + deliveryFee;
  const walletBalance = user
    ? getAccountWalletBalance(
        user,
        getOrdersForUser(user.id),
        subscriptionPayments.filter((payment) => payment.ownerUserId === user.id),
        dynamicDepositAccounts.filter((deposit) => deposit.userId === user.id),
      )
    : 0;
  const insufficientFunds = paymentMethod === 'walletAccount' && Boolean(user && orderTotal > walletBalance);
  const checkoutBlocked = securitySettings.maintenanceMode || securitySettings.blockCheckout;
  const selfOwnedEntries = useMemo(
    () =>
      user?.role === 'businessOwner'
        ? cartEntries.filter((entry) => isBusinessOwnedByUser(entry.business, user))
        : [],
    [cartEntries, isBusinessOwnedByUser, user],
  );
  const selfOwnedNames = selfOwnedEntries.map((entry) => entry.business.name);
  const estateClusters = estates[0]?.clusters ?? [];
  const supportMessage = securitySettings.maintenanceMode
    ? 'Checkout is paused while the marketplace is in maintenance mode.'
    : securitySettings.blockCheckout
      ? 'Checkout is currently paused by the owner.'
      : null;
  const stockWarnings = useMemo(
    () =>
      cartEntries
        .filter((entry) => entry.quantity > getAvailableStock(entry.business.id))
        .map((entry) => entry.business.name),
    [cartEntries, getAvailableStock],
  );

  const handleCheckout = async () => {
    if (!user) {
      setError('You need to sign in before paying.');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError('Add the delivery address before paying.');
      return;
    }

    if (!deliveryCluster.trim()) {
      setError('Choose the delivery cluster before placing the order.');
      return;
    }

    if (stockWarnings.length > 0) {
      setError(`${stockWarnings.join(', ')} needs a quantity update before checkout.`);
      return;
    }

    if (selfOwnedEntries.length > 0) {
      setError(`${selfOwnedNames.join(', ')} is your own listing. Business owners cannot buy items they sell.`);
      return;
    }

    if (paymentMethod === 'walletAccount' && orderTotal > walletBalance) {
      setError(
        `Your portfolio balance is ${formatCurrency(walletBalance)}. Add funds before paying ${formatCurrency(orderTotal)}.`,
      );
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);
      if (paymentMethod === 'flutterwave') {
        const checkout = await startCartFlutterwaveCheckout(
          {
            deliveryAddress,
            deliveryCluster,
            note,
          },
          user,
          selectedFlutterwaveChannel.paymentOptions,
        );

        setActiveFlutterwaveCheckout({
          checkoutUrl: checkout.checkoutUrl,
          order: checkout.order,
          reference: checkout.reference,
          title: 'Order checkout',
          subtitle: `Pay ${formatCurrency(checkout.amount)} with ${selectedFlutterwaveChannel.label}.`,
          channelLabel: selectedFlutterwaveChannel.label,
        });
        return;
      }

      const order = checkoutCart(
        {
          deliveryAddress,
          deliveryCluster,
          note,
          paymentMethod,
        },
        user,
      );
      navigation.navigate('OrderDetails', { orderId: order.id });
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error ? checkoutError.message : 'Unable to complete payment right now.';
      setError(message);
      Alert.alert('Payment paused', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeFlutterwaveCheckout = () => {
    setActiveFlutterwaveCheckout(null);
  };

  const handleFlutterwaveReturn = () => {
    const checkout = activeFlutterwaveCheckout;

    if (!checkout) {
      return;
    }

    try {
      const order = completeCartFlutterwaveCheckout(checkout.order, user);
      setActiveFlutterwaveCheckout(null);
      Alert.alert(
        'Payment confirmed',
        `Flutterwave confirmed your ${checkout.channelLabel} payment. Your receipt has been created.`,
      );
      navigation.navigate('OrderDetails', { orderId: order.id });
    } catch (paymentError) {
      const message =
        paymentError instanceof Error
          ? paymentError.message
          : 'Flutterwave payment could not be confirmed.';
      setError(message);
      setActiveFlutterwaveCheckout(null);
      Alert.alert('Payment not completed', message);
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <Text style={styles.eyebrow}>Wallet payment</Text>
        <Text style={styles.title}>Pay immediately from your account.</Text>
        <Text style={styles.subtitle}>
          Pay through Flutterwave live checkout, or use your UrbanConnect account balance when it has enough funds.
        </Text>
      </View>

      {cartEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your cart is empty.</Text>
          <Text style={styles.emptyText}>
            Add products from the marketplace and they will appear here with live stock.
          </Text>
          <AppButton
            label="Back to marketplace"
            onPress={() => navigation.navigate('Dashboard')}
            variant="secondary"
          />
        </View>
      ) : (
        <>
          {supportMessage ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Checkout temporarily paused</Text>
              <Text style={styles.noticeText}>{supportMessage}</Text>
            </View>
          ) : null}

          {stockWarnings.length > 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Stock changed</Text>
              <Text style={styles.noticeText}>
                Adjust the quantities for {stockWarnings.join(', ')} before placing the order.
              </Text>
            </View>
          ) : null}

          {selfOwnedEntries.length > 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Own listing in cart</Text>
              <Text style={styles.noticeText}>
                Remove {selfOwnedNames.join(', ')} before paying. Business owners cannot buy items they sell.
              </Text>
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Items in cart</Text>
              <Text style={styles.summaryValue}>{cartEntries.length}</Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Cart subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(cartTotal)}</Text>
            </View>
            <AppButton label="Clear cart" onPress={clearCart} variant="ghost" />
          </View>

          <View style={styles.listStack}>
            {cartEntries.map((entry) => {
              const availableStock = getAvailableStock(entry.business.id);
              const isLowStock = availableStock <= Math.max(1, entry.business.reorderLevel ?? 0);

              return (
                <View key={entry.business.id} style={styles.cartCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.copyBlock}>
                      <Text style={styles.itemTitle}>{entry.business.name}</Text>
                      <Text style={styles.itemMeta}>
                        {entry.business.ownerName} - {entry.business.cluster}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {formatCurrency(entry.business.price)} each
                      </Text>
                    </View>
                    <View style={styles.amountShell}>
                      <Text style={styles.amountText}>{formatCurrency(entry.lineTotal)}</Text>
                    </View>
                  </View>

                  <View style={styles.stockRow}>
                    <View
                      style={[
                        styles.stockPill,
                        availableStock === 0 && styles.stockPillDanger,
                        availableStock > 0 && isLowStock && styles.stockPillWarning,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stockText,
                          (availableStock === 0 || isLowStock) && styles.stockTextInverted,
                        ]}
                      >
                        {availableStock === 0
                          ? 'Out of stock'
                          : isLowStock
                            ? `${availableStock} left`
                            : `${availableStock} ready`}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('BusinessDetails', { businessId: entry.business.id })
                      }
                      style={({ pressed }) => [styles.inlineLink, pressed && styles.inlineLinkPressed]}
                    >
                      <Text style={styles.inlineLinkText}>Open listing</Text>
                    </Pressable>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <View style={styles.quantityRow}>
                      <Pressable
                        onPress={() => updateCartQuantity(entry.business.id, entry.quantity - 1)}
                        style={({ pressed }) => [
                          styles.quantityButton,
                          pressed && styles.quantityButtonPressed,
                        ]}
                      >
                        <Ionicons color={colors.primary} name="remove" size={18} />
                      </Pressable>
                      <Text style={styles.quantityValue}>{entry.quantity}</Text>
                      <Pressable
                        onPress={() => updateCartQuantity(entry.business.id, entry.quantity + 1)}
                        style={({ pressed }) => [
                          styles.quantityButton,
                          pressed && styles.quantityButtonPressed,
                        ]}
                      >
                        <Ionicons color={colors.primary} name="add" size={18} />
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => removeFromCart(entry.business.id)}
                      style={({ pressed }) => [styles.removeLink, pressed && styles.removeLinkPressed]}
                    >
                      <Text style={styles.removeLinkText}>Remove item</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.checkoutCard}>
            <Text style={styles.sectionTitle}>Delivery details</Text>
            <FormField
              helper="Use the exact apartment or drop-off note for the rider."
              label="Delivery address"
              multiline
              onChangeText={(value) => {
                setDeliveryAddress(value);
                setError(null);
              }}
              placeholder="House 14, Cluster 3, River Park Estate"
              value={deliveryAddress}
            />

            <View style={styles.clusterWrap}>
              {estateClusters.map((cluster) => {
                const isActive = cluster === deliveryCluster;

                return (
                  <Pressable
                    key={cluster}
                    onPress={() => {
                      setDeliveryCluster(cluster);
                      setError(null);
                    }}
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

            <FormField
              helper="Optional instructions for delivery, gate access, or substitutions."
              label="Order note"
              multiline
              onChangeText={(value) => {
                setNote(value);
                setError(null);
              }}
              placeholder="Call on arrival and leave with security if unavailable."
              value={note}
            />
          </View>

          <View style={styles.checkoutCard}>
            <Text style={styles.sectionTitle}>Payment account</Text>
            <View style={styles.paymentWrap}>
              {launchPaymentMethods.map((method) => {
                const isActive = method === paymentMethod;
                const methodCopy =
                  method === 'flutterwave'
                    ? 'Open Flutterwave to pay with card or bank transfer.'
                    : 'Use your UrbanConnect account balance to pay now.';

                return (
                  <Pressable
                    key={method}
                    onPress={() => {
                      setPaymentMethod(method);
                      setError(null);
                    }}
                    style={({ pressed }) => [
                      styles.paymentCard,
                      isActive && styles.paymentCardActive,
                      pressed && styles.paymentCardPressed,
                    ]}
                  >
                    <Text style={[styles.paymentTitle, isActive && styles.paymentTitleActive]}>
                      {getPaymentMethodLabel(method)}
                    </Text>
                    <Text style={[styles.paymentMeta, isActive && styles.paymentMetaActive]}>
                      {methodCopy} Seller money remains pending until customer care verifies warehouse arrival.
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {paymentMethod === 'flutterwave' ? (
              <View style={styles.flutterwaveChannelGrid}>
                {flutterwaveChannels.map((channel) => {
                  const isActive = channel.id === flutterwaveChannel;

                  return (
                    <Pressable
                      key={channel.id}
                      onPress={() => {
                        setFlutterwaveChannel(channel.id);
                        setError(null);
                      }}
                      style={({ pressed }) => [
                        styles.flutterwaveChannelChip,
                        isActive && styles.flutterwaveChannelChipActive,
                        pressed && styles.flutterwaveChannelChipPressed,
                      ]}
                    >
                      <Ionicons
                        color={isActive ? colors.white : colors.primary}
                        name={channel.icon}
                        size={18}
                      />
                      <Text
                        style={[
                          styles.flutterwaveChannelTitle,
                          isActive && styles.flutterwaveChannelTitleActive,
                        ]}
                      >
                        {channel.label}
                      </Text>
                      <Text
                        style={[
                          styles.flutterwaveChannelMeta,
                          isActive && styles.flutterwaveChannelMetaActive,
                        ]}
                      >
                        {channel.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.checkoutCard}>
            <Text style={styles.sectionTitle}>Order summary</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {paymentMethod === 'flutterwave' ? 'Flutterwave options' : 'Portfolio balance'}
              </Text>
              <Text style={styles.totalValue}>
                {paymentMethod === 'flutterwave'
                  ? selectedFlutterwaveChannel.label
                  : formatCurrency(walletBalance)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(cartTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery</Text>
              <Text style={styles.totalValue}>
                {deliveryFee === 0 ? 'Free' : formatCurrency(deliveryFee)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowStrong]}>
              <Text style={styles.totalLabelStrong}>Total</Text>
              <Text style={styles.totalValueStrong}>{formatCurrency(orderTotal)}</Text>
            </View>

            {insufficientFunds ? (
              <Text style={styles.errorText}>
                Add funds to your portfolio before paying this order.
              </Text>
            ) : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.actionStack}>
              <AppButton
                disabled={
                  checkoutBlocked ||
                  stockWarnings.length > 0 ||
                  insufficientFunds ||
                  selfOwnedEntries.length > 0
                }
                label="Pay immediately"
                loading={isSubmitting}
                onPress={() => void handleCheckout()}
              />
              <AppButton
                label="Continue shopping"
                onPress={() => navigation.navigate('Dashboard')}
                variant="secondary"
              />
              <AppButton label="Back" onPress={() => navigation.goBack()} variant="ghost" />
            </View>
          </View>
        </>
      )}
    </ScrollView>
    {activeFlutterwaveCheckout ? (
      <FlutterwaveCheckoutModal
        key={activeFlutterwaveCheckout.checkoutUrl}
        activePaymentLabel={activeFlutterwaveCheckout.channelLabel}
        checkoutUrl={activeFlutterwaveCheckout.checkoutUrl}
        onClose={closeFlutterwaveCheckout}
        onPaymentReturn={handleFlutterwaveReturn}
        reference={activeFlutterwaveCheckout.reference}
        subtitle={activeFlutterwaveCheckout.subtitle}
        title={activeFlutterwaveCheckout.title}
        visible
      />
    ) : null}
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
      top: -32,
      right: -8,
      height: 138,
      width: 138,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.28)',
    },
    heroGlowTwo: {
      position: 'absolute',
      bottom: -44,
      left: -18,
      height: 160,
      width: 160,
      borderRadius: 999,
      backgroundColor: 'rgba(58, 144, 158, 0.24)',
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
      maxWidth: 720,
    },
    emptyState: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      ...shadows.soft,
    },
    emptyTitle: {
      ...typography.section,
      color: colors.text,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    noticeCard: {
      gap: spacing.xs,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    noticeTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    noticeText: {
      ...typography.body,
      color: colors.textMuted,
    },
    summaryCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.primarySoft,
      padding: spacing.lg,
      ...shadows.soft,
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.primary,
    },
    summaryValue: {
      ...typography.title,
      color: colors.primary,
    },
    listStack: {
      gap: spacing.md,
    },
    cartCard: {
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    cardTopRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    copyBlock: {
      flex: 1,
      gap: 4,
      minWidth: 220,
    },
    itemTitle: {
      ...typography.subtitle,
      color: colors.text,
    },
    itemMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    amountShell: {
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    amountText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    stockRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    stockPill: {
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    stockPillWarning: {
      backgroundColor: '#7A7A7A',
    },
    stockPillDanger: {
      backgroundColor: colors.danger,
    },
    stockText: {
      ...typography.caption,
      color: colors.primary,
    },
    stockTextInverted: {
      color: colors.white,
    },
    inlineLink: {
      alignSelf: 'flex-start',
    },
    inlineLinkPressed: {
      opacity: 0.82,
    },
    inlineLinkText: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    cardBottomRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    quantityButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      width: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quantityButtonPressed: {
      opacity: 0.92,
    },
    quantityValue: {
      ...typography.bodyStrong,
      color: colors.text,
      minWidth: 24,
      textAlign: 'center',
    },
    removeLink: {
      alignSelf: 'flex-start',
    },
    removeLinkPressed: {
      opacity: 0.82,
    },
    removeLinkText: {
      ...typography.bodyStrong,
      color: colors.danger,
    },
    checkoutCard: {
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
    clusterWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    clusterChip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
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
    paymentWrap: {
      gap: spacing.sm,
    },
    paymentCard: {
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    paymentCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    paymentCardPressed: {
      opacity: 0.92,
    },
    paymentTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    paymentTitleActive: {
      color: colors.primary,
    },
    paymentMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    paymentMetaActive: {
      color: colors.primary,
    },
    flutterwaveChannelGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    flutterwaveChannelChip: {
      flex: 1,
      minWidth: 112,
      minHeight: 92,
      justifyContent: 'center',
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    flutterwaveChannelChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    flutterwaveChannelChipPressed: {
      opacity: 0.92,
    },
    flutterwaveChannelTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    flutterwaveChannelTitleActive: {
      color: colors.white,
    },
    flutterwaveChannelMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    flutterwaveChannelMetaActive: {
      color: colors.white,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
    },
    totalRowStrong: {
      backgroundColor: colors.primarySoft,
    },
    totalLabel: {
      ...typography.body,
      color: colors.textMuted,
    },
    totalValue: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    totalLabelStrong: {
      ...typography.bodyStrong,
      color: colors.primary,
    },
    totalValueStrong: {
      ...typography.subtitle,
      color: colors.primary,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    actionStack: {
      gap: spacing.sm,
    },
  });
}
