import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { FlutterwaveCheckoutModal } from '../components/FlutterwaveCheckoutModal';
import { FormField } from '../components/FormField';
import { estates } from '../data/estates';
import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type {
  Business,
  Order,
} from '../types/business';
import { getBusinessStatusLabel, isPublicBusiness } from '../utils/businessState';
import {
  DYNAMIC_DEPOSIT_EXPIRY_MINUTES,
  MINIMUM_ADD_FUNDS_DEPOSIT,
  getDepositStatusLabel,
} from '../utils/deposits';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format';
import { getOrderStatusLabel, getPaymentStatusLabel } from '../utils/order';
import {
  getAccountStartingBalance,
  getAccountWalletBalance,
  getBuyerWalletSpent,
} from '../utils/wallet';

type ListingView = 'product' | 'profession';
type DepositStep = 'amount' | 'instructions' | 'details';
type DepositPaymentChannelId = 'card' | 'bank';

const depositFlutterwaveChannels: Array<{
  id: DepositPaymentChannelId;
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
  reference: string;
  title: string;
  subtitle: string;
  channelLabel: string;
};

type ListingEditForm = {
  name: string;
  price: string;
  shortDescription: string;
  longDescription: string;
  stockQuantity: string;
  reorderLevel: string;
};

function isOrderOpen(status: string) {
  return status !== 'delivered' && status !== 'cancelled';
}

function isWarehouseReleased(status: string) {
  return status === 'delivered';
}

function createListingEditForm(business: Business): ListingEditForm {
  return {
    name: business.name,
    price: business.listingType === 'product' ? String(business.price || '') : '',
    shortDescription: business.description,
    longDescription: business.longDescription,
    stockQuantity:
      business.listingType === 'product' ? String(business.stockQuantity ?? 0) : '',
    reorderLevel:
      business.listingType === 'product' ? String(business.reorderLevel ?? 1) : '',
  };
}

export function AccountScreen({ navigation }: MainTabsScreenProps<'Account'>) {
  const { signOut, user } = useAuth();
  const {
    businesses,
    cartCount,
    createDynamicDepositAccount,
    deleteBusiness,
    getAvailableStock,
    getDepositAccountsForUser,
    getOwnerBusinessProfile,
    getOrdersForOwner,
    getOrdersForUser,
    getWithdrawalsForOwner,
    isRiverParkVerifiedForUser,
    startAddFundsFlutterwaveCheckout,
    subscriptionPayments,
    updateBusinessListing,
  } = useBusinessDirectory();
  const { colors, isDarkMode } = useAppTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const portfolioInkColor = isDarkMode ? '#092E23' : colors.white;
  const estate = estates.find((item) => item.id === user?.estateId);
  const [listingView, setListingView] = useState<ListingView>('product');
  const [editingListing, setEditingListing] = useState<Business | null>(null);
  const [listingEditForm, setListingEditForm] = useState<ListingEditForm | null>(null);
  const [listingEditError, setListingEditError] = useState<string | null>(null);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositStep, setDepositStep] = useState<DepositStep>('amount');
  const [depositPaymentChannel, setDepositPaymentChannel] =
    useState<DepositPaymentChannelId>('card');
  const [depositInstructionsAccepted, setDepositInstructionsAccepted] = useState(false);
  const [generatedDepositAccountId, setGeneratedDepositAccountId] = useState<string | null>(null);
  const [isCreatingDepositAccount, setIsCreatingDepositAccount] = useState(false);
  const [activeFlutterwaveCheckout, setActiveFlutterwaveCheckout] =
    useState<ActiveFlutterwaveCheckout | null>(null);
  const profileCarouselCardWidth = Math.min(Math.max(width - spacing.lg * 2, 300), 720);
  const selectedDepositPaymentChannel =
    depositFlutterwaveChannels.find((channel) => channel.id === depositPaymentChannel) ??
    depositFlutterwaveChannels[0]!;
  const savedOwnerProfile = useMemo(
    () => getOwnerBusinessProfile(user),
    [getOwnerBusinessProfile, user],
  );
  const ownerKeys = useMemo(
    () =>
      [
        user?.id,
        user?.email,
        user?.fullName,
        user?.businessName,
        savedOwnerProfile?.accountEmail,
        savedOwnerProfile?.email,
        savedOwnerProfile?.accountName,
        savedOwnerProfile?.ownerName,
      ]
        .map((key) => key?.trim().toLowerCase())
        .filter((key): key is string => Boolean(key)),
    [
      savedOwnerProfile?.accountEmail,
      savedOwnerProfile?.accountName,
      savedOwnerProfile?.email,
      savedOwnerProfile?.ownerName,
      user?.businessName,
      user?.email,
      user?.fullName,
      user?.id,
    ],
  );
  const matchesOwner = (business: Business) =>
    [business.ownerUserId, business.ownerEmail, business.ownerName]
      .map((key) => key?.trim().toLowerCase())
      .some((key) => Boolean(key && ownerKeys.includes(key)));

  const ownerListings = useMemo(
    () => businesses.filter(matchesOwner),
    [businesses, ownerKeys],
  );
  const visibleOwnerListings = useMemo(
    () => ownerListings.filter((business) => (business.status ?? 'active') !== 'archived'),
    [ownerListings],
  );
  const productListings = useMemo(
    () =>
      ownerListings.filter(
        (business) => business.listingType === 'product' && isPublicBusiness(business),
      ),
    [ownerListings],
  );
  const lowStockListings = useMemo(
    () =>
      productListings.filter(
        (business) => getAvailableStock(business.id) <= Math.max(1, business.reorderLevel ?? 0),
      ),
    [getAvailableStock, productListings],
  );
  const residentOrders = useMemo(
    () => (user ? getOrdersForUser(user.id) : []),
    [getOrdersForUser, user],
  );
  const ownerOrders = useMemo(
    () => (user ? getOrdersForOwner(user.id, user) : []),
    [getOrdersForOwner, user],
  );
  const ownerWithdrawals = useMemo(
    () => (user?.role === 'businessOwner' ? getWithdrawalsForOwner(user.id) : []),
    [getWithdrawalsForOwner, user],
  );
  const depositAccounts = useMemo(
    () => (user ? getDepositAccountsForUser(user.id) : []),
    [getDepositAccountsForUser, user],
  );
  const generatedDepositAccount = useMemo(
    () =>
      generatedDepositAccountId
        ? depositAccounts.find((deposit) => deposit.id === generatedDepositAccountId)
        : undefined,
    [depositAccounts, generatedDepositAccountId],
  );
  const enteredDepositAmount = Number(depositAmount.replace(/,/g, '').trim());
  const depositDisplayAmount =
    generatedDepositAccount?.amount ??
    (Number.isFinite(enteredDepositAmount) && enteredDepositAmount > 0 ? enteredDepositAmount : 0);
  const buyerSpent = useMemo(() => getBuyerWalletSpent(residentOrders), [residentOrders]);
  const accountStartingBalance = useMemo(() => getAccountStartingBalance(user), [user]);
  const ownerSubscriptionPayments = useMemo(
    () =>
      user ? subscriptionPayments.filter((payment) => payment.ownerUserId === user.id) : [],
    [subscriptionPayments, user],
  );
  const buyerBalance = useMemo(
    () => getAccountWalletBalance(user, residentOrders, ownerSubscriptionPayments, depositAccounts),
    [depositAccounts, ownerSubscriptionPayments, residentOrders, user],
  );
  const ownerPortfolio = useMemo(() => {
    const totals = ownerOrders.reduce(
      (currentTotals, order) => {
        if (order.status === 'cancelled' || order.paymentStatus === 'refunded') {
          return currentTotals;
        }

        const ownerValue = order.items
          .filter((item) =>
            [item.ownerUserId, item.ownerName]
              .map((key) => key?.trim().toLowerCase())
              .some((key) => Boolean(key && ownerKeys.includes(key))),
          )
          .reduce((total, item) => total + item.lineTotal, 0);

        if (order.paymentStatus === 'paid' && isWarehouseReleased(order.status)) {
          currentTotals.available += ownerValue;
        } else if (order.paymentStatus === 'paid') {
          currentTotals.pending += ownerValue;
        }

        currentTotals.total += ownerValue;
        return currentTotals;
      },
      { available: 0, pending: 0, total: 0 },
    );
    const withdrawn = ownerWithdrawals.reduce(
      (total, withdrawal) => total + withdrawal.amount,
      0,
    );

    return {
      ...totals,
      withdrawn,
      available: Math.max(0, totals.available - withdrawn),
    };
  }, [ownerKeys, ownerOrders, ownerWithdrawals]);
  const confirmDeleteListing = (business: Business) => {
    if (!user) {
      return;
    }

    Alert.alert(
      'Delete listing',
      `${business.name} will be removed from your active listings and hidden from the marketplace.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBusiness(business.id, user.fullName, 'owner'),
        },
      ],
    );
  };

  const openListingEditor = (business: Business) => {
    setEditingListing(business);
    setListingEditForm(createListingEditForm(business));
    setListingEditError(null);
  };

  const openListingMenu = (business: Business) => {
    Alert.alert(business.name, 'Manage this listing.', [
      {
        text: 'View',
        onPress: () => navigation.navigate('BusinessDetails', { businessId: business.id }),
      },
      {
        text: 'Edit listing',
        onPress: () => openListingEditor(business),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteListing(business),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const updateListingEditField = (field: keyof ListingEditForm, value: string) => {
    setListingEditForm((currentForm) =>
      currentForm ? { ...currentForm, [field]: value } : currentForm,
    );
    setListingEditError(null);
  };

  const closeListingEditor = () => {
    setEditingListing(null);
    setListingEditForm(null);
    setListingEditError(null);
  };

  const openDepositModal = () => {
    if (isCreatingDepositAccount) {
      return;
    }

    setDepositModalVisible(true);
    setDepositAmount('');
    setDepositError(null);
    setDepositStep('amount');
    setDepositInstructionsAccepted(false);
    setGeneratedDepositAccountId(null);
    setActiveFlutterwaveCheckout(null);
  };

  const closeDepositModal = () => {
    if (isCreatingDepositAccount) {
      return;
    }

    setDepositModalVisible(false);
    setDepositAmount('');
    setDepositError(null);
    setDepositStep('amount');
    setDepositInstructionsAccepted(false);
    setGeneratedDepositAccountId(null);
    setActiveFlutterwaveCheckout(null);
  };

  const handleDepositBack = () => {
    if (isCreatingDepositAccount) {
      return;
    }

    if (depositStep === 'details') {
      setDepositStep('instructions');
      return;
    }

    if (depositStep === 'instructions') {
      setDepositStep('amount');
      return;
    }

    closeDepositModal();
  };

  const handleCreateDepositAccount = async () => {
    if (!user || isCreatingDepositAccount) {
      return;
    }

    const amount = Math.floor(Number(depositAmount.replace(/,/g, '').trim()));

    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositError('Enter a valid amount before generating an account.');
      return;
    }

    if (amount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
      setDepositError(
        `Add funds must be higher than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)}.`,
      );
      return;
    }

    try {
      setIsCreatingDepositAccount(true);
      const deposit = await createDynamicDepositAccount(user, amount);
      setGeneratedDepositAccountId(deposit.id);
      setDepositStep('instructions');
      setDepositInstructionsAccepted(false);
      setDepositAmount('');
      setDepositError(null);
    } catch (error) {
      setDepositError(
        error instanceof Error ? error.message : 'Flutterwave could not create a deposit account.',
      );
    } finally {
      setIsCreatingDepositAccount(false);
    }
  };

  const handleStartFlutterwaveDeposit = async (
    channel = selectedDepositPaymentChannel,
  ) => {
    if (!user || isCreatingDepositAccount) {
      return;
    }

    setDepositPaymentChannel(channel.id);
    const amount = Math.floor(Number(depositAmount.replace(/,/g, '').trim()));

    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositError(
        `Enter an amount higher than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)} before opening ${channel.label}.`,
      );
      return;
    }

    if (amount <= MINIMUM_ADD_FUNDS_DEPOSIT) {
      setDepositError(
        `Add funds must be higher than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)}.`,
      );
      return;
    }

    try {
      setIsCreatingDepositAccount(true);
      const checkout = await startAddFundsFlutterwaveCheckout(
        user,
        amount,
        channel.paymentOptions,
      );
      setGeneratedDepositAccountId(checkout.deposit.id);
      setDepositAmount('');
      setDepositError(null);
      setActiveFlutterwaveCheckout({
        checkoutUrl: checkout.checkoutUrl,
        reference: checkout.reference,
        title: 'Add funds checkout',
        subtitle: `Pay ${formatCurrency(checkout.amount)} with ${channel.label}.`,
        channelLabel: channel.label,
      });
    } catch (error) {
      setDepositError(
        error instanceof Error ? error.message : 'Flutterwave could not open checkout.',
      );
    } finally {
      setIsCreatingDepositAccount(false);
    }
  };

  const handleCloseFlutterwaveCheckout = () => {
    setActiveFlutterwaveCheckout(null);
  };

  const handleFlutterwaveReturn = () => {
    setActiveFlutterwaveCheckout(null);
    setDepositModalVisible(false);
    Alert.alert(
      'Payment submitted',
      `Flutterwave will update your portfolio after the live ${activeFlutterwaveCheckout?.channelLabel ?? 'payment'} payment is confirmed.`,
    );
  };

  const copyDepositDetail = async (label: string, value?: string) => {
    const cleanValue = value?.trim();

    if (!cleanValue) {
      return;
    }

    await Clipboard.setStringAsync(cleanValue);
    Alert.alert(`${label} copied`, cleanValue);
  };

  const handleDepositHelp = () => {
    Alert.alert(
      'Deposit help',
      `Generate a Flutterwave account for more than ${formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)}, transfer only the exact amount shown, and wait for Flutterwave confirmation. If no transfer is detected within ${DYNAMIC_DEPOSIT_EXPIRY_MINUTES} minutes, the deposit shows Failed.`,
    );
  };

  const handleSaveListing = () => {
    if (!editingListing || !listingEditForm || !user || isSavingListing) {
      return;
    }

    const isProduct = editingListing.listingType === 'product';
    const price = Number.parseFloat(listingEditForm.price);
    const stockQuantity = Number.parseInt(listingEditForm.stockQuantity, 10);
    const reorderLevel = Number.parseInt(listingEditForm.reorderLevel, 10);

    if (!listingEditForm.name.trim()) {
      setListingEditError('Add the listing name before saving.');
      return;
    }

    if (!listingEditForm.shortDescription.trim()) {
      setListingEditError('Add the short description before saving.');
      return;
    }

    if (!listingEditForm.longDescription.trim()) {
      setListingEditError('Add the detailed description before saving.');
      return;
    }

    if (isProduct && (!Number.isFinite(price) || price <= 0)) {
      setListingEditError('Add a valid item price before saving.');
      return;
    }

    if (isProduct && (!Number.isFinite(stockQuantity) || stockQuantity < 0)) {
      setListingEditError('Add a valid stock quantity before saving.');
      return;
    }

    if (isProduct && (!Number.isFinite(reorderLevel) || reorderLevel <= 0)) {
      setListingEditError('Add a valid reorder level before saving.');
      return;
    }

    try {
      setIsSavingListing(true);
      updateBusinessListing(
        editingListing.id,
        {
          name: listingEditForm.name,
          description: listingEditForm.shortDescription,
          longDescription: listingEditForm.longDescription,
          ...(isProduct
            ? {
                price,
                stockQuantity,
                reorderLevel,
              }
            : {}),
        },
        user,
      );
      Alert.alert('Listing updated', `${listingEditForm.name.trim()} was saved.`);
      closeListingEditor();
    } catch (error) {
      setListingEditError(
        error instanceof Error ? error.message : 'This listing could not be saved right now.',
      );
    } finally {
      setIsSavingListing(false);
    }
  };

  const riverParkVerified = isRiverParkVerifiedForUser(user);
  const selectedOwnerListings = visibleOwnerListings.filter((business) =>
    listingView === 'product'
      ? business.listingType === 'product'
      : business.listingType === 'profession',
  );

  if (!user) {
    return null;
  }

  const isBusinessOwner = user.role === 'businessOwner';
  const residentActiveOrders = residentOrders.filter((order) => isOrderOpen(order.status));
  const ownerOpenOrders = ownerOrders.filter((order) => isOrderOpen(order.status));
  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ScrollView
          decelerationRate="fast"
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={profileCarouselCardWidth + spacing.md}
          style={styles.profileCarousel}
          contentContainerStyle={styles.profileCarouselTrack}
        >
        <View
          style={[
            styles.hero,
            styles.profileCarouselCard,
            !isBusinessOwner && styles.userCarouselCard,
            styles.portfolioHero,
            { width: profileCarouselCardWidth },
          ]}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.cardHeaderRow}>
            <View style={styles.itemCopy}>
              <Text style={[styles.eyebrow, isDarkMode && styles.portfolioEyebrowDark]}>
                Portfolio
              </Text>
              <Text style={[styles.title, isDarkMode && styles.portfolioTitleDark]}>
                Wallet and balance
              </Text>
            </View>
            {isBusinessOwner ? (
              <Pressable
                onPress={() => navigation.navigate('Withdrawal')}
                style={({ pressed }) => [
                  styles.portfolioIconShell,
                  pressed && styles.itemRowPressed,
                ]}
              >
                <Ionicons color={portfolioInkColor} name="ellipsis-horizontal" size={22} />
              </Pressable>
            ) : (
              <View style={[styles.portfolioIconShell, styles.portfolioIconShellDisabled]}>
                <Ionicons color={portfolioInkColor} name="wallet-outline" size={22} />
              </View>
            )}
          </View>

          <View style={styles.portfolioGrid}>
            <View style={styles.portfolioMetricDark}>
              <Text style={[styles.portfolioValueDark, isDarkMode && styles.portfolioValueDarkReadable]}>
                {formatCurrency(buyerBalance)}
              </Text>
              <Text style={[styles.portfolioLabelDark, isDarkMode && styles.portfolioLabelDarkReadable]}>
                Account balance
              </Text>
            </View>
            {isBusinessOwner ? (
              <>
                <View style={styles.portfolioMetricDark}>
                  <Text style={[styles.portfolioValueDark, isDarkMode && styles.portfolioValueDarkReadable]}>
                    {formatCurrency(ownerPortfolio.pending)}
                  </Text>
                  <Text style={[styles.portfolioLabelDark, isDarkMode && styles.portfolioLabelDarkReadable]}>
                    Pending
                  </Text>
                </View>
                <View style={styles.portfolioMetricDark}>
                  <Text style={[styles.portfolioValueDark, isDarkMode && styles.portfolioValueDarkReadable]}>
                    {formatCurrency(ownerPortfolio.withdrawn)}
                  </Text>
                  <Text style={[styles.portfolioLabelDark, isDarkMode && styles.portfolioLabelDarkReadable]}>
                    Withdrawal
                  </Text>
                </View>
              </>
            ) : null}
            <View style={styles.portfolioMetricDark}>
              <Text style={[styles.portfolioValueDark, isDarkMode && styles.portfolioValueDarkReadable]}>
                {formatCurrency(isBusinessOwner ? ownerPortfolio.total : buyerSpent)}
              </Text>
              <Text style={[styles.portfolioLabelDark, isDarkMode && styles.portfolioLabelDarkReadable]}>
                {isBusinessOwner ? 'Earned' : 'Spent'}
              </Text>
            </View>
          </View>

          <Text style={[styles.portfolioHint, isDarkMode && styles.portfolioHintDarkReadable]}>
            Add more than {formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)} per deposit. Unpaid
            accounts fail after {DYNAMIC_DEPOSIT_EXPIRY_MINUTES} minutes.
          </Text>
          <View style={styles.portfolioActionRow}>
            <AppButton
              label="Add funds"
              onPress={openDepositModal}
              style={styles.portfolioActionButton}
              variant="secondary"
            />
            {isBusinessOwner ? (
              <AppButton
                label="Withdraw"
                onPress={() => navigation.navigate('Withdrawal')}
                style={styles.portfolioActionButton}
                variant="ghost"
              />
            ) : null}
          </View>
          <Pressable
            onPress={() => navigation.navigate('Transactions')}
            style={({ pressed }) => [
              styles.transactionLink,
              pressed && styles.itemRowPressed,
            ]}
          >
            <Ionicons color={portfolioInkColor} name="receipt-outline" size={18} />
            <Text style={[styles.transactionLinkText, isDarkMode && styles.transactionLinkTextDark]}>
              View all transactions
            </Text>
            <Ionicons color={portfolioInkColor} name="chevron-forward-outline" size={16} />
          </Pressable>
        </View>

        <View
          style={[
            styles.hero,
            styles.profileCarouselCard,
            !isBusinessOwner && styles.userCarouselCard,
            { width: profileCarouselCardWidth },
          ]}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.heroSettingsButton, pressed && styles.itemRowPressed]}
          >
            <Ionicons color={colors.white} name="settings-outline" size={22} />
          </Pressable>
          <Text style={styles.eyebrow}>{isBusinessOwner ? 'Business account' : 'My account'}</Text>
          <Text style={styles.title}>{user.businessName ?? user.fullName}</Text>
          <Text style={styles.subtitle}>
            {user.email} - {user.businessCluster ?? estate?.name ?? 'River Park'}
          </Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Ionicons color={colors.white} name="call-outline" size={16} />
              <Text style={styles.heroMetaText}>{user.phoneNumber}</Text>
            </View>
            <View style={styles.heroMetaChip}>
              <Ionicons color={colors.white} name="location-outline" size={16} />
              <Text style={styles.heroMetaText}>River Park only</Text>
            </View>
            {isBusinessOwner ? (
              <View
                style={[
                  styles.heroMetaChip,
                  riverParkVerified ? styles.heroMetaChipVerified : styles.heroMetaChipPending,
                ]}
              >
                <Ionicons
                  color={colors.white}
                  name={riverParkVerified ? 'checkmark-circle-outline' : 'time-outline'}
                  size={16}
                />
                <Text style={styles.heroMetaText}>
                  {riverParkVerified ? 'Verified' : 'Pending'}
                </Text>
              </View>
            ) : null}
          </View>
          {isBusinessOwner ? (
            <Pressable
              onPress={() => navigation.navigate('ProfileEdit')}
              style={({ pressed }) => [styles.heroEditButton, pressed && styles.itemRowPressed]}
            >
              <Ionicons color={colors.white} name="create-outline" size={17} />
              <Text style={styles.heroEditText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.summaryGrid}>
        {isBusinessOwner ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatNumber(ownerListings.length)}</Text>
              <Text style={styles.summaryLabel}>Listings</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatNumber(ownerOpenOrders.length)}</Text>
              <Text style={styles.summaryLabel}>Open orders</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatNumber(lowStockListings.length)}</Text>
              <Text style={styles.summaryLabel}>Low stock</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatNumber(cartCount)}</Text>
              <Text style={styles.summaryLabel}>Cart items</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatNumber(residentOrders.length)}</Text>
              <Text style={styles.summaryLabel}>Orders</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatNumber(residentActiveOrders.length)}</Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
          </>
        )}
      </View>

      {isBusinessOwner ? (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>My listings</Text>
            <View style={styles.segmentedControl}>
              {(['product', 'profession'] as const).map((type) => {
                const isActive = listingView === type;

                return (
                  <Pressable
                    key={type}
                    onPress={() => setListingView(type)}
                    style={({ pressed }) => [
                      styles.segmentChip,
                      isActive && styles.segmentChipActive,
                      pressed && styles.itemRowPressed,
                    ]}
                  >
                    <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                      {type === 'product' ? 'Products' : 'Professions'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.ownerListingGrid}>
            {selectedOwnerListings.length > 0 ? (
              selectedOwnerListings.map((business) => (
                <Pressable
                  key={business.id}
                  onPress={() =>
                    navigation.navigate('BusinessDetails', { businessId: business.id })
                  }
                  style={({ pressed }) => [
                    styles.ownerListingCard,
                    pressed && styles.itemRowPressed,
                  ]}
                >
                  <Image
                    resizeMode="cover"
                    source={{ uri: business.imageUrl }}
                    style={styles.ownerListingImage}
                  />
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      openListingMenu(business);
                    }}
                    style={({ pressed }) => [
                      styles.listingMenuButton,
                      pressed && styles.itemRowPressed,
                    ]}
                  >
                    <Ionicons color={colors.white} name="ellipsis-horizontal" size={20} />
                  </Pressable>
                  <View style={styles.ownerListingBody}>
                    <Text numberOfLines={1} style={styles.itemTitle}>{business.name}</Text>
                    <Text numberOfLines={2} style={styles.itemMeta}>
                      {business.category} - {business.cluster}
                    </Text>
                    <View style={styles.listingStatusRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          business.verified ? styles.statusBadgeSuccess : styles.statusBadgeWarning,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {business.verified
                            ? getBusinessStatusLabel(business.status)
                            : 'Pending'}
                        </Text>
                      </View>
                      {business.listingType === 'product' ? (
                        <Text style={styles.itemMeta}>{formatCurrency(business.price)}</Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={styles.bodyText}>
                No {listingView === 'product' ? 'product' : 'profession'} listings yet.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {isBusinessOwner ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Incoming orders</Text>
            <View style={styles.rowStack}>
              {ownerOrders.length > 0 ? (
                ownerOrders.slice(0, 5).map((order) => {
                  const sellerValue = order.items
                    .filter((item) =>
                      [item.ownerUserId, item.ownerName]
                        .map((key) => key?.trim().toLowerCase())
                        .some((key) => Boolean(key && ownerKeys.includes(key))),
                    )
                    .reduce((total, item) => total + item.lineTotal, 0);

                  return (
                    <View
                      key={order.id}
                      style={[styles.itemRow, styles.orderItemCard]}
                    >
                      <Pressable
                        onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}
                        style={({ pressed }) => [
                          styles.orderItemTopRow,
                          pressed && styles.itemRowPressed,
                        ]}
                      >
                        <View style={styles.itemCopy}>
                          <Text style={styles.itemTitle}>{order.id}</Text>
                          <Text style={styles.itemMeta}>
                            {order.userName} - {getOrderStatusLabel(order.status)} -{' '}
                            {getPaymentStatusLabel(order.paymentStatus)}
                          </Text>
                          <Text style={styles.itemMeta}>
                            Your items: {formatCurrency(sellerValue)}
                          </Text>
                        </View>
                        <Ionicons color={colors.primary} name="chevron-forward-outline" size={18} />
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.bodyText}>New River Park orders will appear here.</Text>
              )}
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Inventory</Text>
            <View style={styles.rowStack}>
              {productListings.length > 0 ? (
                productListings.slice(0, 6).map((business) => {
                  const stock = getAvailableStock(business.id);
                  const isLow = stock <= Math.max(1, business.reorderLevel ?? 0);

                  return (
                    <Pressable
                      key={business.id}
                      onPress={() =>
                        navigation.navigate('BusinessDetails', { businessId: business.id })
                      }
                      style={({ pressed }) => [styles.itemRow, pressed && styles.itemRowPressed]}
                    >
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>{business.name}</Text>
                        <Text style={styles.itemMeta}>
                          {stock} available - reorder at {business.reorderLevel ?? 0}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          isLow ? styles.statusBadgeWarning : styles.statusBadgeSuccess,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {isLow ? 'Low' : 'Ready'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.bodyText}>Product stock will show here after approval.</Text>
              )}
            </View>
          </View>

        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent orders</Text>
          <View style={styles.rowStack}>
            {residentOrders.length > 0 ? (
              residentOrders.slice(0, 5).map((order) => (
                <Pressable
                  key={order.id}
                  onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}
                  style={({ pressed }) => [styles.itemRow, pressed && styles.itemRowPressed]}
                >
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{order.id}</Text>
                    <Text style={styles.itemMeta}>
                      {getOrderStatusLabel(order.status)} -{' '}
                      {getPaymentStatusLabel(order.paymentStatus)}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {formatCurrency(order.totalAmount)} - {formatDateTime(order.createdAt)}
                    </Text>
                  </View>
                  <Ionicons color={colors.primary} name="navigate-outline" size={18} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.bodyText}>
                Orders placed from your cart will appear here.
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionStack}>
          <AppButton label="Shop products" onPress={() => navigation.navigate('Dashboard')} />
          <AppButton
            label="Browse services"
            onPress={() => navigation.navigate('Professions')}
            variant="secondary"
          />
          <AppButton label="Open support" onPress={() => navigation.navigate('Chats')} variant="ghost" />
          {isBusinessOwner ? (
            <AppButton
              label="Create listing"
              onPress={() => navigation.navigate('RegisterBusiness')}
              variant="ghost"
            />
          ) : (
            <AppButton label="Open cart" onPress={() => navigation.navigate('Cart')} variant="ghost" />
          )}
          <AppButton label="Sign out" onPress={signOut} variant="ghost" />
        </View>
      </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(editingListing && listingEditForm)}
        onRequestClose={closeListingEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalPanel, { maxWidth: Math.min(width - spacing.lg * 2, 680) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.itemCopy}>
                <Text style={styles.sectionTitle}>Edit listing</Text>
                <Text style={styles.itemMeta}>
                  {editingListing?.name ?? 'Listing'} information
                </Text>
              </View>
              <Pressable
                onPress={closeListingEditor}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.itemRowPressed]}
              >
                <Ionicons color={colors.text} name="close-outline" size={22} />
              </Pressable>
            </View>

            {listingEditForm ? (
              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                <FormField
                  label="Listing name"
                  onChangeText={(value) => updateListingEditField('name', value)}
                  placeholder="Fresh basket"
                  value={listingEditForm.name}
                />

                {editingListing?.listingType === 'product' ? (
                  <View style={styles.modalGrid}>
                    <View style={styles.modalGridItem}>
                      <FormField
                        keyboardType="numeric"
                        label="Price"
                        onChangeText={(value) =>
                          updateListingEditField('price', value.replace(/[^0-9.]/g, ''))
                        }
                        placeholder="18500"
                        value={listingEditForm.price}
                      />
                    </View>
                    <View style={styles.modalGridItem}>
                      <FormField
                        keyboardType="numeric"
                        label="Stock"
                        onChangeText={(value) =>
                          updateListingEditField('stockQuantity', value.replace(/\D/g, ''))
                        }
                        placeholder="12"
                        value={listingEditForm.stockQuantity}
                      />
                    </View>
                    <View style={styles.modalGridItem}>
                      <FormField
                        keyboardType="numeric"
                        label="Reorder level"
                        onChangeText={(value) =>
                          updateListingEditField('reorderLevel', value.replace(/\D/g, ''))
                        }
                        placeholder="5"
                        value={listingEditForm.reorderLevel}
                      />
                    </View>
                  </View>
                ) : null}

                <FormField
                  label="Short description"
                  multiline
                  onChangeText={(value) => updateListingEditField('shortDescription', value)}
                  placeholder="Short listing summary"
                  value={listingEditForm.shortDescription}
                />
                <FormField
                  label="Detailed description"
                  multiline
                  onChangeText={(value) => updateListingEditField('longDescription', value)}
                  placeholder="Full listing details"
                  value={listingEditForm.longDescription}
                />

                {listingEditError ? (
                  <Text style={styles.errorText}>{listingEditError}</Text>
                ) : null}

                <View style={styles.actionStack}>
                  <AppButton
                    label="Save listing"
                    loading={isSavingListing}
                    onPress={handleSaveListing}
                  />
                  <AppButton label="Cancel" onPress={closeListingEditor} variant="ghost" />
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        visible={depositModalVisible}
        onRequestClose={closeDepositModal}
      >
        <View style={styles.depositScreen}>
          <View style={styles.depositTopBar}>
            <Pressable
              onPress={handleDepositBack}
              style={({ pressed }) => [styles.depositBackButton, pressed && styles.itemRowPressed]}
            >
              <Ionicons color={colors.text} name="chevron-back" size={28} />
            </Pressable>
            <Text style={styles.depositTitle}>Add funds</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.depositContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {depositStep === 'amount' ? (
              <>
                <View style={styles.depositHero}>
                  <View style={styles.depositHeroIcon}>
                    <Ionicons color={colors.white} name="wallet-outline" size={26} />
                  </View>
                  <View style={styles.depositHeroCopy}>
                    <Text style={styles.depositHeroKicker}>Live payment</Text>
                    <Text style={styles.depositHeroTitle}>Add funds with Flutterwave</Text>
                    <Text style={styles.depositHeroSubtitle}>Card or bank transfer</Text>
                  </View>
                </View>

                <View style={styles.depositMethodGrid}>
                  {depositFlutterwaveChannels.map((channel) => {
                    const isActive = channel.id === depositPaymentChannel;

                    return (
                      <Pressable
                        key={channel.id}
                        onPress={() => {
                          void handleStartFlutterwaveDeposit(channel);
                        }}
                        style={({ pressed }) => [
                          styles.depositMethodChip,
                          isActive && styles.depositMethodChipActive,
                          pressed && styles.itemRowPressed,
                        ]}
                      >
                        <Ionicons
                          color={isActive ? colors.white : colors.primary}
                          name={channel.icon}
                          size={18}
                        />
                        <Text
                          style={[
                            styles.depositMethodText,
                            isActive && styles.depositMethodTextActive,
                          ]}
                        >
                          {channel.label}
                        </Text>
                        <Text
                          style={[
                            styles.depositMethodMeta,
                            isActive && styles.depositMethodTextActive,
                          ]}
                        >
                          {channel.subtitle}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.depositSelectCard}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.depositSelectLabel}>Deposit to</Text>
                    <Text style={styles.depositSelectValue}>
                      {user.businessName ?? user.fullName} wallet
                    </Text>
                  </View>
                  <Ionicons color={colors.text} name="chevron-down" size={22} />
                </View>

                <View style={styles.depositBalanceRow}>
                  <Text style={styles.depositBalanceLabel}>Current balance</Text>
                  <Text style={styles.depositBalanceValue}>{formatCurrency(buyerBalance)}</Text>
                </View>

                <View style={styles.depositAmountBox}>
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={(value) => {
                      setDepositAmount(value.replace(/[^0-9]/g, ''));
                      setDepositError(null);
                    }}
                    placeholder={`Enter more than ${formatNumber(MINIMUM_ADD_FUNDS_DEPOSIT)}`}
                    placeholderTextColor={colors.textMuted}
                    style={styles.depositAmountInput}
                    value={depositAmount}
                  />
                  <Ionicons color={colors.primary} name="swap-vertical-outline" size={22} />
                </View>

                <Text style={styles.depositNairaPreview}>
                  {depositDisplayAmount > 0 ? formatCurrency(depositDisplayAmount) : 'NGN 0'}
                </Text>

                <View style={styles.depositPresetGrid}>
                  {[2500, 5000, 10000].map((amount) => (
                    <Pressable
                      key={amount}
                      onPress={() => {
                        setDepositAmount(String(amount));
                        setDepositError(null);
                      }}
                      style={({ pressed }) => [
                        styles.depositPresetButton,
                        pressed && styles.itemRowPressed,
                      ]}
                    >
                      <Text style={styles.depositPresetText}>{formatCurrency(amount)}</Text>
                    </Pressable>
                  ))}
                </View>

                {depositError ? <Text style={styles.errorText}>{depositError}</Text> : null}

                <AppButton
                  label={`Pay with ${selectedDepositPaymentChannel.label}`}
                  loading={isCreatingDepositAccount}
                  onPress={() => void handleStartFlutterwaveDeposit()}
                  style={styles.depositActionButton}
                />

                <AppButton
                  label="Generate bank transfer account"
                  loading={isCreatingDepositAccount}
                  onPress={handleCreateDepositAccount}
                  style={styles.depositActionButton}
                  variant="secondary"
                />
              </>
            ) : null}

            {depositStep === 'instructions' ? (
              <>
                <View style={styles.depositSecuredRow}>
                  <View style={styles.depositLockIcon}>
                    <Ionicons color={colors.white} name="lock-closed" size={15} />
                  </View>
                  <Text style={styles.depositSecuredText}>Secured by Flutterwave</Text>
                </View>

                <View style={styles.depositPayHeader}>
                  <Ionicons color="#A9BDCB" name="business-outline" size={42} />
                  <Text style={styles.depositPayAmount}>
                    Pay {formatCurrency(depositDisplayAmount)}
                  </Text>
                  <Text style={styles.depositCopyText}>Copy amount</Text>
                </View>

                <Text style={styles.depositInstructionTitle}>Before you make this transfer</Text>

                <View style={styles.depositInstructionCard}>
                  <View style={styles.depositInstructionItem}>
                    <View style={styles.depositCheckBadge}>
                      <Ionicons color={colors.white} name="checkmark" size={18} />
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={styles.depositInstructionStrong}>
                        Transfer only the exact amount
                      </Text>
                      <Text style={styles.depositInstructionText}>
                        Do not transfer {formatCurrency(MINIMUM_ADD_FUNDS_DEPOSIT)} or less.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.depositInstructionItem}>
                    <View style={styles.depositCheckBadge}>
                      <Ionicons color={colors.white} name="checkmark" size={18} />
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={styles.depositInstructionStrong}>
                        Do not save or reuse the account
                      </Text>
                      <Text style={styles.depositInstructionText}>
                        It can only accept this single transfer and should not be reused.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.depositInstructionItem}>
                    <View style={styles.depositCheckBadge}>
                      <Ionicons color={colors.white} name="checkmark" size={18} />
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={styles.depositInstructionText}>
                        The account fails if Flutterwave does not detect payment within{' '}
                        {DYNAMIC_DEPOSIT_EXPIRY_MINUTES} minutes.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.depositInstructionItem}>
                    <View style={styles.depositCheckBadge}>
                      <Ionicons color={colors.white} name="checkmark" size={18} />
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={styles.depositInstructionText}>
                        Receipt is sent only after Flutterwave confirms the transfer.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() =>
                      setDepositInstructionsAccepted((currentAccepted) => !currentAccepted)
                    }
                    style={({ pressed }) => [
                      styles.depositUnderstandRow,
                      pressed && styles.itemRowPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.depositCheckbox,
                        depositInstructionsAccepted && styles.depositCheckboxChecked,
                      ]}
                    >
                      {depositInstructionsAccepted ? (
                        <Ionicons color={colors.white} name="checkmark" size={18} />
                      ) : null}
                    </View>
                    <Text style={styles.depositInstructionText}>
                      I understand these instructions.
                    </Text>
                  </Pressable>

                  <AppButton
                    disabled={!depositInstructionsAccepted || !generatedDepositAccount}
                    label="Continue"
                    onPress={() => setDepositStep('details')}
                    style={styles.depositContinueButton}
                  />
                </View>

                <View style={styles.depositFooterActions}>
                  <Pressable onPress={closeDepositModal}>
                    <Text style={styles.depositCancelText}>Cancel</Text>
                  </Pressable>
                  <View style={styles.depositFooterDivider} />
                  <Pressable onPress={handleDepositHelp}>
                    <Text style={styles.depositHelpText}>Help?</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {depositStep === 'details' && generatedDepositAccount ? (
              <>
                <View style={styles.depositSecuredRow}>
                  <View style={styles.depositLockIcon}>
                    <Ionicons color={colors.white} name="lock-closed" size={15} />
                  </View>
                  <Text style={styles.depositSecuredText}>Secured by Flutterwave</Text>
                </View>

                <View style={styles.depositPayHeader}>
                  <Ionicons color="#A9BDCB" name="business-outline" size={42} />
                  <Text style={styles.depositPayAmount}>
                    Pay {formatCurrency(generatedDepositAccount.amount)}
                  </Text>
                  <Text style={styles.depositCopyText}>Copy amount</Text>
                </View>

                <View style={styles.depositExactCard}>
                  <Text style={styles.depositExactText}>
                    Transfer exactly{' '}
                    <Text style={styles.depositExactAmount}>
                      {formatCurrency(generatedDepositAccount.amount)}
                    </Text>{' '}
                    to the bank account below.
                  </Text>
                </View>

                <View style={styles.depositBankCard}>
                  <View style={styles.depositBankMark}>
                    <View style={styles.depositBankDot} />
                  </View>
                  <Text style={styles.depositBankEyebrow}>Generated checkout account</Text>
                  <Text style={styles.depositBankName}>
                    {generatedDepositAccount.bankName}
                  </Text>
                  <View style={styles.depositCopyValueRow}>
                    <View style={styles.depositCopyValueText}>
                      <Text style={styles.depositCopyLabel}>Account number</Text>
                      <Text selectable style={styles.depositAccountNumber}>
                        {generatedDepositAccount.accountNumber}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void copyDepositDetail(
                          'Account number',
                          generatedDepositAccount.accountNumber,
                        )
                      }
                      style={({ pressed }) => [
                        styles.depositCopyButton,
                        pressed && styles.itemRowPressed,
                      ]}
                    >
                      <Ionicons color={colors.primary} name="copy-outline" size={16} />
                      <Text style={styles.depositCopyButtonText}>Copy</Text>
                    </Pressable>
                  </View>
                  <View style={styles.depositCopyValueRow}>
                    <View style={styles.depositCopyValueText}>
                      <Text style={styles.depositCopyLabel}>Account name</Text>
                      <Text selectable style={styles.depositAccountName}>
                        {generatedDepositAccount.accountName}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void copyDepositDetail(
                          'Account name',
                          generatedDepositAccount.accountName,
                        )
                      }
                      style={({ pressed }) => [
                        styles.depositCopyButton,
                        pressed && styles.itemRowPressed,
                      ]}
                    >
                      <Ionicons color={colors.primary} name="copy-outline" size={16} />
                      <Text style={styles.depositCopyButtonText}>Copy</Text>
                    </Pressable>
                  </View>
                  <View style={styles.depositReuseWarning}>
                    <Ionicons color={colors.danger} name="remove-circle" size={18} />
                    <Text style={styles.depositReuseText}>
                      Do not save or reuse this account number
                    </Text>
                  </View>
                </View>

                {generatedDepositAccount.expiresAt ? (
                  <Text style={styles.depositConfirmationText}>
                    Expires {formatDateTime(generatedDepositAccount.expiresAt)}
                  </Text>
                ) : null}

                <Text style={styles.depositConfirmationText}>
                  Status: {getDepositStatusLabel(generatedDepositAccount.status)}. Receipt is sent
                  only after Flutterwave confirms a successful transfer.
                </Text>

                <View style={styles.depositFooterActions}>
                  <Pressable onPress={closeDepositModal}>
                    <Text style={styles.depositCancelText}>Cancel</Text>
                  </Pressable>
                  <View style={styles.depositFooterDivider} />
                  <Pressable onPress={handleDepositHelp}>
                    <Text style={styles.depositHelpText}>Help?</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
      {activeFlutterwaveCheckout ? (
        <FlutterwaveCheckoutModal
          key={activeFlutterwaveCheckout.checkoutUrl}
          activePaymentLabel={activeFlutterwaveCheckout.channelLabel}
          checkoutUrl={activeFlutterwaveCheckout.checkoutUrl}
          onClose={handleCloseFlutterwaveCheckout}
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
    profileCarousel: {
      marginHorizontal: -spacing.xs,
    },
    profileCarouselTrack: {
      gap: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    profileCarouselCard: {
      minHeight: 310,
    },
    userCarouselCard: {
      minHeight: 242,
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
    heroSettingsButton: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      width: 44,
      borderRadius: 22,
      backgroundColor: colors.overlayMuted,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
    },
    heroGlowOne: {
      position: 'absolute',
      top: -32,
      right: -8,
      height: 136,
      width: 136,
      borderRadius: 999,
      backgroundColor: 'rgba(240, 132, 92, 0.28)',
    },
    heroGlowTwo: {
      position: 'absolute',
      bottom: -46,
      left: -18,
      height: 152,
      width: 152,
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
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    heroMetaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.overlayMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    heroMetaChipVerified: {
      backgroundColor: 'rgba(45, 126, 105, 0.72)',
    },
    heroMetaChipPending: {
      backgroundColor: 'rgba(217, 95, 67, 0.72)',
    },
    heroMetaText: {
      ...typography.caption,
      color: colors.white,
    },
    heroEditButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.secondary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    heroEditText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    portfolioHero: {
      backgroundColor: colors.primary,
    },
    portfolioEyebrowDark: {
      color: '#164B3B',
    },
    portfolioTitleDark: {
      color: '#092E23',
    },
    portfolioIconShell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      height: 44,
      minWidth: 44,
      borderRadius: 22,
      backgroundColor: colors.overlayMuted,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      paddingHorizontal: spacing.sm,
    },
    portfolioIconShellDisabled: {
      opacity: 0.9,
    },
    portfolioMenuButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      width: 44,
      borderRadius: 22,
      backgroundColor: colors.overlayMuted,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    summaryCard: {
      flex: 1,
      minWidth: 140,
      gap: spacing.xs,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.soft,
    },
    summaryValue: {
      ...typography.title,
      color: colors.primary,
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.textMuted,
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
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    subscriptionHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.md,
    },
    subscriptionIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      width: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
    },
    planChoiceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    planChoice: {
      flex: 1,
      minWidth: 160,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    planChoiceActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    planChoiceTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    planChoiceAmount: {
      ...typography.caption,
      color: colors.textMuted,
    },
    planChoiceTitleActive: {
      color: colors.white,
    },
    sectionTitle: {
      ...typography.section,
      color: colors.text,
    },
    bodyText: {
      ...typography.body,
      color: colors.textMuted,
    },
    depositScreen: {
      flex: 1,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingTop: 100,
    },
    depositTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      width: '100%',
      maxWidth: 460,
      alignSelf: 'center',
    },
    depositBackButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      width: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    depositTitle: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '800',
      color: colors.text,
    },
    depositContent: {
      width: '100%',
      maxWidth: 460,
      alignSelf: 'center',
      gap: spacing.md,
      paddingBottom: spacing.xxl,
      paddingTop: spacing.lg,
    },
    depositHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 142,
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      ...shadows.soft,
    },
    depositHeroIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      width: 52,
      borderRadius: 26,
      backgroundColor: colors.overlayMuted,
    },
    depositHeroCopy: {
      flex: 1,
      gap: 2,
    },
    depositHeroKicker: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800',
      color: '#D7EAE2',
    },
    depositHeroTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.white,
    },
    depositHeroSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: '#D6DFE2',
    },
    depositMethodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    depositMethodChip: {
      flex: 1,
      minWidth: 112,
      minHeight: 88,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
    },
    depositMethodChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    depositMethodText: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      color: colors.text,
    },
    depositMethodTextActive: {
      color: colors.white,
    },
    depositMethodMeta: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textMuted,
    },
    depositSelectCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      minHeight: 58,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    depositSelectLabel: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textMuted,
    },
    depositSelectValue: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.text,
    },
    depositBalanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    depositBalanceLabel: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: colors.textMuted,
    },
    depositBalanceValue: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '900',
      color: colors.text,
    },
    depositAmountBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 62,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
    },
    depositAmountInput: {
      flex: 1,
      minHeight: 58,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.text,
    },
    depositNairaPreview: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'right',
    },
    depositPresetGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    depositPresetButton: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
    },
    depositPresetText: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '900',
      color: colors.text,
    },
    depositActionButton: {
      minHeight: 56,
      borderRadius: 8,
    },
    depositSecuredRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingTop: spacing.lg,
    },
    depositLockIcon: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
      width: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    depositSecuredText: {
      ...typography.body,
      color: colors.textMuted,
    },
    depositPayHeader: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
    },
    depositPayAmount: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    depositCopyText: {
      ...typography.bodyStrong,
      color: colors.textMuted,
      textAlign: 'center',
    },
    depositInstructionTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      color: '#384557',
      textAlign: 'center',
    },
    depositInstructionCard: {
      gap: spacing.lg,
      borderRadius: 8,
      backgroundColor: '#FFF5EA',
      padding: spacing.lg,
    },
    depositInstructionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    depositCheckBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 30,
      width: 30,
      borderRadius: 15,
      backgroundColor: '#9BAFC0',
    },
    depositInstructionStrong: {
      fontSize: 18,
      lineHeight: 25,
      fontWeight: '800',
      color: '#7A4B0D',
    },
    depositInstructionText: {
      fontSize: 18,
      lineHeight: 26,
      fontWeight: '500',
      color: '#7A4B0D',
    },
    depositUnderstandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 44,
    },
    depositCheckbox: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 30,
      width: 30,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#9BAFC0',
      backgroundColor: colors.surface,
    },
    depositCheckboxChecked: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    depositContinueButton: {
      minHeight: 64,
      borderRadius: 8,
      backgroundColor: '#9FBCEB',
      borderColor: '#9FBCEB',
    },
    depositFooterActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xl,
      paddingTop: spacing.xl,
    },
    depositFooterDivider: {
      height: 52,
      width: 1,
      backgroundColor: colors.border,
    },
    depositCancelText: {
      ...typography.bodyStrong,
      color: colors.danger,
    },
    depositHelpText: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    depositExactCard: {
      borderRadius: 8,
      backgroundColor: '#FFF5EA',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    depositExactText: {
      fontSize: 20,
      lineHeight: 30,
      fontWeight: '700',
      color: '#7A4B0D',
      textAlign: 'center',
    },
    depositExactAmount: {
      textDecorationLine: 'underline',
    },
    depositBankCard: {
      overflow: 'hidden',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 8,
      backgroundColor: '#EEF6FC',
      paddingTop: spacing.lg,
    },
    depositBankMark: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      width: 48,
      borderRadius: 24,
      backgroundColor: '#D92F3A',
    },
    depositBankDot: {
      height: 14,
      width: 14,
      borderRadius: 7,
      backgroundColor: colors.white,
      alignSelf: 'flex-end',
      marginRight: 9,
      marginTop: 5,
    },
    depositBankName: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    depositBankEyebrow: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '900',
      color: colors.textMuted,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    depositCopyValueRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    depositCopyValueText: {
      flex: 1,
      gap: 2,
    },
    depositCopyLabel: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    depositAccountNumber: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800',
      color: '#2477C9',
    },
    depositAccountName: {
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '800',
      color: colors.text,
    },
    depositCopyButton: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    depositCopyButtonText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '900',
      color: colors.primary,
    },
    depositReuseWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      width: '100%',
      marginTop: spacing.lg,
      backgroundColor: '#CDE3FF',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    depositReuseText: {
      ...typography.caption,
      color: colors.text,
    },
    depositConfirmationText: {
      ...typography.bodyStrong,
      color: '#A9BDCB',
      textAlign: 'center',
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
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
    rowStack: {
      gap: spacing.sm,
    },
    portfolioGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    portfolioMetricDark: {
      flex: 1,
      minWidth: 130,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.overlayMuted,
      borderWidth: 1,
      borderColor: colors.overlayMuted,
      padding: spacing.md,
    },
    portfolioValueDark: {
      ...typography.subtitle,
      color: colors.white,
    },
    portfolioValueDarkReadable: {
      color: '#092E23',
    },
    portfolioLabelDark: {
      ...typography.caption,
      color: '#D6DFE2',
    },
    portfolioLabelDarkReadable: {
      color: '#164B3B',
    },
    portfolioHint: {
      ...typography.caption,
      color: '#D6DFE2',
    },
    portfolioHintDarkReadable: {
      color: '#164B3B',
    },
    portfolioActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    portfolioActionButton: {
      flex: 1,
      minWidth: 132,
    },
    transactionLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: spacing.md,
    },
    transactionLinkText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    transactionLinkTextDark: {
      color: '#092E23',
    },
    portfolioMetric: {
      flex: 1,
      minWidth: 130,
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    portfolioValue: {
      ...typography.subtitle,
      color: colors.primary,
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
    segmentedControl: {
      flexDirection: 'row',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
    },
    segmentChip: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    segmentChipActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    segmentTextActive: {
      color: colors.white,
    },
    ownerListingGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    ownerListingCard: {
      position: 'relative',
      overflow: 'hidden',
      flexGrow: 1,
      flexBasis: '47%',
      maxWidth: '47%',
      minWidth: 150,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.soft,
    },
    ownerListingImage: {
      height: 150,
      width: '100%',
    },
    listingMenuButton: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      width: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(15, 44, 53, 0.82)',
    },
    ownerListingBody: {
      gap: spacing.xs,
      padding: spacing.md,
    },
    listingStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    itemRow: {
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
    orderItemCard: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    orderItemTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    orderProgressRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    progressActionButton: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    progressActionText: {
      ...typography.bodyStrong,
      color: colors.white,
    },
    itemRowPressed: {
      opacity: 0.92,
    },
    itemCopy: {
      flex: 1,
      gap: 4,
    },
    deleteListingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    deleteListingText: {
      ...typography.caption,
      color: colors.danger,
    },
    itemTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    itemMeta: {
      ...typography.caption,
      color: colors.textMuted,
    },
    statusBadge: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    statusBadgeSuccess: {
      backgroundColor: colors.primary,
    },
    statusBadgeWarning: {
      backgroundColor: colors.secondary,
    },
    statusBadgeText: {
      ...typography.caption,
      color: colors.white,
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backdrop,
      padding: spacing.lg,
    },
    modalPanel: {
      width: '100%',
      maxHeight: '92%',
      gap: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadows.card,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    modalCloseButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 42,
      width: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalBody: {
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    modalGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    modalGridItem: {
      flex: 1,
      minWidth: 150,
    },
    actionStack: {
      gap: spacing.sm,
    },
  });
}
